import express from 'express';
import {
  getSales,
  createSale,
  updateSale,
  deleteSale,
  downloadInvoice,
  sendInvoiceEmail,
  uploadAttachment,
  downloadAttachment,
  returnSale,
  addSalePayment,
  reversePayment
} from '../controllers/saleController';
import { protect, authorize } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { upload } from '../utils/upload';
import { validate } from '../middleware/validate';
import { emailSchema, salePaymentSchema, saleSchema, saleUpdateSchema } from '../schemas';

const router = express.Router();

router.route('/')
  .get(protect, authorize('sales.read'), tenantMiddleware, getSales)
  .post(protect, authorize('sales.create'), tenantMiddleware, upload.array('attachments'), validate(saleSchema), createSale);

router.post('/:id/return', protect, authorize('sales.update'), tenantMiddleware, returnSale);
router.post(
  '/:id/payments',
  protect,
  authorize('sales.payments.create'),
  tenantMiddleware,
  validate(salePaymentSchema),
  addSalePayment
);
router.post(
  '/:id/payments/:paymentId/reverse',
  protect,
  authorize('sales.payments.reverse'),
  tenantMiddleware,
  reversePayment
);

router.route('/:id')
  .put(protect, authorize('sales.update'), tenantMiddleware, validate(saleUpdateSchema), updateSale)
  .delete(protect, authorize('sales.delete'), tenantMiddleware, deleteSale);

router.route('/:id/invoice')
  .get(protect, authorize('sales.invoice.download'), tenantMiddleware, downloadInvoice);

router.route('/:id/email')
  .post(protect, authorize('sales.email.send'), tenantMiddleware, validate(emailSchema), sendInvoiceEmail);

router.route('/:id/attachments')
  .post(protect, authorize('sales.attachments.upload'), tenantMiddleware, upload.single('attachment'), uploadAttachment);

router.route('/:saleId/attachments/:attachmentId/download')
  .get(protect, authorize('sales.attachments.download'), tenantMiddleware, downloadAttachment);

export default router;
