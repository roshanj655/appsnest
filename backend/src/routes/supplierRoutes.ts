import express from 'express';
import { getSuppliers, createSupplier, updateSupplier, deleteSupplier } from '../controllers/supplierController';
import { protect, authorize } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { validate } from '../middleware/validate';
import { partySchema, partyUpdateSchema } from '../schemas';

const router = express.Router();

router.route('/')
  .get(protect, authorize('suppliers.read'), tenantMiddleware, getSuppliers)
  .post(protect, authorize('suppliers.create'), tenantMiddleware, validate(partySchema), createSupplier);

router.route('/:id')
  .put(protect, authorize('suppliers.update'), tenantMiddleware, validate(partyUpdateSchema), updateSupplier)
  .delete(protect, authorize('suppliers.delete'), tenantMiddleware, deleteSupplier);

export default router;
