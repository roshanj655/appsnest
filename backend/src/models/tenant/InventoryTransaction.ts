import mongoose, { Schema, Document, Connection } from 'mongoose';

export const INVENTORY_TRANSACTION_TYPES = [
  'OPENING',
  'PURCHASE',
  'PURCHASE_RETURN',
  'SALE',
  'SALE_RETURN',
  'DAMAGE',
  'EXPIRY',
  'ADJUSTMENT',
  'TRANSFER_IN',
  'TRANSFER_OUT'
] as const;

export type InventoryTransactionType = typeof INVENTORY_TRANSACTION_TYPES[number];

export interface IInventoryTransaction extends Document {
  productId: mongoose.Types.ObjectId;
  variantId?: mongoose.Types.ObjectId;
  variantName?: string;
  warehouseId?: mongoose.Types.ObjectId;
  businessUnitId?: mongoose.Types.ObjectId;
  transactionType: InventoryTransactionType;
  quantity: number;
  direction: 'in' | 'out';
  source: 'sale' | 'purchase' | 'adjustment' | 'opening' | 'return';
  sourceId?: string;
  unitCost: number;
  totalCost: number;
  averageCostAfter: number;
  stockAfter: number;
  inventoryValueAfter: number;
  referenceType?: string;
  referenceId?: string;
  originalTransactionId?: mongoose.Types.ObjectId;
  notes?: string;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const InventoryTransactionSchema: Schema = new Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: mongoose.Schema.Types.ObjectId },
  variantName: { type: String },
  warehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'BusinessUnit' },
  businessUnitId: { type: mongoose.Schema.Types.ObjectId, ref: 'BusinessUnit' },
  transactionType: { type: String, enum: INVENTORY_TRANSACTION_TYPES, required: true },
  quantity: { type: Number, required: true },
  direction: { type: String, enum: ['in', 'out'], required: true },
  source: { type: String, enum: ['sale', 'purchase', 'adjustment', 'opening', 'return'], required: true },
  sourceId: { type: String },
  unitCost: { type: Number, default: 0 },
  totalCost: { type: Number, default: 0 },
  averageCostAfter: { type: Number, default: 0 },
  stockAfter: { type: Number, required: true, default: 0 },
  inventoryValueAfter: { type: Number, default: 0 },
  referenceType: { type: String },
  referenceId: { type: String },
  originalTransactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryTransaction' },
  notes: { type: String },
  createdBy: { type: String }
}, {
  timestamps: true
});

InventoryTransactionSchema.index({ productId: 1, variantId: 1, createdAt: -1 });
InventoryTransactionSchema.index({ warehouseId: 1, productId: 1, createdAt: -1 });
InventoryTransactionSchema.index({ businessUnitId: 1, createdAt: -1 });
InventoryTransactionSchema.index({ transactionType: 1, createdAt: -1 });
InventoryTransactionSchema.index({ referenceId: 1, transactionType: 1 });
InventoryTransactionSchema.index({ sourceId: 1, source: 1 });

export const getInventoryTransactionModel = (connection: Connection) => {
  return (connection.models.InventoryTransaction as mongoose.Model<IInventoryTransaction>)
    || connection.model<IInventoryTransaction>('InventoryTransaction', InventoryTransactionSchema);
};
