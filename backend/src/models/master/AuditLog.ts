import mongoose, { Schema, Document } from 'mongoose';

export interface IAuditLog extends Document {
  tenantId: string;
  businessId: mongoose.Schema.Types.ObjectId;
  userId: mongoose.Schema.Types.ObjectId;
  action: string;
  entity: string;
  entityId?: string;
  changes?: object;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

const AuditLogSchema: Schema = new Schema({
  tenantId: { type: String, required: true, index: true },
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  action: { type: String, required: true },
  entity: { type: String, required: true },
  entityId: { type: String },
  changes: { type: Schema.Types.Mixed },
  ipAddress: { type: String },
  userAgent: { type: String },
}, {
  timestamps: { createdAt: true, updatedAt: false }
});

export default mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
