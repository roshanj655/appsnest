import mongoose, { Schema, Document, Connection } from 'mongoose';

export const STOCK_REASONS = ['opening', 'found', 'damage', 'loss', 'return', 'correction', 'other'] as const;
export type StockReason = typeof STOCK_REASONS[number];

export interface IStockAdjustment extends Document {
  productId: mongoose.Types.ObjectId;
  variantId?: mongoose.Types.ObjectId;
  variantName?: string;
  quantity: number;
  direction: 'in' | 'out';
  reason: StockReason;
  notes?: string;
  businessUnitId?: mongoose.Types.ObjectId;
  status: 'active' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
}

const StockAdjustmentSchema: Schema = new Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: mongoose.Schema.Types.ObjectId },
  variantName: { type: String },
  quantity: { type: Number, required: true, min: 1 },
  direction: { type: String, enum: ['in', 'out'], required: true },
  reason: { type: String, enum: STOCK_REASONS, required: true },
  notes: { type: String, trim: true },
  businessUnitId: { type: mongoose.Schema.Types.ObjectId, ref: 'BusinessUnit' },
  status: { type: String, enum: ['active', 'cancelled'], default: 'active' }
}, {
  timestamps: true
});

export const getStockAdjustmentModel = (connection: Connection) => {
  return (connection.models.StockAdjustment as mongoose.Model<IStockAdjustment>)
    || connection.model<IStockAdjustment>('StockAdjustment', StockAdjustmentSchema);
};
