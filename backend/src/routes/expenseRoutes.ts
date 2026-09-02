import express from 'express';
import { getExpenses, createExpense, updateExpense, deleteExpense } from '../controllers/expenseController';
import { protect, authorize } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { validate } from '../middleware/validate';
import { expenseSchema, expenseUpdateSchema } from '../schemas';

const router = express.Router();

router.route('/')
  .get(protect, authorize('expenses.read'), tenantMiddleware, getExpenses)
  .post(protect, authorize('expenses.create'), tenantMiddleware, validate(expenseSchema), createExpense);

router.route('/:id')
  .put(protect, authorize('expenses.update'), tenantMiddleware, validate(expenseUpdateSchema), updateExpense)
  .delete(protect, authorize('expenses.delete'), tenantMiddleware, deleteExpense);

export default router;
