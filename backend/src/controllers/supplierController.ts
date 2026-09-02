import { Response } from 'express';
import { TenantRequest } from '../middleware/tenant';
import { getSupplierModel } from '../models/tenant/Supplier';
import { logAuditEvent } from '../utils/auditLogger';

import { paginatedResult, parsePagination, textSearch } from '../utils/pagination';

export const getSuppliers = async (req: TenantRequest, res: Response) => {
  try {
    const Supplier = getSupplierModel(req.tenantDB!);
    const { page, limit, skip, search } = parsePagination(req.query);
    const filter = textSearch(search, ['name', 'phone', 'email', 'gstin']);
    const [items, total] = await Promise.all([
      Supplier.find(filter).sort({ name: 1 }).skip(skip).limit(limit),
      Supplier.countDocuments(filter)
    ]);
    res.json(paginatedResult(items, total, page, limit));
  } catch (error) {
    res.status(500).json({ message: 'Error fetching suppliers' });
  }
};

export const createSupplier = async (req: TenantRequest, res: Response) => {
  try {
    const Supplier = getSupplierModel(req.tenantDB!);
    const supplier = await Supplier.create(req.body);

    if (req.user && req.business) {
      await logAuditEvent({
        user: req.user as any,
        business: req.business,
        action: 'CREATE',
        entity: 'Supplier',
        entityId: supplier._id.toString(),
        changes: req.body,
        req
      });
    }

    res.status(201).json(supplier);
  } catch (error) {
    res.status(500).json({ message: 'Error creating supplier' });
  }
};

export const updateSupplier = async (req: TenantRequest, res: Response) => {
  try {
    const Supplier = getSupplierModel(req.tenantDB!);
    const entityId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const supplier = await Supplier.findByIdAndUpdate(entityId, req.body, { new: true });

    if (req.user && req.business && entityId) {
      await logAuditEvent({
        user: req.user as any,
        business: req.business,
        action: 'UPDATE',
        entity: 'Supplier',
        entityId,
        changes: req.body,
        req
      });
    }

    res.json(supplier);
  } catch (error) {
    res.status(500).json({ message: 'Error updating supplier' });
  }
};

export const deleteSupplier = async (req: TenantRequest, res: Response) => {
  try {
    const Supplier = getSupplierModel(req.tenantDB!);
    const entityId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    await Supplier.findByIdAndDelete(entityId);

    if (req.user && req.business && entityId) {
      await logAuditEvent({
        user: req.user as any,
        business: req.business,
        action: 'DELETE',
        entity: 'Supplier',
        entityId,
        req
      });
    }

    res.json({ message: 'Supplier deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting supplier' });
  }
};
