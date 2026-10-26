import { describe, expect, it } from 'vitest';
import { recomputeLoanBalances, splitRepayment } from '../../src/utils/loanFinance';

describe('loanFinance', () => {
  it('applies only 1000 against a 10000 principal loan', () => {
    const split = splitRepayment({
      amount: 1000,
      type: 'mixed',
      outstandingPrincipal: 10000,
      outstandingInterest: 0
    });
    expect(split.principalAmount).toBe(1000);
    expect(split.interestAmount).toBe(0);
    expect(split.amount).toBe(1000);

    const balances = recomputeLoanBalances({
      principalAmount: 10000,
      expectedInterest: 0,
      repayments: [{ ...split, status: 'active' }]
    });
    expect(balances.outstandingPrincipal).toBe(9000);
    expect(balances.outstandingInterest).toBe(0);
    expect(balances.status).toBe('active');
  });

  it('rejects repayment larger than outstanding balance', () => {
    expect(() =>
      splitRepayment({
        amount: 15000,
        type: 'mixed',
        outstandingPrincipal: 10000,
        outstandingInterest: 0
      })
    ).toThrow(/cannot exceed outstanding balance/i);
  });

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

  it('ignores empty-string explicit split fields', () => {
    const split = splitRepayment({
      amount: 1000,
      type: 'mixed',
      principalAmount: '' as any,
      interestAmount: '' as any,
      outstandingPrincipal: 10000,
      outstandingInterest: 0
    });
    expect(split.principalAmount).toBe(1000);
    expect(split.amount).toBe(1000);
  });

  it('closes loan when principal and interest are fully paid', () => {
    const balances = recomputeLoanBalances({
      principalAmount: 500,
      expectedInterest: 50,
      repayments: [{ principalAmount: 500, interestAmount: 50, status: 'active' }]
    });
    expect(balances.outstandingPrincipal).toBe(0);
    expect(balances.outstandingInterest).toBe(0);
    expect(balances.status).toBe('closed');
  });
});
