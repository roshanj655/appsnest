import { Response } from 'express';
import { TenantRequest } from '../middleware/tenant';
import { getProductModel } from '../models/tenant/Product';
import { logAuditEvent } from '../utils/auditLogger';
import { paginatedResult, parsePagination, textSearch } from '../utils/pagination';
import { mergeFilters, resolveBusinessUnitId, unitScope } from '../utils/businessUnit';
import { rollupProductStock } from '../utils/inventoryMovement';

const withRolledStock = (body: Record<string, unknown>) => {
  const payload = { ...body };
  const variants = Array.isArray(payload.variants) ? payload.variants : [];
  if (variants.length) {
    payload.variants = variants.map((variant: any) => {
      const next = { ...variant };
      if (!next._id) delete next._id;
      return next;
    });
    payload.stock = (payload.variants as any[]).reduce((sum: number, variant: any) => sum + Number(variant.stock || 0), 0);
  }
  return payload;
};

export const getProducts = async (req: TenantRequest, res: Response) => {
  try {
    const Product = getProductModel(req.tenantDB!);
    const { page, limit, skip, search } = parsePagination(req.query);
    const filter = mergeFilters(
      textSearch(search, ['name', 'sku', 'barcode', 'brand', 'variants.name', 'variants.sku', 'variants.barcode']),
      unitScope(req)
    );
    const [items, total] = await Promise.all([
      Product.find(filter).populate('categoryId').sort({ name: 1 }).skip(skip).limit(limit),
      Product.countDocuments(filter)
    ]);
    res.json(paginatedResult(items, total, page, limit));
  } catch (error) {
    res.status(500).json({ message: 'Error fetching products' });
  }
};

export const lookupProduct = async (req: TenantRequest, res: Response) => {
  try {
    const code = String(req.query.code || '').trim();
    if (!code) {
      return res.status(400).json({ message: 'Scan a barcode or SKU.' });
    }
    const Product = getProductModel(req.tenantDB!);
    const escaped = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const exact = new RegExp(`^${escaped}$`, 'i');
    const filter = mergeFilters(
      {
        $or: [
          { barcode: exact },
          { sku: exact },
          { 'variants.barcode': exact },
          { 'variants.sku': exact }
        ]
      },
      unitScope(req),
      { status: 'active' }
    );
    const product = await Product.findOne(filter);
    if (!product) {
      return res.status(404).json({ message: 'No product matches that barcode or SKU.' });
    }
    const matchedVariant = (product.variants || []).find(
      (variant: any) =>
        String(variant.barcode || '').toLowerCase() === code.toLowerCase() ||
        String(variant.sku || '').toLowerCase() === code.toLowerCase()
    );
    res.json({
      ...product.toObject(),
      matchedVariant: matchedVariant || null
    });
  } catch (error) {
    res.status(500).json({ message: 'Error looking up product' });
  }
};

export const createProduct = async (req: TenantRequest, res: Response) => {
  try {
    const Product = getProductModel(req.tenantDB!);
    const product = await Product.create({
      ...withRolledStock(req.body),
      businessUnitId: resolveBusinessUnitId(req, req.body)
    });

    if (req.user && req.business) {
      await logAuditEvent({
        user: req.user as any,
        business: req.business,
        action: 'CREATE',
        entity: 'Product',
        entityId: product._id.toString(),
        changes: req.body,
        req
      });
    }

    res.status(201).json(product);
  } catch (error) {
    res.status(500).json({ message: 'Error creating product' });
  }
};

export const updateProduct = async (req: TenantRequest, res: Response) => {
  try {
    const Product = getProductModel(req.tenantDB!);
    const entityId = req.params.id as string;
    const payload = withRolledStock(req.body);
    const product = await Product.findByIdAndUpdate(entityId, payload, { new: true });
    if (product) {
      rollupProductStock(product);
      await product.save();
    }

    if (req.user && req.business) {
      await logAuditEvent({
        user: req.user as any,
        business: req.business,
        action: 'UPDATE',
        entity: 'Product',
        entityId,
        changes: req.body,
        req
      });
    }

    res.json(product);
  } catch (error) {
    res.status(500).json({ message: 'Error updating product' });
  }
};

export const deleteProduct = async (req: TenantRequest, res: Response) => {
  try {
    const Product = getProductModel(req.tenantDB!);
    const entityId = req.params.id as string;
    await Product.findByIdAndDelete(entityId);

    if (req.user && req.business) {
      await logAuditEvent({
        user: req.user as any,
        business: req.business,
        action: 'DELETE',
        entity: 'Product',
        entityId,
        req
      });
    }

    res.json({ message: 'Product deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting product' });
  }
};
