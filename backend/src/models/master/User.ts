import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcrypt';
import { ALL_PERMISSIONS, USER_ROLES, type Permission, type UserRole } from '../../constants/permissions';

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  phone: string;
  businessId?: mongoose.Types.ObjectId;
  role: UserRole;
  permissions?: Permission[];
  deniedPermissions?: Permission[];
  refreshToken?: string;
  comparePassword(candidatePassword: string): Promise<boolean>;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true, select: false },
  phone: { type: String },
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Business',
    required: function (this: { role: UserRole }) {
      return this.role !== 'superadmin';
    }
  },
  role: { type: String, enum: USER_ROLES, default: 'staff' },
  permissions: [{ type: String, enum: ALL_PERMISSIONS }],
  deniedPermissions: [{ type: String, enum: ALL_PERMISSIONS }],
  refreshToken: { type: String },
}, {
  timestamps: true
});

UserSchema.pre('save', async function () {
  const user = this as any;
  if (!user.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  user.password = await bcrypt.hash(user.password, salt);
});

UserSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  const user = this as any;
  return await bcrypt.compare(candidatePassword, user.password);
};

export default mongoose.model<IUser>('User', UserSchema);
