import mongoose, { Schema, Document, Connection } from 'mongoose';

export interface IBusinessUnit extends Document {
  name: string;
  code: string;
  notes?: string;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

const BusinessUnitSchema: Schema = new Schema({
  name: { type: String, required: true, trim: true },
  code: { type: String, required: true, trim: true, uppercase: true },
  notes: { type: String, trim: true },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' }
}, {
  timestamps: true
});

export const getBusinessUnitModel = (connection: Connection) => {
  return (connection.models.BusinessUnit as mongoose.Model<IBusinessUnit>)
    || connection.model<IBusinessUnit>('BusinessUnit', BusinessUnitSchema);
};
