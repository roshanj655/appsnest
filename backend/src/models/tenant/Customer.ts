import mongoose, { Schema, Document, Connection } from 'mongoose';

export interface ICustomer extends Document {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
  gstin: string;
  creditLimit: number;
  notes: string;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

const CustomerSchema: Schema = new Schema({
  name: { type: String, required: true },
  email: { type: String },
  phone: { type: String, required: true },
  address: { type: String },
  city: { type: String },
  state: { type: String },
  country: { type: String, default: 'India' },
  pincode: { type: String },
  gstin: { type: String },
  creditLimit: { type: Number, default: 0 },
  notes: { type: String },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
}, {
  timestamps: true
});

export const getCustomerModel = (connection: Connection) => {
  return (connection.models.Customer as mongoose.Model<ICustomer>)
    || connection.model<ICustomer>('Customer', CustomerSchema);
};
