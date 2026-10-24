import mongoose, { Schema, Document, Connection } from 'mongoose';

export interface ISaleItem extends Document {
  productId: mongoose.Schema.Types.ObjectId;
  quantity: number;
  sellingPrice: number;
  maxSellingPrice?: number;
  minSellingPrice?: number;
  actualSoldAmount: number;
  price: number;
  discount: number;
  allocatedInvoiceDiscount?: number;
  netRevenue?: number;
  gst: number;
  taxAmount?: number;
  total: number;
  productName?: string;
  barcode?: string;
  categoryId?: mongoose.Types.ObjectId;
  brand?: string;
  variantId?: mongoose.Types.ObjectId;
  variantName?: string;
  costPrice?: number;
  costPerUnit?: number;
  cogs?: number;
  grossProfit?: number;
  priceOverrideReason?: string;
  priceApprovedBy?: string;
}

export interface ISalePayment {
  _id?: mongoose.Types.ObjectId;
  amount: number;
  method: string;
  reference?: string;
  notes?: string;
  paidAt: Date;
  createdBy?: string;
  idempotencyKey?: string;
  status: 'active' | 'reversed';
  reversedAt?: Date;
  reversedBy?: string;
  reverseReason?: string;
}

export interface IAttachment {
  _id?: mongoose.Types.ObjectId;
  originalName: string;
  filename: string;
  path: string;
  size: number;
  mimetype: string;
}

export interface ISale extends Document {
  invoiceNumber: string;
  customerId: mongoose.Schema.Types.ObjectId;
  items: ISaleItem[];
  subtotal: number;
  discount: number;
  gst: number;
  total: number;
  netSalesRevenue?: number;
  totalCogs?: number;
  grossProfit?: number;
  grossMarginPercent?: number;
  paymentMode: string;
  paymentDetails: object;
  paidAmount?: number;
  amountReceived?: number;
  outstandingAmount?: number;
  customerAdvance?: number;
  paymentStatus?: 'paid' | 'partially_paid' | 'unpaid';
  changeAmount?: number;
  payments: ISalePayment[];
  source: 'pos' | 'manual';
  status: 'draft' | 'completed' | 'cancelled';
  attachments: IAttachment[];
  returns: Array<{
    items: Array<{
      productId: mongoose.Types.ObjectId;
      variantId?: mongoose.Types.ObjectId;
      quantity: number;
      costPerUnit: number;
      cogs: number;
    }>;
    notes?: string;
    createdBy?: string;
    createdAt: Date;
  }>;
  businessUnitId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const SaleItemSchema: Schema = new Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, required: true, default: 1 },
  sellingPrice: { type: Number, default: 0 },
  maxSellingPrice: { type: Number, default: 0 },
  minSellingPrice: { type: Number, default: 0 },
  actualSoldAmount: { type: Number, default: 0 },
  price: { type: Number, required: true },
  discount: { type: Number, default: 0 },
  allocatedInvoiceDiscount: { type: Number, default: 0 },
  netRevenue: { type: Number, default: 0 },
  gst: { type: Number, default: 0 },
  taxAmount: { type: Number, default: 0 },
  total: { type: Number, required: true },
  productName: { type: String },
  barcode: { type: String },
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  brand: { type: String },
  variantId: { type: mongoose.Schema.Types.ObjectId },
  variantName: { type: String },
  costPrice: { type: Number, default: 0 },
  costPerUnit: { type: Number, default: 0 },
  cogs: { type: Number, default: 0 },
  grossProfit: { type: Number, default: 0 },
  priceOverrideReason: { type: String },
  priceApprovedBy: { type: String }
});

const SalePaymentSchema: Schema = new Schema({
  amount: { type: Number, required: true },
  method: { type: String, required: true, default: 'cash' },
  reference: { type: String },
  notes: { type: String },
  paidAt: { type: Date, default: Date.now },
  createdBy: { type: String },
  idempotencyKey: { type: String },
  status: { type: String, enum: ['active', 'reversed'], default: 'active' },
  reversedAt: { type: Date },
  reversedBy: { type: String },
  reverseReason: { type: String }
});

const AttachmentSchema: Schema = new Schema({
  originalName: { type: String, required: true },
  filename: { type: String, required: true },
  path: { type: String, required: true },
  size: { type: Number, required: true },
  mimetype: { type: String, required: true },
});

const SaleSchema: Schema = new Schema({
  invoiceNumber: { type: String, required: true, unique: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  items: [SaleItemSchema],
  subtotal: { type: Number, required: true },
  discount: { type: Number, default: 0 },
  gst: { type: Number, default: 0 },
  total: { type: Number, required: true },
  netSalesRevenue: { type: Number, default: 0 },
  totalCogs: { type: Number, default: 0 },
  grossProfit: { type: Number, default: 0 },
  grossMarginPercent: { type: Number, default: 0 },
  paymentMode: { type: String, default: 'cash' },
  paymentDetails: { type: Object },
  paidAmount: { type: Number, default: 0 },
  amountReceived: { type: Number, default: 0 },
  outstandingAmount: { type: Number, default: 0 },
  customerAdvance: { type: Number, default: 0 },
  paymentStatus: {
    type: String,
    enum: ['paid', 'partially_paid', 'unpaid'],
    default: 'unpaid'
  },
  changeAmount: { type: Number, default: 0 },
  payments: { type: [SalePaymentSchema], default: [] },
  source: { type: String, enum: ['pos', 'manual'], default: 'manual' },
  status: { type: String, enum: ['draft', 'completed', 'cancelled'], default: 'completed' },
  attachments: [AttachmentSchema],
  returns: { type: [{
    items: [{
      productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
      variantId: { type: mongoose.Schema.Types.ObjectId },
      quantity: { type: Number, required: true },
      costPerUnit: { type: Number, default: 0 },
      cogs: { type: Number, default: 0 }
    }],
    notes: { type: String },
    createdBy: { type: String },
    createdAt: { type: Date, default: Date.now }
  }], default: [] },
  businessUnitId: { type: mongoose.Schema.Types.ObjectId, ref: 'BusinessUnit' },
}, {
  timestamps: true
});

SaleSchema.index({ customerId: 1, createdAt: -1 });
SaleSchema.index({ businessUnitId: 1, createdAt: -1 });
SaleSchema.index({ 'items.productId': 1, createdAt: -1 });
SaleSchema.index({ paymentStatus: 1, createdAt: -1 });
SaleSchema.index({ 'payments.idempotencyKey': 1 });

export const getSaleModel = (connection: Connection) => {
  return (connection.models.Sale as mongoose.Model<ISale>)
    || connection.model<ISale>('Sale', SaleSchema);
};
