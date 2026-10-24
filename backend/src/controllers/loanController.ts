import { Response } from 'express';
import { TenantRequest } from '../middleware/tenant';
import { getLoanModel } from '../models/tenant/Loan';
import { logAuditEvent } from '../utils/auditLogger';
import { paginatedResult, parsePagination, textSearch } from '../utils/pagination';
import { mergeFilters, resolveBusinessUnitId, unitScope } from '../utils/businessUnit';
import { money2 } from '../utils/money';
import { recomputeLoanBalances, splitRepayment } from '../utils/loanFinance';

const parseId = (id: string | string[] | undefined) => (Array.isArray(id) ? id[0] : id);

export const getLoans = async (req: TenantRequest, res: Response) => {
  try {
    const Loan = getLoanModel(req.tenantDB!);
    const { page, limit, skip, search } = parsePagination(req.query);
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const filter = mergeFilters(
      {
        ...textSearch(search, ['lenderName', 'phone', 'purpose', 'notes']),
        ...(status ? { status } : {})
      },
      unitScope(req)
    );
    const [items, total] = await Promise.all([
      Loan.find(filter).sort({ startDate: -1, createdAt: -1 }).skip(skip).limit(limit),
      Loan.countDocuments(filter)
    ]);
    const active = items.filter((row) => row.status === 'active');
    const summary = {
      principalBorrowed: money2(items.reduce((sum, row) => sum + Number(row.principalAmount || 0), 0)),
      outstandingPrincipal: money2(active.reduce((sum, row) => sum + Number(row.outstandingPrincipal || 0), 0)),
      outstandingInterest: money2(active.reduce((sum, row) => sum + Number(row.outstandingInterest || 0), 0)),
      interestPaid: money2(items.reduce((sum, row) => sum + Number(row.interestPaid || 0), 0)),
      principalPaid: money2(items.reduce((sum, row) => sum + Number(row.principalPaid || 0), 0))
    };
    res.json({ ...paginatedResult(items, total, page, limit), summary });
  } catch (error) {
    console.error('Error fetching loans:', error);
    res.status(500).json({ message: 'Error fetching loans' });
  }
};

export const createLoan = async (req: TenantRequest, res: Response) => {
  try {
    const lenderName = String(req.body?.lenderName || '').trim();
    const principalAmount = money2(Number(req.body?.principalAmount));
    const startDate = req.body?.startDate ? new Date(req.body.startDate) : new Date();
    const expectedInterest = money2(Number(req.body?.expectedInterest || 0));
    const interestRate = money2(Number(req.body?.interestRate || 0));

    if (!lenderName) {
      return res.status(400).json({ message: 'Lender name is required.' });
    }
    if (!Number.isFinite(principalAmount) || principalAmount <= 0) {
      return res.status(400).json({ message: 'Principal amount must be greater than zero.' });
    }
    if (Number.isNaN(startDate.getTime())) {
      return res.status(400).json({ message: 'A valid start date is required.' });
    }

    const Loan = getLoanModel(req.tenantDB!);
    const loan = await Loan.create({
      lenderName,
      phone: typeof req.body?.phone === 'string' ? req.body.phone.trim() : undefined,
      purpose: typeof req.body?.purpose === 'string' ? req.body.purpose.trim() : undefined,
      notes: typeof req.body?.notes === 'string' ? req.body.notes.trim() : undefined,
      principalAmount,
      interestRate,
      expectedInterest,
      startDate,
      dueDate: req.body?.dueDate ? new Date(req.body.dueDate) : undefined,
      principalPaid: 0,
      interestPaid: 0,
      outstandingPrincipal: principalAmount,
      outstandingInterest: expectedInterest,
      status: 'active',
      repayments: [],
      linkedPurchaseIds: Array.isArray(req.body?.linkedPurchaseIds) ? req.body.linkedPurchaseIds : [],
      businessUnitId: resolveBusinessUnitId(req, req.body)
    });

    if (req.user && req.business) {
      await logAuditEvent({
        user: req.user as any,
        business: req.business,
        action: 'CREATE',
        entity: 'Loan',
        entityId: loan._id.toString(),
        changes: { lenderName, principalAmount, expectedInterest },
        req
      });
    }

    res.status(201).json(loan);
  } catch (error) {
    console.error('Error creating loan:', error);
    res.status(500).json({ message: 'Error creating loan' });
  }
};

export const updateLoan = async (req: TenantRequest, res: Response) => {
  try {
    const entityId = parseId(req.params.id);
    const Loan = getLoanModel(req.tenantDB!);
    const loan = await Loan.findById(entityId);
    if (!loan) {
      return res.status(404).json({ message: 'Loan not found.' });
    }

    if (req.body?.lenderName !== undefined) {
      const lenderName = String(req.body.lenderName).trim();
      if (!lenderName) return res.status(400).json({ message: 'Lender name is required.' });
      loan.lenderName = lenderName;
    }
    if (typeof req.body?.phone === 'string') loan.phone = req.body.phone.trim();
    if (typeof req.body?.purpose === 'string') loan.purpose = req.body.purpose.trim();
    if (typeof req.body?.notes === 'string') loan.notes = req.body.notes.trim();
    if (req.body?.interestRate !== undefined) loan.interestRate = money2(Number(req.body.interestRate));
    if (req.body?.expectedInterest !== undefined) {
      loan.expectedInterest = money2(Number(req.body.expectedInterest));
    }
    if (req.body?.dueDate !== undefined) {
      loan.dueDate = req.body.dueDate ? new Date(req.body.dueDate) : undefined;
    }
    if (req.body?.status === 'active' || req.body?.status === 'closed' || req.body?.status === 'cancelled') {
      loan.status = req.body.status;
    }
    if (req.body?.businessUnitId !== undefined) {
      loan.businessUnitId = resolveBusinessUnitId(req, req.body) as any;
    }
    if (Array.isArray(req.body?.linkedPurchaseIds)) {
      loan.linkedPurchaseIds = req.body.linkedPurchaseIds;
    }

    // Principal change only if no repayments yet
    if (req.body?.principalAmount !== undefined) {
      const nextPrincipal = money2(Number(req.body.principalAmount));
      if (nextPrincipal <= 0) {
        return res.status(400).json({ message: 'Principal amount must be greater than zero.' });
      }
      const hasPayments = (loan.repayments || []).some((row: any) => row.status !== 'reversed');
      if (hasPayments && nextPrincipal !== Number(loan.principalAmount)) {
        return res.status(400).json({ message: 'Cannot change principal after repayments are recorded.' });
      }
      loan.principalAmount = nextPrincipal;
    }

    Object.assign(loan, recomputeLoanBalances(loan));
    await loan.save();

    if (req.user && req.business && entityId) {
      await logAuditEvent({
        user: req.user as any,
        business: req.business,
        action: 'UPDATE',
        entity: 'Loan',
        entityId,
        changes: req.body,
        req
      });
    }

    res.json(loan);
  } catch (error) {
    console.error('Error updating loan:', error);
    res.status(500).json({ message: 'Error updating loan' });
  }
};

export const deleteLoan = async (req: TenantRequest, res: Response) => {
  try {
    const entityId = parseId(req.params.id);
    const Loan = getLoanModel(req.tenantDB!);
    const loan = await Loan.findById(entityId);
    if (!loan) {
      return res.status(404).json({ message: 'Loan not found.' });
    }
    const hasPayments = (loan.repayments || []).some((row: any) => row.status !== 'reversed');
    if (hasPayments) {
      loan.status = 'cancelled';
      await loan.save();
    } else {
      await Loan.findByIdAndDelete(entityId);
    }

    if (req.user && req.business && entityId) {
      await logAuditEvent({
        user: req.user as any,
        business: req.business,
        action: 'DELETE',
        entity: 'Loan',
        entityId,
        req
      });
    }

    res.json({ message: hasPayments ? 'Loan cancelled' : 'Loan deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting loan' });
  }
};

export const addLoanRepayment = async (req: TenantRequest, res: Response) => {
  try {
    const entityId = parseId(req.params.id);
    const Loan = getLoanModel(req.tenantDB!);
    const loan = await Loan.findById(entityId);
    if (!loan) {
      return res.status(404).json({ message: 'Loan not found.' });
    }
    if (loan.status === 'cancelled') {
      return res.status(400).json({ message: 'Cannot repay a cancelled loan.' });
    }

    const split = splitRepayment({
      amount: Number(req.body?.amount),
      type: req.body?.type,
      principalAmount: req.body?.principalAmount,
      interestAmount: req.body?.interestAmount,
      outstandingPrincipal: Number(loan.outstandingPrincipal || 0),
      outstandingInterest: Number(loan.outstandingInterest || 0)
    });

    const createdBy = req.user ? String((req.user as any)._id || '') : undefined;
    loan.repayments = [
      ...(loan.repayments || []),
      {
        amount: split.amount,
        principalAmount: split.principalAmount,
        interestAmount: split.interestAmount,
        type: split.type as any,
        method: String(req.body?.method || 'cash'),
        reference: typeof req.body?.reference === 'string' ? req.body.reference.trim() : undefined,
        notes: typeof req.body?.notes === 'string' ? req.body.notes.trim() : undefined,
        paidAt: req.body?.paidAt ? new Date(req.body.paidAt) : new Date(),
        createdBy,
        status: 'active'
      } as any
    ];

    Object.assign(loan, recomputeLoanBalances(loan));
    await loan.save();

    if (req.user && req.business && entityId) {
      await logAuditEvent({
        user: req.user as any,
        business: req.business,
        action: 'UPDATE',
        entity: 'LoanRepayment',
        entityId,
        changes: split,
        req
      });
    }

    res.status(201).json(loan);
  } catch (error: any) {
    res.status(error?.status || 500).json({ message: error?.message || 'Unable to record repayment.' });
  }
};

export const reverseLoanRepayment = async (req: TenantRequest, res: Response) => {
  try {
    const entityId = parseId(req.params.id);
    const repaymentId = parseId(req.params.repaymentId);
    const Loan = getLoanModel(req.tenantDB!);
    const loan = await Loan.findById(entityId);
    if (!loan) {
      return res.status(404).json({ message: 'Loan not found.' });
    }
    const repayment = (loan.repayments || []).find((row: any) => String(row._id) === String(repaymentId));
    if (!repayment) {
      return res.status(404).json({ message: 'Repayment not found.' });
    }
    if (repayment.status === 'reversed') {
      return res.status(400).json({ message: 'Repayment already reversed.' });
    }
    repayment.status = 'reversed';
    repayment.reversedAt = new Date();
    repayment.reverseReason = String(req.body?.reason || 'Reversed');
    Object.assign(loan, recomputeLoanBalances(loan));
    await loan.save();

    if (req.user && req.business && entityId) {
      await logAuditEvent({
        user: req.user as any,
        business: req.business,
        action: 'UPDATE',
        entity: 'LoanRepayment',
        entityId,
        changes: { repaymentId, reversed: true, reason: req.body?.reason },
        req
      });
    }

    res.json(loan);
  } catch (error: any) {
    res.status(error?.status || 500).json({ message: error?.message || 'Unable to reverse repayment.' });
  }
};
