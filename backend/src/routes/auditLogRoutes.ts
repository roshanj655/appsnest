import express from 'express';
import { getAuditLogs } from '../controllers/auditLogController';
import { protect, authorize } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';

const router = express.Router();

router.get('/', protect, authorize('auditLogs.read'), tenantMiddleware, getAuditLogs);

export default router;
