import mongoose, { Schema, Document, Connection } from 'mongoose';

export interface IInventoryTransaction extends Document {
  productId: mongoose.Types.ObjectId;
  variantId?: mongoose.Types.ObjectId;
  variantName?: string;
  quantity: number;
  direction: 'in' | 'out';
  source: 'sale' | 'purchase' | 'adjustment' | 'opening' | 'return';
  sourceId?: string;
  notes?: string;
  stockAfter: number;
  businessUnitId?: mongoose.Types.ObjectId;
  createdAt: Date;
}

const InventoryTransactionSchema: Schema = new Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: mongoose.Schema.Types.ObjectId },
  variantName: { type: String },
  quantity: { type: Number, required: true, min: 0 },
  direction: { type: String, enum: ['in', 'out'], required: true },
  source: { type: String, enum: ['sale', 'purchase', 'adjustment', 'opening', 'return'], required: true },
  sourceId: { type: String },
  notes: { type: String },
  stockAfter: { type: Number, required: true, default: 0 },
  businessUnitId: { type: mongoose.Schema.Types.ObjectId, ref: 'BusinessUnit' }
}, {
  timestamps: true
});

export const getInventoryTransactionModel = (connection: Connection) => {
  return (connection.models.InventoryTransaction as mongoose.Model<IInventoryTransaction>)
    || connection.model<IInventoryTransaction>('InventoryTransaction', InventoryTransactionSchema);
};
