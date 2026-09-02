import mongoose, { Schema, Document, Connection } from 'mongoose';

export interface ISupplier extends Document {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
  gstin: string;
  notes: string;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

const SupplierSchema: Schema = new Schema({
  name: { type: String, required: true },
  email: { type: String },
  phone: { type: String, required: true },
  address: { type: String },
  city: { type: String },
  state: { type: String },
  country: { type: String, default: 'India' },
  pincode: { type: String },
  gstin: { type: String },
  notes: { type: String },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
}, {
  timestamps: true
});

export const getSupplierModel = (connection: Connection) => {
  return (connection.models.Supplier as mongoose.Model<ISupplier>)
    || connection.model<ISupplier>('Supplier', SupplierSchema);
};
