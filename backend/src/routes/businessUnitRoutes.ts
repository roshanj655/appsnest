import express from 'express';
import {
  getBusinessUnits,
  createBusinessUnit,
  updateBusinessUnit,
  deleteBusinessUnit
} from '../controllers/businessUnitController';
import { downloadImportSample, importFromExcel } from '../controllers/excelImportController';
import { protect, authorize } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { validate } from '../middleware/validate';
import { excelFile } from '../middleware/excelUpload';
import { businessUnitSchema, businessUnitUpdateSchema } from '../schemas';

const router = express.Router();

router.get('/import/sample', protect, authorize('businessUnits.create'), tenantMiddleware, downloadImportSample('business-units'));
router.post('/import', protect, authorize('businessUnits.create'), tenantMiddleware, excelFile, importFromExcel('business-units'));

router.route('/')
  .get(protect, authorize('businessUnits.read'), tenantMiddleware, getBusinessUnits)
  .post(protect, authorize('businessUnits.create'), tenantMiddleware, validate(businessUnitSchema), createBusinessUnit);

router.route('/:id')
  .put(protect, authorize('businessUnits.update'), tenantMiddleware, validate(businessUnitUpdateSchema), updateBusinessUnit)
  .delete(protect, authorize('businessUnits.delete'), tenantMiddleware, deleteBusinessUnit);

export default router;
