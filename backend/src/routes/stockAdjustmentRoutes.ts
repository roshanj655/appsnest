import express from 'express';
import {
  getStockAdjustments,
  createStockAdjustment,
  updateStockAdjustment,
  deleteStockAdjustment
} from '../controllers/stockAdjustmentController';
import { protect, authorize } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { validate } from '../middleware/validate';
import { stockAdjustmentSchema, stockAdjustmentUpdateSchema } from '../schemas';

const router = express.Router();

router.route('/')
  .get(protect, authorize('stockAdjustments.read'), tenantMiddleware, getStockAdjustments)
  .post(protect, authorize('stockAdjustments.create'), tenantMiddleware, validate(stockAdjustmentSchema), createStockAdjustment);

router.route('/:id')
  .put(protect, authorize('stockAdjustments.update'), tenantMiddleware, validate(stockAdjustmentUpdateSchema), updateStockAdjustment)
  .delete(protect, authorize('stockAdjustments.delete'), tenantMiddleware, deleteStockAdjustment);

export default router;
