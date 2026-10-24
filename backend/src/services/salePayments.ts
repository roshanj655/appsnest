import { Connection, Types } from 'mongoose';
import { getSaleModel } from '../models/tenant/Sale';
import { getCustomerModel } from '../models/tenant/Customer';
import {
  buildInitialPayment,
  summarizeSaleFinance,
  type SalePaymentInput
} from '../utils/saleFinance';
import { money2 } from '../utils/money';

export const applyFinanceSnapshot = (sale: any) => {
  const summary = summarizeSaleFinance(sale);
  sale.items = summary.lines.map((item) => {
    const taxBase = Number(item.netRevenue || 0);
    const taxAmount = money2((taxBase * Number(item.gst || 0)) / 100);
    return {
      ...item,
      taxAmount,
      grossProfit: money2(Number(item.netRevenue || 0) - Number(item.cogs || 0)),
      total: money2(taxBase + taxAmount)
    };
  });
  sale.netSalesRevenue = summary.netSalesRevenue;
  sale.totalCogs = summary.totalCogs;
  sale.grossProfit = summary.grossProfit;
  sale.grossMarginPercent = summary.grossMarginPercent;
  sale.amountReceived = summary.amountReceived;
  sale.paidAmount = summary.amountReceived;
  sale.outstandingAmount = summary.outstandingAmount;
  sale.customerAdvance = summary.customerAdvance;
  sale.paymentStatus = summary.paymentStatus;
  sale.changeAmount = summary.customerAdvance;
  return summary;
};

export const syncCustomerBalances = async (connection: Connection, customerId?: string | Types.ObjectId | null) => {
  if (!customerId) return;
  const Sale = getSaleModel(connection);
  const Customer = getCustomerModel(connection);
  const rows = await Sale.aggregate([
    {
      $match: {
        customerId: new Types.ObjectId(String(customerId)),
        status: { $ne: 'cancelled' }
      }
    },
    {
      $group: {
        _id: null,
        outstanding: { $sum: '$outstandingAmount' },
        advance: { $sum: '$customerAdvance' }
      }
    }
  ]);
  await Customer.findByIdAndUpdate(customerId, {
    outstandingBalance: money2(rows[0]?.outstanding || 0),
    advanceBalance: money2(rows[0]?.advance || 0)
  });
};

export const recordSalePayment = async (
  connection: Connection,
  saleId: string,
  input: SalePaymentInput,
  createdBy?: string
) => {
  const Sale = getSaleModel(connection);
  const sale = await Sale.findById(saleId);
  if (!sale) {
    const error: any = new Error('Sale not found');
    error.status = 404;
    throw error;
  }
  if (sale.status === 'cancelled') {
    const error: any = new Error('Cannot record payment on a cancelled sale.');
    error.status = 400;
    throw error;
  }

  const amount = money2(Number(input.amount || 0));
  if (amount <= 0) {
    const error: any = new Error('Payment amount must be greater than zero.');
    error.status = 400;
    throw error;
  }

  if (input.idempotencyKey) {
    const existing = (sale.payments || []).find(
      (payment: any) => payment.idempotencyKey === input.idempotencyKey && payment.status === 'active'
    );
    if (existing) {
      applyFinanceSnapshot(sale);
      await sale.save();
      return sale;
    }
  }

  const payment = buildInitialPayment({
    amount,
    method: input.method,
    reference: input.reference,
    notes: input.notes,
    paidAt: input.paidAt ? new Date(input.paidAt) : new Date(),
    createdBy,
    idempotencyKey: input.idempotencyKey
  });

  sale.payments = [...(sale.payments || []), payment as any];
  if (!sale.paymentMode || sale.paymentMode === 'credit') {
    sale.paymentMode = payment.method;
  }
  applyFinanceSnapshot(sale);
  await sale.save();
  await syncCustomerBalances(connection, sale.customerId as any);
  return sale;
};

export const reverseSalePayment = async (
  connection: Connection,
  saleId: string,
  paymentId: string,
  reason: string,
  reversedBy?: string
) => {
  const Sale = getSaleModel(connection);
  const sale = await Sale.findById(saleId);
  if (!sale) {
    const error: any = new Error('Sale not found');
    error.status = 404;
    throw error;
  }
  const payment = (sale.payments || []).find((row: any) => String(row._id) === String(paymentId));
  if (!payment) {
    const error: any = new Error('Payment not found');
    error.status = 404;
    throw error;
  }
  if (payment.status === 'reversed') {
    const error: any = new Error('Payment is already reversed.');
    error.status = 400;
    throw error;
  }
  payment.status = 'reversed';
  payment.reversedAt = new Date();
  payment.reversedBy = reversedBy;
  payment.reverseReason = reason;
  applyFinanceSnapshot(sale);
  await sale.save();
  await syncCustomerBalances(connection, sale.customerId as any);
  return sale;
};
