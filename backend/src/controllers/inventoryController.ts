import { Response } from 'express';
import { TenantRequest } from '../middleware/tenant';
import { getProductModel } from '../models/tenant/Product';
import { getInventoryTransactionModel } from '../models/tenant/InventoryTransaction';
import { paginatedResult, parsePagination } from '../utils/pagination';
import { mergeFilters, unitScope } from '../utils/businessUnit';
import { stockSummaryRows } from '../services/inventoryCosting';
import { createStockAdjustment } from './stockAdjustmentController';

export const getInventoryStock = async (req: TenantRequest, res: Response) => {
  try {
    const Product = getProductModel(req.tenantDB!);
    const products = await Product.find(unitScope(req)).populate('categoryId').populate('businessUnitId').sort({ name: 1 });
    const rows = stockSummaryRows(products).map((row) => ({
      ...row,
      warehouseName: (products.find((p: any) => String(p._id) === String(row.productId)) as any)?.businessUnitId?.name
    }));
    const inventoryValue = rows.reduce((sum, row) => sum + Number(row.inventoryValue || 0), 0);
    const sellingValue = rows.reduce((sum, row) => sum + Number(row.currentStock || 0) * Number(row.sellingPrice || 0), 0);
    res.json({ items: rows, products: rows, totalStockValue: inventoryValue, inventoryValue, totalSellingValue: sellingValue });
  } catch (error) {
    console.error('Error fetching stock summary:', error);
    res.status(500).json({ message: 'Error fetching stock summary' });
  }
};

export const getInventoryTransactions = async (req: TenantRequest, res: Response) => {
  try {
    const InventoryTransaction = getInventoryTransactionModel(req.tenantDB!);
    const { page, limit, skip } = parsePagination(req.query);
    const extra: Record<string, unknown> = {};
    if (req.query.productId) extra.productId = req.query.productId;
    if (req.query.variantId) extra.variantId = req.query.variantId;
    if (req.query.warehouseId) extra.warehouseId = req.query.warehouseId;
    if (req.query.transactionType) extra.transactionType = req.query.transactionType;
    if (req.query.referenceId) extra.referenceId = req.query.referenceId;
    const filter = mergeFilters(extra, unitScope(req));
    const [items, total] = await Promise.all([
      InventoryTransaction.find(filter).populate('productId').populate('warehouseId').sort({ createdAt: -1 }).skip(skip).limit(limit),
      InventoryTransaction.countDocuments(filter)
    ]);
    res.json(paginatedResult(items, total, page, limit));
  } catch (error) {
    console.error('Error fetching stock history:', error);
    res.status(500).json({ message: 'Error fetching stock history' });
  }
};

export const getCostHistory = async (req: TenantRequest, res: Response) => {
  try {
    const productId = String(req.query.productId || '').trim();
    if (!productId) {
      return res.status(400).json({ message: 'productId is required.' });
    }
    const InventoryTransaction = getInventoryTransactionModel(req.tenantDB!);
    const extra: Record<string, unknown> = { productId };
    if (req.query.variantId) extra.variantId = req.query.variantId;
    if (req.query.warehouseId) extra.warehouseId = req.query.warehouseId;
    const filter = mergeFilters(extra, unitScope(req));
    const items = await InventoryTransaction.find(filter).sort({ createdAt: 1, _id: 1 });
    res.json({
      items: items.map((row: any) => ({
        date: row.createdAt,
        transactionType: row.transactionType || String(row.source || '').toUpperCase(),
        quantity: row.quantity,
        unitCost: row.unitCost,
        totalCost: row.totalCost,
        averageCostAfter: row.averageCostAfter,
        stockAfter: row.stockAfter,
        inventoryValueAfter: row.inventoryValueAfter,
        notes: row.notes,
        referenceType: row.referenceType,
        referenceId: row.referenceId
      }))
    });
  } catch (error) {
    console.error('Error fetching cost history:', error);
    res.status(500).json({ message: 'Error fetching cost history' });
  }
};

export const createInventoryAdjustment = createStockAdjustment;
