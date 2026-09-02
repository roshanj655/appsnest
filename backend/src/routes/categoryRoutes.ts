import express from 'express';
import { getCategories, createCategory, updateCategory, deleteCategory } from '../controllers/categoryController';
import { protect, authorize } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { validate } from '../middleware/validate';
import { categorySchema, categoryUpdateSchema } from '../schemas';

const router = express.Router();

router.route('/')
  .get(protect, authorize('categories.read'), tenantMiddleware, getCategories)
  .post(protect, authorize('categories.create'), tenantMiddleware, validate(categorySchema), createCategory);

router.route('/:id')
  .put(protect, authorize('categories.update'), tenantMiddleware, validate(categoryUpdateSchema), updateCategory)
  .delete(protect, authorize('categories.delete'), tenantMiddleware, deleteCategory);

export default router;
