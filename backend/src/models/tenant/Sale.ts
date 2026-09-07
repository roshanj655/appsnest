import mongoose, { Schema, Document, Connection } from 'mongoose';

export interface ISaleItem extends Document {
  productId: mongoose.Schema.Types.ObjectId;
  quantity: number;
  sellingPrice: number;
  actualSoldAmount: number;
  price: number;
  discount: number;
  gst: number;
  total: number;
  productName?: string;
  barcode?: string;
  variantId?: mongoose.Types.ObjectId;
  variantName?: string;
  costPrice?: number;
  costPerUnit?: number;
  cogs?: number;
  grossProfit?: number;
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
  paymentMode: string;
  paymentDetails: object;
  paidAmount?: number;
  changeAmount?: number;
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
  actualSoldAmount: { type: Number, default: 0 },
  price: { type: Number, required: true },
  discount: { type: Number, default: 0 },
  gst: { type: Number, default: 0 },
  total: { type: Number, required: true },
  productName: { type: String },
  barcode: { type: String },
  variantId: { type: mongoose.Schema.Types.ObjectId },
  variantName: { type: String },
  costPrice: { type: Number, default: 0 },
  costPerUnit: { type: Number, default: 0 },
  cogs: { type: Number, default: 0 },
  grossProfit: { type: Number, default: 0 }
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
  paymentMode: { type: String, default: 'cash' },
  paymentDetails: { type: Object },
  paidAmount: { type: Number, default: 0 },
  changeAmount: { type: Number, default: 0 },
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

export const getSaleModel = (connection: Connection) => {
  return (connection.models.Sale as mongoose.Model<ISale>)
    || connection.model<ISale>('Sale', SaleSchema);
};
