import express from 'express';
import { getProducts, lookupProduct, createProduct, updateProduct, deleteProduct } from '../controllers/productController';
import { downloadImportSample, importFromExcel } from '../controllers/excelImportController';
import { protect, authorize } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { validate } from '../middleware/validate';
import { excelFile } from '../middleware/excelUpload';
import { productSchema, productUpdateSchema } from '../schemas';

const router = express.Router();

router.get('/lookup', protect, authorize('products.read'), tenantMiddleware, lookupProduct);
router.get('/import/sample', protect, authorize('products.create'), tenantMiddleware, downloadImportSample('products'));
router.post('/import', protect, authorize('products.create'), tenantMiddleware, excelFile, importFromExcel('products'));

router.route('/')
  .get(protect, authorize('products.read'), tenantMiddleware, getProducts)
  .post(protect, authorize('products.create'), tenantMiddleware, validate(productSchema), createProduct);

router.route('/:id')
  .put(protect, authorize('products.update'), tenantMiddleware, validate(productUpdateSchema), updateProduct)
  .delete(protect, authorize('products.delete'), tenantMiddleware, deleteProduct);

export default router;
