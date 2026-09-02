import express from 'express';
import { getInventoryTransactions } from '../controllers/inventoryTransactionController';
import { protect, authorize } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';

const router = express.Router();

router.get('/', protect, authorize('stockAdjustments.read', 'products.read'), tenantMiddleware, getInventoryTransactions);

export default router;
