import mongoose, { Schema, Document, Connection } from 'mongoose';

export interface ICategory extends Document {
  name: string;
  parentId?: mongoose.Schema.Types.ObjectId;
  description?: string;
  businessUnitId?: mongoose.Types.ObjectId;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

const CategorySchema: Schema = new Schema({
  name: { type: String, required: true },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  description: { type: String },
  businessUnitId: { type: mongoose.Schema.Types.ObjectId, ref: 'BusinessUnit' },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
}, {
  timestamps: true
});

export const getCategoryModel = (connection: Connection) => {
  return (connection.models.Category as mongoose.Model<ICategory>)
    || connection.model<ICategory>('Category', CategorySchema);
};
