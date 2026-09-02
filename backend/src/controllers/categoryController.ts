import { Response } from 'express';
import { TenantRequest } from '../middleware/tenant';
import { getCategoryModel } from '../models/tenant/Category';
import { logAuditEvent } from '../utils/auditLogger';

import { paginatedResult, parsePagination, textSearch } from '../utils/pagination';
import { mergeFilters, resolveBusinessUnitId, unitScope } from '../utils/businessUnit';

export const getCategories = async (req: TenantRequest, res: Response) => {
  try {
    const Category = getCategoryModel(req.tenantDB!);
    const { page, limit, skip, search } = parsePagination(req.query);
    const filter = mergeFilters(textSearch(search, ['name']), unitScope(req));
    const [items, total] = await Promise.all([
      Category.find(filter).sort({ name: 1 }).skip(skip).limit(limit),
      Category.countDocuments(filter)
    ]);
    res.json(paginatedResult(items, total, page, limit));
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ message: 'Error fetching categories' });
  }
};

export const createCategory = async (req: TenantRequest, res: Response) => {
  try {
    const name = String(req.body?.name || '').trim();
    if (!name) {
      return res.status(400).json({ message: 'Category name is required.' });
    }

    const Category = getCategoryModel(req.tenantDB!);
    const existing = await Category.findOne({ name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
    if (existing) {
      return res.status(409).json({ message: 'A category with this name already exists.' });
    }

    const category = await Category.create({
      name,
      description: typeof req.body?.description === 'string' ? req.body.description.trim() : undefined,
      businessUnitId: resolveBusinessUnitId(req, req.body),
      status: req.body?.status === 'inactive' ? 'inactive' : 'active'
    });

    if (req.user && req.business) {
      await logAuditEvent({
        user: req.user as any,
        business: req.business,
        action: 'CREATE',
        entity: 'Category',
        entityId: category._id.toString(),
        changes: { name: category.name, status: category.status },
        req
      });
    }

    res.status(201).json(category);
  } catch (error: any) {
    console.error('Error creating category:', error);
    if (error?.name === 'ValidationError' || error?.name === 'CastError') {
      return res.status(400).json({ message: error.message });
    }
    if (error?.code === 11000) {
      return res.status(409).json({ message: 'A category with this name already exists.' });
    }
    res.status(500).json({ message: 'Error creating category' });
  }
};

export const updateCategory = async (req: TenantRequest, res: Response) => {
  try {
    const Category = getCategoryModel(req.tenantDB!);
    const entityId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const updates: Record<string, unknown> = {};

    if (req.body?.name !== undefined) {
      const name = String(req.body.name).trim();
      if (!name) {
        return res.status(400).json({ message: 'Category name is required.' });
      }
      const existing = await Category.findOne({
        _id: { $ne: entityId },
        name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
      });
      if (existing) {
        return res.status(409).json({ message: 'A category with this name already exists.' });
      }
      updates.name = name;
    }

    if (req.body?.status === 'active' || req.body?.status === 'inactive') {
      updates.status = req.body.status;
    }
    if (req.body?.businessUnitId !== undefined) {
      updates.businessUnitId = resolveBusinessUnitId(req, req.body);
    }

    const category = await Category.findByIdAndUpdate(entityId, updates, { new: true });
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    if (req.user && req.business && entityId) {
      await logAuditEvent({
        user: req.user as any,
        business: req.business,
        action: 'UPDATE',
        entity: 'Category',
        entityId,
        changes: updates,
        req
      });
    }

    res.json(category);
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ message: 'Error updating category' });
  }
};

export const deleteCategory = async (req: TenantRequest, res: Response) => {
  try {
    const Category = getCategoryModel(req.tenantDB!);
    const entityId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    await Category.findByIdAndDelete(entityId);

    if (req.user && req.business && entityId) {
      await logAuditEvent({
        user: req.user as any,
        business: req.business,
        action: 'DELETE',
        entity: 'Category',
        entityId,
        req
      });
    }

    res.json({ message: 'Category deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting category' });
  }
};
