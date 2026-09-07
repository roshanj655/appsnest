import mongoose, { Schema, Document, Connection } from 'mongoose';

export interface ISettings extends Document {
  businessName: string;
  phone: string;
  email: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  gstin?: string;
  pan?: string;
  currency: string;
  currencySymbol: string;
  invoicePrefix: string;
  purchaseInvoicePrefix: string;
  invoiceDueDays: number;
  thermalPrinterWidth: number;
  footerText?: string;
  logo?: string;
  taxEnabled: boolean;
  bankName?: string;
  bankBranch?: string;
  bankAccountName?: string;
  bankAccountNumber?: string;
  bankIfsc?: string;
  bankSwift?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUser?: string;
  smtpPass?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SettingsSchema: Schema = new Schema({
  businessName: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String, required: true },
  address: { type: String },
  city: { type: String },
  state: { type: String },
  country: { type: String, default: 'India' },
  pincode: { type: String },
  gstin: { type: String },
  pan: { type: String },
  currency: { type: String, default: 'INR' },
  currencySymbol: { type: String, default: '₹' },
  invoicePrefix: { type: String, default: 'INV' },
  purchaseInvoicePrefix: { type: String, default: 'PUR' },
  invoiceDueDays: { type: Number, default: 15 },
  thermalPrinterWidth: { type: Number, default: 58 },
  footerText: { type: String },
  logo: { type: String },
  taxEnabled: { type: Boolean, default: true },
  bankName: { type: String },
  bankBranch: { type: String },
  bankAccountName: { type: String },
  bankAccountNumber: { type: String },
  bankIfsc: { type: String },
  bankSwift: { type: String },
  smtpHost: { type: String },
  smtpPort: { type: Number },
  smtpSecure: { type: Boolean },
  smtpUser: { type: String },
  smtpPass: { type: String },
}, {
  timestamps: true
});

export const getSettingsModel = (connection: Connection) => {
  return connection.model<ISettings>('Settings', SettingsSchema);
};
