import AuditLog from '../models/master/AuditLog';
import { IUser } from '../models/master/User';
import { IBusiness } from '../models/master/Business';

interface AuditLogData {
  user: IUser;
  business: IBusiness;
  action: string;
  entity: string;
  entityId?: string;
  changes?: any;
  req?: any;
}

export const logAuditEvent = async (data: AuditLogData): Promise<void> => {
  try {
    const { user, business, action, entity, entityId, changes, req } = data;

    const auditLog = new AuditLog({
      tenantId: business.tenantId,
      businessId: business._id,
      userId: user._id,
      action,
      entity,
      entityId,
      changes,
      ipAddress: req?.ip,
      userAgent: req?.headers?.['user-agent']
    });

    await auditLog.save();
  } catch (error) {
    console.error('Failed to log audit event:', error);
  }
};
