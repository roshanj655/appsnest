import express from 'express';
import { getCustomers, createCustomer, updateCustomer, deleteCustomer } from '../controllers/customerController';
import { protect, authorize } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { validate } from '../middleware/validate';
import { partySchema, partyUpdateSchema } from '../schemas';

const router = express.Router();

router.route('/')
  .get(protect, authorize('customers.read'), tenantMiddleware, getCustomers)
  .post(protect, authorize('customers.create'), tenantMiddleware, validate(partySchema), createCustomer);

router.route('/:id')
  .put(protect, authorize('customers.update'), tenantMiddleware, validate(partyUpdateSchema), updateCustomer)
  .delete(protect, authorize('customers.delete'), tenantMiddleware, deleteCustomer);

export default router;
