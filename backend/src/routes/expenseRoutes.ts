import express from 'express';
import { getExpenses, createExpense, updateExpense, deleteExpense } from '../controllers/expenseController';
import { downloadImportSample, importFromExcel } from '../controllers/excelImportController';
import { protect, authorize } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { validate } from '../middleware/validate';
import { excelFile } from '../middleware/excelUpload';
import { expenseSchema, expenseUpdateSchema } from '../schemas';

const router = express.Router();

router.get('/import/sample', protect, authorize('expenses.create'), tenantMiddleware, downloadImportSample('expenses'));
router.post('/import', protect, authorize('expenses.create'), tenantMiddleware, excelFile, importFromExcel('expenses'));

router.route('/')
  .get(protect, authorize('expenses.read'), tenantMiddleware, getExpenses)
  .post(protect, authorize('expenses.create'), tenantMiddleware, validate(expenseSchema), createExpense);

router.route('/:id')
  .put(protect, authorize('expenses.update'), tenantMiddleware, validate(expenseUpdateSchema), updateExpense)
  .delete(protect, authorize('expenses.delete'), tenantMiddleware, deleteExpense);

export default router;
