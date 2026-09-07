import mongoose, { Schema, Document, Connection } from 'mongoose';

export interface IProductVariant {
  _id?: mongoose.Types.ObjectId;
  name: string;
  sku?: string;
  barcode?: string;
  attributes?: string;
  purchasePrice: number;
  sellingPrice: number;
  stock: number;
  averageCost: number;
  lastPurchaseCost: number;
  lastPurchaseDate?: Date;
  inventoryValue: number;
}

export interface IProduct extends Document {
  name: string;
  sku: string;
  barcode: string;
  qrCode: string;
  categoryId: mongoose.Schema.Types.ObjectId;
  brand: string;
  manufacturer: string;
  unit: string;
  purchasePrice: number;
  sellingPrice: number;
  onlinePrice: number;
  onlineVisible: boolean;
  mrp: number;
  stock: number;
  averageCost: number;
  lastPurchaseCost: number;
  lastPurchaseDate?: Date;
  inventoryValue: number;
  minStock: number;
  maxStock: number;
  location: string;
  gst: number;
  hsn: string;
  description: string;
  notes: string;
  images: string[];
  variants: IProductVariant[];
  businessUnitId?: mongoose.Types.ObjectId;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

const costingFields = {
  averageCost: { type: Number, default: 0 },
  lastPurchaseCost: { type: Number, default: 0 },
  lastPurchaseDate: { type: Date },
  inventoryValue: { type: Number, default: 0 }
};

const VariantSchema: Schema = new Schema({
  name: { type: String, required: true },
  sku: { type: String },
  barcode: { type: String },
  attributes: { type: String },
  purchasePrice: { type: Number, default: 0 },
  sellingPrice: { type: Number, default: 0 },
  stock: { type: Number, default: 0 },
  ...costingFields
});

const ProductSchema: Schema = new Schema({
  name: { type: String, required: true },
  sku: { type: String, required: true, unique: true },
  barcode: { type: String },
  qrCode: { type: String },
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  brand: { type: String },
  manufacturer: { type: String },
  unit: { type: String, default: 'pcs' },
  purchasePrice: { type: Number, required: true, default: 0 },
  sellingPrice: { type: Number, required: true, default: 0 },
  onlinePrice: { type: Number, default: 0 },
  onlineVisible: { type: Boolean, default: false },
  mrp: { type: Number },
  stock: { type: Number, required: true, default: 0 },
  ...costingFields,
  minStock: { type: Number, default: 10 },
  maxStock: { type: Number, default: 0 },
  location: { type: String },
  gst: { type: Number, default: 0 },
  hsn: { type: String },
  description: { type: String },
  notes: { type: String },
  images: { type: [String] },
  variants: { type: [VariantSchema], default: [] },
  businessUnitId: { type: mongoose.Schema.Types.ObjectId, ref: 'BusinessUnit' },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
}, {
  timestamps: true
});

ProductSchema.index({ businessUnitId: 1, sku: 1 });
ProductSchema.index({ businessUnitId: 1, name: 1 });

export const getProductModel = (connection: Connection) => {
  return (connection.models.Product as mongoose.Model<IProduct>)
    || connection.model<IProduct>('Product', ProductSchema);
};
