import mongoose, { Schema, Document, Connection } from 'mongoose';

export const EXPENSE_CATEGORIES = [
  'personal',
  'rent',
  'utilities',
  'transport',
  'salary',
  'maintenance',
  'other'
] as const;
export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number];

export interface IExpense extends Document {
  title: string;
  amount: number;
  category: ExpenseCategory;
  expenseDate: Date;
  notes?: string;
  businessUnitId?: mongoose.Types.ObjectId;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

const ExpenseSchema: Schema = new Schema({
  title: { type: String, required: true, trim: true },
  amount: { type: Number, required: true, min: 0 },
  category: { type: String, enum: EXPENSE_CATEGORIES, required: true, default: 'other' },
  expenseDate: { type: Date, required: true },
  notes: { type: String, trim: true },
  businessUnitId: { type: mongoose.Schema.Types.ObjectId, ref: 'BusinessUnit' },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' }
}, {
  timestamps: true
});

export const getExpenseModel = (connection: Connection) => {
  return (connection.models.Expense as mongoose.Model<IExpense>)
    || connection.model<IExpense>('Expense', ExpenseSchema);
};
