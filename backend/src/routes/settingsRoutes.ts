import express from 'express';
import { getSettings, updateSettings } from '../controllers/settingsController';
import { protect, authorize } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { validate } from '../middleware/validate';
import { settingsSchema } from '../schemas';

const router = express.Router();

router.route('/')
  .get(protect, authorize('settings.read'), tenantMiddleware, getSettings)
  .put(protect, authorize('settings.update'), tenantMiddleware, validate(settingsSchema), updateSettings);

export default router;
