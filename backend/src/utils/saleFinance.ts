import { money2, mulMoney } from './money';

export const PAYMENT_METHODS = ['cash', 'upi', 'card', 'bank', 'credit', 'other'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_STATUSES = ['paid', 'partially_paid', 'unpaid'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export type SalePaymentInput = {
  amount: number;
  method: string;
  reference?: string;
  notes?: string;
  paidAt?: Date | string;
  createdBy?: string;
  idempotencyKey?: string;
};

export const normalizePaymentMethod = (value?: string): PaymentMethod => {
  const method = String(value || 'cash').trim().toLowerCase();
  if ((PAYMENT_METHODS as readonly string[]).includes(method)) {
    return method as PaymentMethod;
  }
  if (method === 'bank transfer' || method === 'bank_transfer') return 'bank';
  return 'other';
};

export const lineNetRevenue = (item: {
  quantity?: number;
  actualSoldAmount?: number;
  price?: number;
  discount?: number;
}) => {
  const qty = Number(item.quantity || 0);
  const unit = Number(item.actualSoldAmount ?? item.price ?? 0);
  const discount = Number(item.discount || 0);
  return money2(Math.max(0, mulMoney(qty, unit) - discount));
};

export const allocateInvoiceDiscount = (
  items: Array<Record<string, any>>,
  invoiceDiscount: number
): Array<Record<string, any>> => {
  const discount = Math.max(0, Number(invoiceDiscount || 0));
  if (!discount || !items.length) {
    return items.map((item) => ({
      ...item,
      allocatedInvoiceDiscount: 0,
      netRevenue: lineNetRevenue(item)
    }));
  }

  const bases = items.map((item) => Math.max(0, lineNetRevenue(item)));
  const baseTotal = bases.reduce((sum, value) => sum + value, 0);
  if (baseTotal <= 0) {
    return items.map((item) => ({
      ...item,
      allocatedInvoiceDiscount: 0,
      netRevenue: 0
    }));
  }

  let allocated = 0;
  return items.map((item, index) => {
    const share =
      index === items.length - 1
        ? money2(discount - allocated)
        : money2((bases[index] / baseTotal) * discount);
    allocated = money2(allocated + share);
    const netRevenue = money2(Math.max(0, bases[index] - share));
    return {
      ...item,
      allocatedInvoiceDiscount: share,
      netRevenue
    };
  });
};

export const summarizeSaleFinance = (sale: {
  items?: Array<Record<string, any>>;
  discount?: number;
  gst?: number;
  total?: number;
  payments?: Array<{ amount?: number; status?: string }>;
  paidAmount?: number;
}) => {
  const invoiceDiscount = Number(sale.discount || 0);
  const lines = allocateInvoiceDiscount(sale.items || [], invoiceDiscount);
  const netSalesRevenue = money2(lines.reduce((sum, item) => sum + Number(item.netRevenue || 0), 0));
  const totalCogs = money2(lines.reduce((sum, item) => sum + Number(item.cogs || 0), 0));
  const grossProfit = money2(netSalesRevenue - totalCogs);
  const grossMarginPercent = netSalesRevenue > 0 ? money2((grossProfit / netSalesRevenue) * 100) : 0;
  const tax = money2(Number(sale.gst || 0));
  const invoiceTotal = money2(Number(sale.total ?? netSalesRevenue + tax));

  const activePayments = (sale.payments || []).filter((payment) => payment.status !== 'reversed');
  const amountReceived = money2(
    activePayments.length
      ? activePayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
      : Number(sale.paidAmount || 0)
  );

  const appliedToInvoice = money2(Math.min(amountReceived, invoiceTotal));
  const customerAdvance = money2(Math.max(0, amountReceived - invoiceTotal));
  const outstandingAmount = money2(Math.max(0, invoiceTotal - appliedToInvoice));
  const paymentStatus: PaymentStatus =
    outstandingAmount <= 0 ? 'paid' : appliedToInvoice > 0 ? 'partially_paid' : 'unpaid';

  return {
    lines,
    netSalesRevenue,
    totalCogs,
    grossProfit,
    grossMarginPercent,
    tax,
    invoiceTotal,
    amountReceived: appliedToInvoice,
    customerAdvance,
    outstandingAmount,
    paymentStatus,
    collectionPercent: invoiceTotal > 0 ? money2((appliedToInvoice / invoiceTotal) * 100) : 0
  };
};

export const buildInitialPayment = (input: {
  amount: number;
  method?: string;
  reference?: string;
  notes?: string;
  createdBy?: string;
  paidAt?: Date;
  idempotencyKey?: string;
}) => ({
  amount: money2(Math.max(0, Number(input.amount || 0))),
  method: normalizePaymentMethod(input.method),
  reference: String(input.reference || '').trim() || undefined,
  notes: String(input.notes || '').trim() || undefined,
  paidAt: input.paidAt || new Date(),
  createdBy: input.createdBy,
  idempotencyKey: input.idempotencyKey,
  status: 'active' as const
});
