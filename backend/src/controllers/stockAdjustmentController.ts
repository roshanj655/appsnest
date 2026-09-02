import { Response } from 'express';
import { TenantRequest } from '../middleware/tenant';
import { getProductModel } from '../models/tenant/Product';
import { getStockAdjustmentModel, STOCK_REASONS, type StockReason } from '../models/tenant/StockAdjustment';
import { logAuditEvent } from '../utils/auditLogger';
import { applyStockDelta } from '../utils/inventoryMovement';
import { paginatedResult, parsePagination } from '../utils/pagination';
import { unitScope } from '../utils/businessUnit';

const parseId = (id: string | string[] | undefined) => (Array.isArray(id) ? id[0] : id);

export const getStockAdjustments = async (req: TenantRequest, res: Response) => {
  try {
    const StockAdjustment = getStockAdjustmentModel(req.tenantDB!);
    const { page, limit, skip } = parsePagination(req.query);
    const filter = unitScope(req);
    const [items, total] = await Promise.all([
      StockAdjustment.find(filter).populate('productId').sort({ createdAt: -1 }).skip(skip).limit(limit),
      StockAdjustment.countDocuments(filter)
    ]);
    res.json(paginatedResult(items, total, page, limit));
  } catch (error) {
    console.error('Error fetching stock adjustments:', error);
    res.status(500).json({ message: 'Error fetching stock adjustments' });
  }
};

export const createStockAdjustment = async (req: TenantRequest, res: Response) => {
  try {
    const productId = String(req.body?.productId || '').trim();
    const variantId = String(req.body?.variantId || '').trim();
    const quantity = Number(req.body?.quantity);
    const reason = String(req.body?.reason || '').trim() as StockReason;
    const direction = req.body?.direction === 'out' ? 'out' : 'in';
    const notes = typeof req.body?.notes === 'string' ? req.body.notes.trim() : undefined;

    if (!productId) {
      return res.status(400).json({ message: 'Product is required.' });
    }
    if (!Number.isFinite(quantity) || quantity < 1) {
      return res.status(400).json({ message: 'Quantity must be at least 1.' });
    }
    if (!STOCK_REASONS.includes(reason)) {
      return res.status(400).json({ message: 'A valid adjustment reason is required.' });
    }

    const Product = getProductModel(req.tenantDB!);
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found.' });
    }

    const variant = variantId
      ? (product.variants || []).find((row: any) => String(row._id) === variantId)
      : null;
    if (product.variants?.length && !variant) {
      return res.status(400).json({ message: `Pick a variant for ${product.name}.` });
    }

    let stockAfter = 0;
    try {
      const updated = await applyStockDelta(req.tenantDB!, {
        productId,
        variantId: variant ? String(variant._id) : undefined,
        quantity,
        direction,
        source: reason === 'opening' ? 'opening' : 'adjustment',
        notes: reason
      });
      stockAfter = updated.stock;
    } catch (error: any) {
      return res.status(400).json({ message: error.message || 'Unable to adjust stock.' });
    }

    const StockAdjustment = getStockAdjustmentModel(req.tenantDB!);
    const adjustment = await StockAdjustment.create({
      productId,
      variantId: variant?._id,
      variantName: variant?.name,
      quantity,
      direction,
      reason,
      notes,
      businessUnitId: product.businessUnitId,
      status: 'active'
    });

    if (req.user && req.business) {
      await logAuditEvent({
        user: req.user as any,
        business: req.business,
        action: 'CREATE',
        entity: 'StockAdjustment',
        entityId: adjustment._id.toString(),
        changes: { productId, quantity, direction, reason, stockAfter },
        req
      });
    }

    const populated = await StockAdjustment.findById(adjustment._id).populate('productId');
    res.status(201).json(populated);
  } catch (error) {
    console.error('Error creating stock adjustment:', error);
    res.status(500).json({ message: 'Error creating stock adjustment' });
  }
};

export const updateStockAdjustment = async (req: TenantRequest, res: Response) => {
  try {
    const entityId = parseId(req.params.id);
    const StockAdjustment = getStockAdjustmentModel(req.tenantDB!);
    const Product = getProductModel(req.tenantDB!);
    const adjustment = await StockAdjustment.findById(entityId);
    if (!adjustment) {
      return res.status(404).json({ message: 'Stock adjustment not found.' });
    }

    const nextStatus = req.body?.status;
    if (nextStatus !== 'active' && nextStatus !== 'cancelled') {
      return res.status(400).json({ message: 'Status must be active or cancelled.' });
    }
    if (adjustment.status === nextStatus) {
      return res.json(await StockAdjustment.findById(entityId).populate('productId'));
    }

    const product = await Product.findById(adjustment.productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found.' });
    }

    const deltaDirection = nextStatus === 'cancelled'
      ? (adjustment.direction === 'in' ? 'out' : 'in')
      : adjustment.direction;

    let stockAfter = 0;
    try {
      const updated = await applyStockDelta(req.tenantDB!, {
        productId: String(adjustment.productId),
        variantId: adjustment.variantId ? String(adjustment.variantId) : undefined,
        quantity: adjustment.quantity,
        direction: deltaDirection,
        source: 'adjustment',
        notes: nextStatus === 'cancelled' ? 'adjustment-cancel' : 'adjustment-restore'
      });
      stockAfter = updated.stock;
    } catch (error: any) {
      return res.status(400).json({ message: error.message || 'This change would make stock negative.' });
    }

    adjustment.status = nextStatus;
    await adjustment.save();

    if (req.user && req.business && entityId) {
      await logAuditEvent({
        user: req.user as any,
        business: req.business,
        action: 'UPDATE',
        entity: 'StockAdjustment',
        entityId,
        changes: { status: nextStatus, stockAfter },
        req
      });
    }

    res.json(await StockAdjustment.findById(entityId).populate('productId'));
  } catch (error) {
    console.error('Error updating stock adjustment:', error);
    res.status(500).json({ message: 'Error updating stock adjustment' });
  }
};

export const deleteStockAdjustment = async (req: TenantRequest, res: Response) => {
  try {
    const entityId = parseId(req.params.id);
    const StockAdjustment = getStockAdjustmentModel(req.tenantDB!);
    const adjustment = await StockAdjustment.findById(entityId);
    if (!adjustment) {
      return res.status(404).json({ message: 'Stock adjustment not found.' });
    }

    if (adjustment.status === 'active') {
      try {
        await applyStockDelta(req.tenantDB!, {
          productId: String(adjustment.productId),
          variantId: adjustment.variantId ? String(adjustment.variantId) : undefined,
          quantity: adjustment.quantity,
          direction: adjustment.direction === 'in' ? 'out' : 'in',
          source: 'adjustment',
          notes: 'adjustment-delete'
        });
      } catch (error: any) {
        return res.status(400).json({ message: error.message || 'Cannot delete this adjustment because stock would go negative.' });
      }
    }

    await StockAdjustment.findByIdAndDelete(entityId);

    if (req.user && req.business && entityId) {
      await logAuditEvent({
        user: req.user as any,
        business: req.business,
        action: 'DELETE',
        entity: 'StockAdjustment',
        entityId,
        req
      });
    }

    res.json({ message: 'Stock adjustment deleted' });
  } catch (error) {
    console.error('Error deleting stock adjustment:', error);
    res.status(500).json({ message: 'Error deleting stock adjustment' });
  }
};
