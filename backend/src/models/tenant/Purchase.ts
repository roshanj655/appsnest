import mongoose, { Schema, Document, Connection } from 'mongoose';

export interface IAttachment {
  _id?: mongoose.Types.ObjectId;
  originalName: string;
  filename: string;
  path: string;
  size: number;
  mimetype: string;
}

export interface IPurchaseItem extends Document {
  productId: mongoose.Schema.Types.ObjectId;
  quantity: number;
  price: number;
  discount: number;
  gst: number;
  total: number;
  variantId?: mongoose.Types.ObjectId;
  variantName?: string;
}

export interface IPurchase extends Document {
  invoiceNumber: string;
  supplierInvoiceNumber?: string;
  supplierId: mongoose.Schema.Types.ObjectId;
  items: IPurchaseItem[];
  subtotal: number;
  discount: number;
  gst: number;
  total: number;
  paidAmount: number;
  dueAmount: number;
  attachments: IAttachment[];
  status: 'draft' | 'completed' | 'cancelled';
  businessUnitId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PurchaseItemSchema: Schema = new Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, required: true, default: 1 },
  price: { type: Number, required: true },
  discount: { type: Number, default: 0 },
  gst: { type: Number, default: 0 },
  total: { type: Number, required: true },
  variantId: { type: mongoose.Schema.Types.ObjectId },
  variantName: { type: String }
});

const AttachmentSchema: Schema = new Schema({
  originalName: { type: String, required: true },
  filename: { type: String, required: true },
  path: { type: String, required: true },
  size: { type: Number, required: true },
  mimetype: { type: String, required: true },
});

const PurchaseSchema: Schema = new Schema({
  invoiceNumber: { type: String, required: true, unique: true },
  supplierInvoiceNumber: { type: String },
  supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
  items: [PurchaseItemSchema],
  subtotal: { type: Number, required: true },
  discount: { type: Number, default: 0 },
  gst: { type: Number, default: 0 },
  total: { type: Number, required: true },
  paidAmount: { type: Number, default: 0 },
  dueAmount: { type: Number, default: 0 },
  attachments: [AttachmentSchema],
  status: { type: String, enum: ['draft', 'completed', 'cancelled'], default: 'completed' },
  businessUnitId: { type: mongoose.Schema.Types.ObjectId, ref: 'BusinessUnit' },
}, {
  timestamps: true
});

export const getPurchaseModel = (connection: Connection) => {
  return (connection.models.Purchase as mongoose.Model<IPurchase>)
    || connection.model<IPurchase>('Purchase', PurchaseSchema);
};
