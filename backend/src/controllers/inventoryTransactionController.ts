import { Response } from 'express';
import { TenantRequest } from '../middleware/tenant';
import { getInventoryTransactionModel } from '../models/tenant/InventoryTransaction';

import { paginatedResult, parsePagination } from '../utils/pagination';
import { unitScope } from '../utils/businessUnit';

export const getInventoryTransactions = async (req: TenantRequest, res: Response) => {
  try {
    const InventoryTransaction = getInventoryTransactionModel(req.tenantDB!);
    const { page, limit, skip } = parsePagination(req.query);
    const filter = unitScope(req);
    const [items, total] = await Promise.all([
      InventoryTransaction.find(filter).populate('productId').sort({ createdAt: -1 }).skip(skip).limit(limit),
      InventoryTransaction.countDocuments(filter)
    ]);
    res.json(paginatedResult(items, total, page, limit));
  } catch (error) {
    console.error('Error fetching stock history:', error);
    res.status(500).json({ message: 'Error fetching stock history' });
  }
};
