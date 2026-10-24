import { describe, expect, it } from 'vitest';
import { allocateInvoiceDiscount, summarizeSaleFinance } from '../../src/utils/saleFinance';

describe('saleFinance', () => {
  it('keeps gross profit based on sale price even when payment is partial', () => {
    const summary = summarizeSaleFinance({
      discount: 0,
      gst: 0,
      total: 500,
      paidAmount: 400,
      payments: [{ amount: 400, status: 'active' }],
      items: [
        {
          quantity: 10,
          actualSoldAmount: 50,
          discount: 0,
          cogs: 350
        }
      ]
    });

    expect(summary.netSalesRevenue).toBe(500);
    expect(summary.totalCogs).toBe(350);
    expect(summary.grossProfit).toBe(150);
    expect(summary.grossMarginPercent).toBe(30);
    expect(summary.amountReceived).toBe(400);
    expect(summary.outstandingAmount).toBe(100);
    expect(summary.paymentStatus).toBe('partially_paid');
  });

  it('treats excess payment as customer advance, not revenue', () => {
    const summary = summarizeSaleFinance({
      total: 500,
      payments: [{ amount: 550, status: 'active' }],
      items: [{ quantity: 10, actualSoldAmount: 50, cogs: 350 }]
    });

    expect(summary.netSalesRevenue).toBe(500);
    expect(summary.amountReceived).toBe(500);
    expect(summary.customerAdvance).toBe(50);
    expect(summary.outstandingAmount).toBe(0);
    expect(summary.paymentStatus).toBe('paid');
  });

  it('allocates invoice discounts proportionally across lines', () => {
    const lines = allocateInvoiceDiscount(
      [
        { quantity: 2, actualSoldAmount: 50, discount: 0 },
        { quantity: 2, actualSoldAmount: 100, discount: 0 }
      ],
      30
    );
    expect(lines[0].allocatedInvoiceDiscount).toBe(10);
    expect(lines[1].allocatedInvoiceDiscount).toBe(20);
    expect(lines[0].netRevenue).toBe(90);
    expect(lines[1].netRevenue).toBe(180);
  });
});
