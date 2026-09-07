import express from 'express';
import {
  getInventoryStock,
  getInventoryTransactions,
  getCostHistory,
  createInventoryAdjustment
} from '../controllers/inventoryController';
import { protect, authorize } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { validate } from '../middleware/validate';
import { stockAdjustmentSchema } from '../schemas';

const router = express.Router();

router.get('/stock', protect, authorize('reports.inventory.read', 'products.read'), tenantMiddleware, getInventoryStock);
router.get('/transactions', protect, authorize('stockAdjustments.read', 'products.read'), tenantMiddleware, getInventoryTransactions);
router.get('/cost-history', protect, authorize('reports.inventory.read', 'products.read'), tenantMiddleware, getCostHistory);
router.post('/adjustment', protect, authorize('stockAdjustments.create'), tenantMiddleware, validate(stockAdjustmentSchema), createInventoryAdjustment);

export default router;
