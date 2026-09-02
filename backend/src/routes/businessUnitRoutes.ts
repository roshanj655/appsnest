import express from 'express';
import {
  getBusinessUnits,
  createBusinessUnit,
  updateBusinessUnit,
  deleteBusinessUnit
} from '../controllers/businessUnitController';
import { protect, authorize } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { validate } from '../middleware/validate';
import { businessUnitSchema, businessUnitUpdateSchema } from '../schemas';

const router = express.Router();

router.route('/')
  .get(protect, authorize('businessUnits.read'), tenantMiddleware, getBusinessUnits)
  .post(protect, authorize('businessUnits.create'), tenantMiddleware, validate(businessUnitSchema), createBusinessUnit);

router.route('/:id')
  .put(protect, authorize('businessUnits.update'), tenantMiddleware, validate(businessUnitUpdateSchema), updateBusinessUnit)
  .delete(protect, authorize('businessUnits.delete'), tenantMiddleware, deleteBusinessUnit);

export default router;
