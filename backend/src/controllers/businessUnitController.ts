import { Response } from 'express';
import { TenantRequest } from '../middleware/tenant';
import { getBusinessUnitModel } from '../models/tenant/BusinessUnit';
import { logAuditEvent } from '../utils/auditLogger';
import { paginatedResult, parsePagination, textSearch } from '../utils/pagination';

const DEFAULT_UNITS = [
  { name: 'Disposable', code: 'DISP', notes: 'Disposable products division' },
  { name: 'Puja Samagri', code: 'PUJA', notes: 'Puja and ritual supplies' },
  { name: 'General Store', code: 'STORE', notes: 'General retail' }
];

export const ensureDefaultUnits = async (req: TenantRequest) => {
  const BusinessUnit = getBusinessUnitModel(req.tenantDB!);
  const count = await BusinessUnit.countDocuments();
  if (count === 0) {
    await BusinessUnit.insertMany(DEFAULT_UNITS.map((unit) => ({ ...unit, status: 'active' })));
  }
};

export const getBusinessUnits = async (req: TenantRequest, res: Response) => {
  try {
    await ensureDefaultUnits(req);
    const BusinessUnit = getBusinessUnitModel(req.tenantDB!);
    const { page, limit, skip, search } = parsePagination(req.query);
    const filter = textSearch(search, ['name', 'code']);
    const [items, total] = await Promise.all([
      BusinessUnit.find(filter).sort({ name: 1 }).skip(skip).limit(limit),
      BusinessUnit.countDocuments(filter)
    ]);
    res.json(paginatedResult(items, total, page, limit));
  } catch (error) {
    console.error('Error fetching business units:', error);
    res.status(500).json({ message: 'Error fetching business units' });
  }
};

export const createBusinessUnit = async (req: TenantRequest, res: Response) => {
  try {
    const name = String(req.body?.name || '').trim();
    const code = String(req.body?.code || '').trim().toUpperCase();
    if (!name || !code) {
      return res.status(400).json({ message: 'Name and code are required.' });
    }
    const BusinessUnit = getBusinessUnitModel(req.tenantDB!);
    const existing = await BusinessUnit.findOne({ code });
    if (existing) {
      return res.status(409).json({ message: 'A unit with this code already exists.' });
    }
    const unit = await BusinessUnit.create({
      name,
      code,
      notes: typeof req.body?.notes === 'string' ? req.body.notes.trim() : undefined,
      status: 'active'
    });
    if (req.user && req.business) {
      await logAuditEvent({
        user: req.user as any,
        business: req.business,
        action: 'CREATE',
        entity: 'BusinessUnit',
        entityId: unit._id.toString(),
        changes: { name, code },
        req
      });
    }
    res.status(201).json(unit);
  } catch (error) {
    res.status(500).json({ message: 'Error creating business unit' });
  }
};

export const updateBusinessUnit = async (req: TenantRequest, res: Response) => {
  try {
    const entityId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const BusinessUnit = getBusinessUnitModel(req.tenantDB!);
    const updates: Record<string, unknown> = {};
    if (req.body?.name !== undefined) {
      updates.name = String(req.body.name).trim();
    }
    if (req.body?.code !== undefined) {
      updates.code = String(req.body.code).trim().toUpperCase();
    }
    if (typeof req.body?.notes === 'string') {
      updates.notes = req.body.notes.trim();
    }
    if (req.body?.status === 'active' || req.body?.status === 'inactive') {
      updates.status = req.body.status;
    }
    const unit = await BusinessUnit.findByIdAndUpdate(entityId, updates, { new: true });
    if (!unit) {
      return res.status(404).json({ message: 'Business unit not found' });
    }
    if (req.user && req.business && entityId) {
      await logAuditEvent({
        user: req.user as any,
        business: req.business,
        action: 'UPDATE',
        entity: 'BusinessUnit',
        entityId,
        changes: updates,
        req
      });
    }
    res.json(unit);
  } catch (error) {
    res.status(500).json({ message: 'Error updating business unit' });
  }
};

export const deleteBusinessUnit = async (req: TenantRequest, res: Response) => {
  try {
    const entityId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const BusinessUnit = getBusinessUnitModel(req.tenantDB!);
    await BusinessUnit.findByIdAndDelete(entityId);
    if (req.user && req.business && entityId) {
      await logAuditEvent({
        user: req.user as any,
        business: req.business,
        action: 'DELETE',
        entity: 'BusinessUnit',
        entityId,
        req
      });
    }
    res.json({ message: 'Business unit deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting business unit' });
  }
};
