import express from 'express';
import {
  getLoans,
  createLoan,
  updateLoan,
  deleteLoan,
  addLoanRepayment,
  reverseLoanRepayment
} from '../controllers/loanController';
import { protect, authorize } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { validate } from '../middleware/validate';
import { loanRepaymentSchema, loanSchema, loanUpdateSchema } from '../schemas';

const router = express.Router();

router.route('/')
  .get(protect, authorize('loans.read'), tenantMiddleware, getLoans)
  .post(protect, authorize('loans.create'), tenantMiddleware, validate(loanSchema), createLoan);

router.post(
  '/:id/repayments',
  protect,
  authorize('loans.repay'),
  tenantMiddleware,
  validate(loanRepaymentSchema),
  addLoanRepayment
);

router.post(
  '/:id/repayments/:repaymentId/reverse',
  protect,
  authorize('loans.repay'),
  tenantMiddleware,
  reverseLoanRepayment
);

router.route('/:id')
  .put(protect, authorize('loans.update'), tenantMiddleware, validate(loanUpdateSchema), updateLoan)
  .delete(protect, authorize('loans.delete'), tenantMiddleware, deleteLoan);

export default router;
