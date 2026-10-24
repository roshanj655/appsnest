import { describe, expect, it } from 'vitest';
import { recomputeLoanBalances, splitRepayment } from '../../src/utils/loanFinance';

describe('loanFinance', () => {
  it('keeps outstanding principal after interest-first mixed repayment', () => {
    const split = splitRepayment({
      amount: 150,
      type: 'mixed',
      outstandingPrincipal: 1000,
      outstandingInterest: 100
    });
    expect(split.interestAmount).toBe(100);
    expect(split.principalAmount).toBe(50);

    const balances = recomputeLoanBalances({
      principalAmount: 1000,
      expectedInterest: 100,
      repayments: [{ ...split, status: 'active' }]
    });
    expect(balances.outstandingPrincipal).toBe(950);
    expect(balances.outstandingInterest).toBe(0);
    expect(balances.status).toBe('active');
  });

  it('closes loan when principal and interest are fully paid', () => {
    const balances = recomputeLoanBalances({
      principalAmount: 500,
      expectedInterest: 50,
      repayments: [
        { principalAmount: 500, interestAmount: 50, status: 'active' }
      ]
    });
    expect(balances.outstandingPrincipal).toBe(0);
    expect(balances.outstandingInterest).toBe(0);
    expect(balances.status).toBe('closed');
  });
});
