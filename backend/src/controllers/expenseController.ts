import { Response } from 'express';
import { TenantRequest } from '../middleware/tenant';
import { EXPENSE_CATEGORIES, getExpenseModel, type ExpenseCategory } from '../models/tenant/Expense';
import { logAuditEvent } from '../utils/auditLogger';

const parseId = (id: string | string[] | undefined) => (Array.isArray(id) ? id[0] : id);

import { paginatedResult, parsePagination, textSearch } from '../utils/pagination';
import { mergeFilters, resolveBusinessUnitId, unitScope } from '../utils/businessUnit';

export const getExpenses = async (req: TenantRequest, res: Response) => {
  try {
    const Expense = getExpenseModel(req.tenantDB!);
    const { page, limit, skip, search } = parsePagination(req.query);
    const filter = mergeFilters(textSearch(search, ['title', 'category', 'notes']), unitScope(req));
    const [items, total] = await Promise.all([
      Expense.find(filter).sort({ expenseDate: -1, createdAt: -1 }).skip(skip).limit(limit),
      Expense.countDocuments(filter)
    ]);
    const amountTotal = items
      .filter((item) => item.status === 'active')
      .reduce((sum, item) => sum + item.amount, 0);
    res.json({ ...paginatedResult(items, total, page, limit), amountTotal });
  } catch (error) {
    console.error('Error fetching expenses:', error);
    res.status(500).json({ message: 'Error fetching expenses' });
  }
};

export const createExpense = async (req: TenantRequest, res: Response) => {
  try {
    const title = String(req.body?.title || '').trim();
    const amount = Number(req.body?.amount);
    const category = String(req.body?.category || 'other').trim() as ExpenseCategory;
    const expenseDate = req.body?.expenseDate ? new Date(req.body.expenseDate) : new Date();
    const notes = typeof req.body?.notes === 'string' ? req.body.notes.trim() : undefined;

    if (!title) {
      return res.status(400).json({ message: 'Expense title is required.' });
    }
    if (!Number.isFinite(amount) || amount < 0) {
      return res.status(400).json({ message: 'Amount must be zero or greater.' });
    }
    if (!EXPENSE_CATEGORIES.includes(category)) {
      return res.status(400).json({ message: 'A valid expense category is required.' });
    }
    if (Number.isNaN(expenseDate.getTime())) {
      return res.status(400).json({ message: 'A valid date is required.' });
    }

    const Expense = getExpenseModel(req.tenantDB!);
    const expense = await Expense.create({
      title,
      amount,
      category,
      expenseDate,
      notes,
      businessUnitId: resolveBusinessUnitId(req, req.body),
      status: 'active'
    });

    if (req.user && req.business) {
      await logAuditEvent({
        user: req.user as any,
        business: req.business,
        action: 'CREATE',
        entity: 'Expense',
        entityId: expense._id.toString(),
        changes: { title, amount, category, expenseDate },
        req
      });
    }

    res.status(201).json(expense);
  } catch (error) {
    console.error('Error creating expense:', error);
    res.status(500).json({ message: 'Error creating expense' });
  }
};

export const updateExpense = async (req: TenantRequest, res: Response) => {
  try {
    const entityId = parseId(req.params.id);
    const Expense = getExpenseModel(req.tenantDB!);
    const updates: Record<string, unknown> = {};

    if (req.body?.title !== undefined) {
      const title = String(req.body.title).trim();
      if (!title) {
        return res.status(400).json({ message: 'Expense title is required.' });
      }
      updates.title = title;
    }
    if (req.body?.amount !== undefined) {
      const amount = Number(req.body.amount);
      if (!Number.isFinite(amount) || amount < 0) {
        return res.status(400).json({ message: 'Amount must be zero or greater.' });
      }
      updates.amount = amount;
    }
    if (req.body?.category !== undefined) {
      const category = String(req.body.category).trim() as ExpenseCategory;
      if (!EXPENSE_CATEGORIES.includes(category)) {
        return res.status(400).json({ message: 'A valid expense category is required.' });
      }
      updates.category = category;
    }
    if (req.body?.expenseDate !== undefined) {
      const expenseDate = new Date(req.body.expenseDate);
      if (Number.isNaN(expenseDate.getTime())) {
        return res.status(400).json({ message: 'A valid date is required.' });
      }
      updates.expenseDate = expenseDate;
    }
    if (typeof req.body?.notes === 'string') {
      updates.notes = req.body.notes.trim();
    }
    if (req.body?.status === 'active' || req.body?.status === 'inactive') {
      updates.status = req.body.status;
    }
    if (req.body?.businessUnitId !== undefined) {
      updates.businessUnitId = resolveBusinessUnitId(req, req.body);
    }

    const expense = await Expense.findByIdAndUpdate(entityId, updates, { new: true });
    if (!expense) {
      return res.status(404).json({ message: 'Expense not found.' });
    }

    if (req.user && req.business && entityId) {
      await logAuditEvent({
        user: req.user as any,
        business: req.business,
        action: 'UPDATE',
        entity: 'Expense',
        entityId,
        changes: updates,
        req
      });
    }

    res.json(expense);
  } catch (error) {
    console.error('Error updating expense:', error);
    res.status(500).json({ message: 'Error updating expense' });
  }
};

export const deleteExpense = async (req: TenantRequest, res: Response) => {
  try {
    const entityId = parseId(req.params.id);
    const Expense = getExpenseModel(req.tenantDB!);
    const expense = await Expense.findByIdAndDelete(entityId);
    if (!expense) {
      return res.status(404).json({ message: 'Expense not found.' });
    }

    if (req.user && req.business && entityId) {
      await logAuditEvent({
        user: req.user as any,
        business: req.business,
        action: 'DELETE',
        entity: 'Expense',
        entityId,
        req
      });
    }

    res.json({ message: 'Expense deleted' });
  } catch (error) {
    console.error('Error deleting expense:', error);
    res.status(500).json({ message: 'Error deleting expense' });
  }
};
