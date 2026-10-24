import mongoose, { Schema, Document, Connection } from 'mongoose';

export const LOAN_STATUSES = ['active', 'closed', 'cancelled'] as const;
export type LoanStatus = (typeof LOAN_STATUSES)[number];

export const LOAN_REPAYMENT_TYPES = ['principal', 'interest', 'mixed'] as const;
export type LoanRepaymentType = (typeof LOAN_REPAYMENT_TYPES)[number];

export interface ILoanRepayment {
  _id?: mongoose.Types.ObjectId;
  amount: number;
  principalAmount: number;
  interestAmount: number;
  type: LoanRepaymentType;
  method: string;
  reference?: string;
  notes?: string;
  paidAt: Date;
  createdBy?: string;
  status: 'active' | 'reversed';
  reversedAt?: Date;
  reverseReason?: string;
}

export interface ILoan extends Document {
  lenderName: string;
  phone?: string;
  purpose?: string;
  notes?: string;
  principalAmount: number;
  interestRate?: number;
  expectedInterest?: number;
  startDate: Date;
  dueDate?: Date;
  principalPaid: number;
  interestPaid: number;
  outstandingPrincipal: number;
  outstandingInterest: number;
  status: LoanStatus;
  repayments: ILoanRepayment[];
  linkedPurchaseIds?: mongoose.Types.ObjectId[];
  businessUnitId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const LoanRepaymentSchema: Schema = new Schema({
  amount: { type: Number, required: true, min: 0 },
  principalAmount: { type: Number, default: 0, min: 0 },
  interestAmount: { type: Number, default: 0, min: 0 },
  type: { type: String, enum: LOAN_REPAYMENT_TYPES, default: 'mixed' },
  method: { type: String, default: 'cash' },
  reference: { type: String },
  notes: { type: String },
  paidAt: { type: Date, default: Date.now },
  createdBy: { type: String },
  status: { type: String, enum: ['active', 'reversed'], default: 'active' },
  reversedAt: { type: Date },
  reverseReason: { type: String }
});

const LoanSchema: Schema = new Schema({
  lenderName: { type: String, required: true, trim: true },
  phone: { type: String, trim: true },
  purpose: { type: String, trim: true },
  notes: { type: String, trim: true },
  principalAmount: { type: Number, required: true, min: 0 },
  interestRate: { type: Number, default: 0, min: 0 },
  expectedInterest: { type: Number, default: 0, min: 0 },
  startDate: { type: Date, required: true },
  dueDate: { type: Date },
  principalPaid: { type: Number, default: 0, min: 0 },
  interestPaid: { type: Number, default: 0, min: 0 },
  outstandingPrincipal: { type: Number, default: 0, min: 0 },
  outstandingInterest: { type: Number, default: 0, min: 0 },
  status: { type: String, enum: LOAN_STATUSES, default: 'active' },
  repayments: { type: [LoanRepaymentSchema], default: [] },
  linkedPurchaseIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Purchase' }],
  businessUnitId: { type: mongoose.Schema.Types.ObjectId, ref: 'BusinessUnit' }
}, {
  timestamps: true
});

LoanSchema.index({ status: 1, startDate: -1 });
LoanSchema.index({ lenderName: 1 });
LoanSchema.index({ businessUnitId: 1, startDate: -1 });

export const getLoanModel = (connection: Connection) => {
  return (connection.models.Loan as mongoose.Model<ILoan>)
    || connection.model<ILoan>('Loan', LoanSchema);
};
