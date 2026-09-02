import { Response } from 'express';
import { TenantRequest } from '../middleware/tenant';
import AuditLog from '../models/master/AuditLog';

import { paginatedResult, parsePagination } from '../utils/pagination';

export const getAuditLogs = async (req: TenantRequest, res: Response) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);

    const query: any = {};
    if (req.business) {
      query.tenantId = req.business.tenantId;
    }

    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'name email')
        .populate('businessId', 'businessName'),
      AuditLog.countDocuments(query)
    ]);

    res.json({
      ...paginatedResult(logs, total, page, limit),
      logs,
      pagination: paginatedResult(logs, total, page, limit)
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ message: 'Error fetching audit logs' });
  }
};
