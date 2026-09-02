import express from 'express';
import { getProducts, lookupProduct, createProduct, updateProduct, deleteProduct } from '../controllers/productController';
import { protect, authorize } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { validate } from '../middleware/validate';
import { productSchema, productUpdateSchema } from '../schemas';

const router = express.Router();

router.get('/lookup', protect, authorize('products.read'), tenantMiddleware, lookupProduct);

router.route('/')
  .get(protect, authorize('products.read'), tenantMiddleware, getProducts)
  .post(protect, authorize('products.create'), tenantMiddleware, validate(productSchema), createProduct);

router.route('/:id')
  .put(protect, authorize('products.update'), tenantMiddleware, validate(productUpdateSchema), updateProduct)
  .delete(protect, authorize('products.delete'), tenantMiddleware, deleteProduct);

export default router;
