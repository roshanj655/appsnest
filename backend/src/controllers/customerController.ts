import { Response } from 'express';
import { TenantRequest } from '../middleware/tenant';
import { getCustomerModel } from '../models/tenant/Customer';
import { logAuditEvent } from '../utils/auditLogger';

import { paginatedResult, parsePagination, textSearch } from '../utils/pagination';

export const getCustomers = async (req: TenantRequest, res: Response) => {
  try {
    const Customer = getCustomerModel(req.tenantDB!);
    const { page, limit, skip, search } = parsePagination(req.query);
    const filter = textSearch(search, ['name', 'phone', 'email', 'gstin']);
    const [items, total] = await Promise.all([
      Customer.find(filter).sort({ name: 1 }).skip(skip).limit(limit),
      Customer.countDocuments(filter)
    ]);
    res.json(paginatedResult(items, total, page, limit));
  } catch (error) {
    res.status(500).json({ message: 'Error fetching customers' });
  }
};

export const createCustomer = async (req: TenantRequest, res: Response) => {
  try {
    const Customer = getCustomerModel(req.tenantDB!);
    const customer = await Customer.create(req.body);

    if (req.user && req.business) {
      await logAuditEvent({
        user: req.user as any,
        business: req.business,
        action: 'CREATE',
        entity: 'Customer',
        entityId: customer._id.toString(),
        changes: req.body,
        req
      });
    }

    res.status(201).json(customer);
  } catch (error) {
    res.status(500).json({ message: 'Error creating customer' });
  }
};

export const updateCustomer = async (req: TenantRequest, res: Response) => {
  try {
    const Customer = getCustomerModel(req.tenantDB!);
    const entityId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const customer = await Customer.findByIdAndUpdate(entityId, req.body, { new: true });

    if (req.user && req.business && entityId) {
      await logAuditEvent({
        user: req.user as any,
        business: req.business,
        action: 'UPDATE',
        entity: 'Customer',
        entityId,
        changes: req.body,
        req
      });
    }

    res.json(customer);
  } catch (error) {
    res.status(500).json({ message: 'Error updating customer' });
  }
};

export const deleteCustomer = async (req: TenantRequest, res: Response) => {
  try {
    const Customer = getCustomerModel(req.tenantDB!);
    const entityId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    await Customer.findByIdAndDelete(entityId);

    if (req.user && req.business && entityId) {
      await logAuditEvent({
        user: req.user as any,
        business: req.business,
        action: 'DELETE',
        entity: 'Customer',
        entityId,
        req
      });
    }

    res.json({ message: 'Customer deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting customer' });
  }
};
