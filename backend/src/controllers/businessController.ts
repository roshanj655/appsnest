import { Response } from 'express';
import Business from '../models/master/Business';
import User from '../models/master/User';
import { AuthRequest } from '../middleware/auth';
import { closeTenantConnection, getTenantConnection } from '../utils/tenantConnection';
import { logAuditEvent } from '../utils/auditLogger';
import { toPublicBusiness } from '../utils/businessAccess';

const EDITABLE_FIELDS = [
  'businessName',
  'ownerName',
  'email',
  'phone',
  'address',
  'city',
  'state',
  'country',
  'pincode',
  'businessType',
  'subscriptionPlan',
  'atlasProjectName',
  'clusterName'
] as const;

const parseDate = (value: unknown): Date | undefined | null => {
  if (value === '' || value === null) {
    return null;
  }
  if (value === undefined) {
    return undefined;
  }
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  return date;
};

const applySubscriptionDates = (business: { subscriptionStartsAt?: Date | null; subscriptionEndsAt?: Date | null }, body: Record<string, unknown>) => {
  if ('subscriptionStartsAt' in body) {
    const startsAt = parseDate(body.subscriptionStartsAt);
    if (startsAt !== undefined) {
      business.subscriptionStartsAt = startsAt;
    }
  }
  if ('subscriptionEndsAt' in body) {
    const endsAt = parseDate(body.subscriptionEndsAt);
    if (endsAt !== undefined) {
      business.subscriptionEndsAt = endsAt;
    }
  }
};

export const getBusinesses = async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit), 10) || 20));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Business.find().select('-connectionString').sort({ createdAt: -1 }).skip(skip).limit(limit),
      Business.countDocuments()
    ]);

    res.json({
      items,
      total,
      page,
      limit,
      pages: Math.max(1, Math.ceil(total / limit) || 1)
    });
  } catch (error) {
    console.error('Error fetching businesses:', error);
    res.status(500).json({ message: 'Error fetching businesses' });
  }
};

export const updateBusiness = async (req: AuthRequest, res: Response) => {
  try {
    const business = await Business.findById(req.params.id);
    if (!business) {
      return res.status(404).json({ message: 'Business not found' });
    }

    for (const field of EDITABLE_FIELDS) {
      if (req.body[field] !== undefined) {
        (business as unknown as Record<string, unknown>)[field] = req.body[field];
      }
    }

    applySubscriptionDates(business, req.body);

    if (typeof req.body.connectionString === 'string' && req.body.connectionString.trim()) {
      business.connectionString = req.body.connectionString.trim();
    }

    await business.save();

    if (req.user) {
      await logAuditEvent({
        user: req.user,
        business,
        action: 'UPDATE',
        entity: 'Business',
        entityId: business._id.toString(),
        changes: req.body,
        req
      });
    }

    res.json(toPublicBusiness(business));
  } catch (error) {
    console.error('Error updating business:', error);
    res.status(500).json({ message: 'Error updating business' });
  }
};

export const updateBusinessStatus = async (req: AuthRequest, res: Response) => {
  try {
    const status = req.body.status as string;
    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({ message: 'Status must be active or inactive' });
    }

    const business = await Business.findById(req.params.id);
    if (!business) {
      return res.status(404).json({ message: 'Business not found' });
    }

    business.status = status;
    await business.save();

    if (req.user) {
      await logAuditEvent({
        user: req.user,
        business,
        action: status === 'active' ? 'ENABLE' : 'DISABLE',
        entity: 'Business',
        entityId: business._id.toString(),
        changes: { status },
        req
      });
    }

    res.json(toPublicBusiness(business));
  } catch (error) {
    console.error('Error updating business status:', error);
    res.status(500).json({ message: 'Error updating business status' });
  }
};

export const updateBusinessSubscription = async (req: AuthRequest, res: Response) => {
  try {
    const business = await Business.findById(req.params.id);
    if (!business) {
      return res.status(404).json({ message: 'Business not found' });
    }

    if (req.body.subscriptionPlan !== undefined) {
      business.subscriptionPlan = req.body.subscriptionPlan;
    }

    applySubscriptionDates(business, req.body);
    await business.save();

    if (req.user) {
      await logAuditEvent({
        user: req.user,
        business,
        action: 'UPDATE',
        entity: 'BusinessSubscription',
        entityId: business._id.toString(),
        changes: {
          subscriptionPlan: business.subscriptionPlan,
          subscriptionStartsAt: business.subscriptionStartsAt,
          subscriptionEndsAt: business.subscriptionEndsAt
        },
        req
      });
    }

    res.json(toPublicBusiness(business));
  } catch (error) {
    console.error('Error updating subscription:', error);
    res.status(500).json({ message: 'Error updating subscription' });
  }
};

export const deleteBusiness = async (req: AuthRequest, res: Response) => {
  try {
    const business = await Business.findById(req.params.id);
    if (!business) {
      return res.status(404).json({ message: 'Business not found' });
    }

    const businessId = business._id.toString();
    const tenantId = business.tenantId;

    if (req.user) {
      await logAuditEvent({
        user: req.user,
        business,
        action: 'DELETE',
        entity: 'Business',
        entityId: businessId,
        changes: { tenantId, businessName: business.businessName },
        req
      });
    }

    await closeTenantConnection(tenantId);

    try {
      const tenantConnection = await getTenantConnection(business);
      await tenantConnection.dropDatabase();
      await closeTenantConnection(tenantId);
    } catch (error) {
      console.error(`Failed to drop tenant database for ${tenantId}:`, error);
    }

    await User.deleteMany({ businessId: business._id });
    await Business.deleteOne({ _id: business._id });

    res.json({ message: 'Business deleted' });
  } catch (error) {
    console.error('Error deleting business:', error);
    res.status(500).json({ message: 'Error deleting business' });
  }
};
