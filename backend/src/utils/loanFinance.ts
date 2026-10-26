import { money2 } from './money';

export const recomputeLoanBalances = (loan: {
  principalAmount?: number;
  expectedInterest?: number;
  repayments?: Array<{
    status?: string;
    principalAmount?: number;
    interestAmount?: number;
  }>;
  status?: string;
}) => {
  const principalAmount = money2(Number(loan.principalAmount || 0));
  const expectedInterest = money2(Number(loan.expectedInterest || 0));
  const active = (loan.repayments || []).filter((row) => row.status !== 'reversed');
  const principalPaid = money2(active.reduce((sum, row) => sum + Number(row.principalAmount || 0), 0));
  const interestPaid = money2(active.reduce((sum, row) => sum + Number(row.interestAmount || 0), 0));
  const outstandingPrincipal = money2(Math.max(0, principalAmount - principalPaid));
  const outstandingInterest = money2(Math.max(0, expectedInterest - interestPaid));
  const status =
    loan.status === 'cancelled'
      ? 'cancelled'
      : outstandingPrincipal <= 0 && outstandingInterest <= 0
        ? 'closed'
        : 'active';

  return {
    principalPaid,
    interestPaid,
    outstandingPrincipal,
    outstandingInterest,
    status
  };
};

const hasExplicitAmount = (value: unknown) =>
  value !== undefined && value !== null && value !== '' && Number.isFinite(Number(value));

export const splitRepayment = (input: {
  amount: number;
  type?: string;
  principalAmount?: number | string | null;
  interestAmount?: number | string | null;
  outstandingPrincipal: number;
  outstandingInterest: number;
}) => {
  const amount = money2(Math.max(0, Number(input.amount || 0)));
  if (amount <= 0) {
    throw Object.assign(new Error('Repayment amount must be greater than zero.'), { status: 400 });
  }

  const outstandingPrincipal = money2(Math.max(0, Number(input.outstandingPrincipal || 0)));
  const outstandingInterest = money2(Math.max(0, Number(input.outstandingInterest || 0)));
  const maxPayable = money2(outstandingPrincipal + outstandingInterest);

  if (maxPayable <= 0) {
    throw Object.assign(new Error('This loan has nothing left to pay.'), { status: 400 });
  }

  if (amount > maxPayable + 0.009) {
    throw Object.assign(
      new Error(
        `Repayment cannot exceed outstanding balance of ₹${maxPayable.toFixed(2)}. You entered ₹${amount.toFixed(2)}.`
      ),
      { status: 400 }
    );
  }

  const type = String(input.type || 'mixed').toLowerCase();
  let principalAmount = 0;
  let interestAmount = 0;

  if (type === 'principal') {
    principalAmount = money2(Math.min(amount, outstandingPrincipal));
    if (principalAmount <= 0) {
      throw Object.assign(new Error('No outstanding principal left on this loan.'), { status: 400 });
    }
    if (amount > principalAmount + 0.009) {
      throw Object.assign(new Error('Principal repayment exceeds outstanding principal.'), { status: 400 });
    }
  } else if (type === 'interest') {
    if (outstandingInterest <= 0) {
      throw Object.assign(new Error('No outstanding interest left on this loan.'), { status: 400 });
    }
    interestAmount = money2(Math.min(amount, outstandingInterest));
  } else if (hasExplicitAmount(input.principalAmount) && hasExplicitAmount(input.interestAmount)) {
    principalAmount = money2(Math.min(Number(input.principalAmount), outstandingPrincipal));
    interestAmount = money2(Math.min(Number(input.interestAmount), outstandingInterest));
    if (money2(principalAmount + interestAmount) !== amount) {
      throw Object.assign(new Error('Principal + interest must equal repayment amount.'), { status: 400 });
    }
  } else {
    // Default mixed: interest first, then principal — only the entered amount
    interestAmount = money2(Math.min(amount, outstandingInterest));
    principalAmount = money2(Math.min(amount - interestAmount, outstandingPrincipal));
  }

  const applied = money2(principalAmount + interestAmount);
  if (applied <= 0) {
    throw Object.assign(new Error('Repayment did not apply to principal or interest.'), { status: 400 });
  }

  return {
    amount: applied,
    principalAmount: money2(principalAmount),
    interestAmount: money2(interestAmount),
    type: type === 'principal' || type === 'interest' ? type : 'mixed'
  };
};
