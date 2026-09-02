import express from 'express';
import {
  deleteBusiness,
  getBusinesses,
  updateBusiness,
  updateBusinessStatus,
  updateBusinessSubscription
} from '../controllers/businessController';
import { protect, requireSuperAdmin } from '../middleware/auth';

const router = express.Router();

router.use(protect, requireSuperAdmin);

router.get('/', getBusinesses);
router.put('/:id', updateBusiness);
router.patch('/:id/status', updateBusinessStatus);
router.patch('/:id/subscription', updateBusinessSubscription);
router.delete('/:id', deleteBusiness);

export default router;
