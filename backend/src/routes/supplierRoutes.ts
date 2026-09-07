import express from 'express';
import { getSuppliers, createSupplier, updateSupplier, deleteSupplier } from '../controllers/supplierController';
import { downloadImportSample, importFromExcel } from '../controllers/excelImportController';
import { protect, authorize } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { validate } from '../middleware/validate';
import { excelFile } from '../middleware/excelUpload';
import { partySchema, partyUpdateSchema } from '../schemas';

const router = express.Router();

router.get('/import/sample', protect, authorize('suppliers.create'), tenantMiddleware, downloadImportSample('suppliers'));
router.post('/import', protect, authorize('suppliers.create'), tenantMiddleware, excelFile, importFromExcel('suppliers'));

router.route('/')
  .get(protect, authorize('suppliers.read'), tenantMiddleware, getSuppliers)
  .post(protect, authorize('suppliers.create'), tenantMiddleware, validate(partySchema), createSupplier);

router.route('/:id')
  .put(protect, authorize('suppliers.update'), tenantMiddleware, validate(partyUpdateSchema), updateSupplier)
  .delete(protect, authorize('suppliers.delete'), tenantMiddleware, deleteSupplier);

export default router;
