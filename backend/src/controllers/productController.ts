import { Response } from 'express';
import { TenantRequest } from '../middleware/tenant';
import { getProductModel } from '../models/tenant/Product';
import { logAuditEvent } from '../utils/auditLogger';
import { paginatedResult, parsePagination, textSearch } from '../utils/pagination';
import { mergeFilters, resolveBusinessUnitId, unitScope } from '../utils/businessUnit';
import { applyInventoryMovement, recordOpeningIfNeeded, rollupProductStock } from '../services/inventoryCosting';

const catalogFields = (body: Record<string, unknown>) => {
  const payload = { ...body };
  const variants = Array.isArray(payload.variants) ? payload.variants : [];
  if (variants.length) {
    payload.variants = variants.map((variant: any) => {
      const next = { ...variant };
      if (!next._id) delete next._id;
      return next;
    });
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
    const payload = catalogFields(req.body);
    const product = await Product.create({
      ...payload,
      lastPurchaseCost: Number(payload.lastPurchaseCost ?? payload.purchasePrice ?? 0),
      averageCost: Number(payload.averageCost ?? payload.purchasePrice ?? 0),
      businessUnitId: resolveBusinessUnitId(req, req.body)
    });
    await recordOpeningIfNeeded(req.tenantDB!, product, req.user ? String((req.user as any)._id || '') : undefined);

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

    res.status(201).json(await Product.findById(product._id));
  } catch (error) {
    res.status(500).json({ message: 'Error creating product' });
  }
};

export const updateProduct = async (req: TenantRequest, res: Response) => {
  try {
    const Product = getProductModel(req.tenantDB!);
    const entityId = req.params.id as string;
    const existing = await Product.findById(entityId);
    if (!existing) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const payload = catalogFields(req.body);
    delete payload.stock;
    delete payload.averageCost;
    delete payload.lastPurchaseCost;
    delete payload.lastPurchaseDate;
    delete payload.inventoryValue;

    const incomingVariants = Array.isArray(payload.variants) ? payload.variants : null;
    const existingIds = new Set((existing.variants || []).map((row: any) => String(row._id)));
    if (incomingVariants) {
      payload.variants = incomingVariants.map((variant: any) => {
        const current = (existing.variants || []).find((row: any) => variant._id && String(row._id) === String(variant._id));
        if (current) {
          return {
            ...((current as any).toObject ? (current as any).toObject() : current),
            name: variant.name ?? current.name,
            sku: variant.sku ?? current.sku,
            barcode: variant.barcode ?? current.barcode,
            attributes: variant.attributes ?? current.attributes,
            sellingPrice: variant.sellingPrice ?? current.sellingPrice,
            stock: current.stock,
            purchasePrice: current.purchasePrice,
            averageCost: current.averageCost,
            lastPurchaseCost: current.lastPurchaseCost,
            lastPurchaseDate: current.lastPurchaseDate,
            inventoryValue: current.inventoryValue
          };
        }
        return {
          ...variant,
          stock: 0,
          averageCost: 0,
          lastPurchaseCost: Number(variant.purchasePrice || existing.purchasePrice || 0),
          inventoryValue: 0
        };
      });
    }

    const product = await Product.findByIdAndUpdate(entityId, payload, { new: true });
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    if (incomingVariants) {
      for (const variant of product.variants || []) {
        if (existingIds.has(String(variant._id))) continue;
        const incoming = incomingVariants.find((row: any) => !row._id && row.name === variant.name);
        const qty = Number(incoming?.stock || 0);
        const unitCost = Number(incoming?.purchasePrice || variant.lastPurchaseCost || existing.purchasePrice || 0);
        if (qty > 0) {
          await applyInventoryMovement(req.tenantDB!, {
            productId: String(product._id),
            variantId: String(variant._id),
            quantity: qty,
            transactionType: 'OPENING',
            unitCost,
            referenceType: 'PRODUCT',
            referenceId: String(product._id),
            createdBy: req.user ? String((req.user as any)._id || '') : undefined
          });
        }
      }
    }

    const fresh = await Product.findById(entityId);
    if (fresh) {
      rollupProductStock(fresh);
      await fresh.save();
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

    res.json(fresh);
  } catch (error: any) {
    res.status(error?.status || 500).json({ message: error.message || 'Error updating product' });
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
