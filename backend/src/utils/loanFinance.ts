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

export const splitRepayment = (input: {
  amount: number;
  type?: string;
  principalAmount?: number;
  interestAmount?: number;
  outstandingPrincipal: number;
  outstandingInterest: number;
}) => {
  const amount = money2(Math.max(0, Number(input.amount || 0)));
  if (amount <= 0) {
    throw Object.assign(new Error('Repayment amount must be greater than zero.'), { status: 400 });
  }

  const type = String(input.type || 'mixed').toLowerCase();
  let principalAmount = 0;
  let interestAmount = 0;

  if (type === 'principal') {
    principalAmount = money2(Math.min(amount, input.outstandingPrincipal));
    if (principalAmount <= 0) {
      throw Object.assign(new Error('No outstanding principal left on this loan.'), { status: 400 });
    }
    if (amount > principalAmount + 0.009) {
      throw Object.assign(new Error('Principal repayment exceeds outstanding principal.'), { status: 400 });
    }
  } else if (type === 'interest') {
    interestAmount = money2(Math.min(amount, input.outstandingInterest || amount));
    if (interestAmount <= 0 && input.outstandingInterest <= 0) {
      // Allow recording extra interest paid even if expectedInterest was 0
      interestAmount = amount;
    }
  } else {
    const explicitPrincipal = input.principalAmount != null ? money2(Number(input.principalAmount)) : null;
    const explicitInterest = input.interestAmount != null ? money2(Number(input.interestAmount)) : null;
    if (explicitPrincipal != null || explicitInterest != null) {
      principalAmount = money2(Math.min(explicitPrincipal ?? 0, input.outstandingPrincipal));
      interestAmount = money2(explicitInterest ?? Math.max(0, amount - principalAmount));
      if (money2(principalAmount + interestAmount) !== amount) {
        throw Object.assign(new Error('Principal + interest must equal repayment amount.'), { status: 400 });
      }
    } else {
      // Default: interest first, then principal
      interestAmount = money2(Math.min(amount, input.outstandingInterest));
      principalAmount = money2(Math.min(amount - interestAmount, input.outstandingPrincipal));
      const leftover = money2(amount - principalAmount - interestAmount);
      if (leftover > 0) {
        // Extra beyond expected interest counts as additional interest paid
        interestAmount = money2(interestAmount + leftover);
      }
    }
  }

  return {
    amount,
    principalAmount: money2(principalAmount),
    interestAmount: money2(interestAmount),
    type: type === 'principal' || type === 'interest' ? type : 'mixed'
  };
};
