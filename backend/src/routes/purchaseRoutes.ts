import express from 'express';
import {
  getPurchases, createPurchase, updatePurchase, deletePurchase, downloadInvoice, sendPurchaseInvoiceEmail, uploadAttachment, downloadAttachment, receivePurchase, returnPurchase
} from '../controllers/purchaseController';
import { protect, authorize } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { upload } from '../utils/upload';
import { validate } from '../middleware/validate';
import { emailSchema, purchaseSchema, purchaseUpdateSchema } from '../schemas';

const router = express.Router();

router.route('/')
  .get(protect, authorize('purchases.read'), tenantMiddleware, getPurchases)
  .post(protect, authorize('purchases.create'), tenantMiddleware, upload.array('attachments'), validate(purchaseSchema), createPurchase);

router.post('/:id/receive', protect, authorize('purchases.update'), tenantMiddleware, receivePurchase);
router.post('/:id/return', protect, authorize('purchases.update'), tenantMiddleware, returnPurchase);

router.route('/:id')
  .put(protect, authorize('purchases.update'), tenantMiddleware, validate(purchaseUpdateSchema), updatePurchase)
  .delete(protect, authorize('purchases.delete'), tenantMiddleware, deletePurchase);

router.route('/:id/invoice')
  .get(protect, authorize('purchases.invoice.download'), tenantMiddleware, downloadInvoice);

router.route('/:id/email')
  .post(protect, authorize('purchases.email.send'), tenantMiddleware, validate(emailSchema), sendPurchaseInvoiceEmail);

router.route('/:id/attachments')
  .post(protect, authorize('purchases.attachments.upload'), tenantMiddleware, upload.single('attachment'), uploadAttachment);

router.route('/:purchaseId/attachments/:attachmentId/download')
  .get(protect, authorize('purchases.attachments.download'), tenantMiddleware, downloadAttachment);

export default router;
