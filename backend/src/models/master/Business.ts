import mongoose, { Schema, Document } from 'mongoose';

export interface IBusiness extends Document {
  tenantId: string;
  businessName: string;
  ownerName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
  businessType: string;
  databaseProvider: string;
  atlasProjectName: string;
  clusterName: string;
  databaseName: string;
  connectionString: string;
  status: 'active' | 'inactive' | 'suspended';
  subscriptionPlan: string;
  subscriptionStartsAt?: Date | null;
  subscriptionEndsAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const BusinessSchema: Schema = new Schema({
  tenantId: { type: String, required: true, unique: true },
  businessName: { type: String, required: true },
  ownerName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  address: { type: String },
  city: { type: String },
  state: { type: String },
  country: { type: String, default: 'India' },
  pincode: { type: String },
  businessType: { type: String },
  databaseProvider: { type: String, required: true, default: 'atlas' },
  atlasProjectName: { type: String },
  clusterName: { type: String },
  databaseName: { type: String, required: true, unique: true },
  connectionString: { type: String, required: true },
  status: { type: String, enum: ['active', 'inactive', 'suspended'], default: 'active' },
  subscriptionPlan: { type: String, default: 'basic' },
  subscriptionStartsAt: { type: Date },
  subscriptionEndsAt: { type: Date },
}, {
  timestamps: true
});

export default mongoose.model<IBusiness>('Business', BusinessSchema);
