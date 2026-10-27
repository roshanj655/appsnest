import { Request, RequestHandler } from 'express';
import { getTenantConnection } from '../utils/tenantConnection';
import { getBusinessAccessError } from '../utils/businessAccess';
import { IBusiness } from '../models/master/Business';
import { ensureTenantReady } from '../services/tenantInitializer';

export type TenantRequest = Request;

export const tenantMiddleware: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user || !req.user.businessId) {
      return res.status(400).json({ message: 'No business associated with user' });
    }

    const business = req.user.businessId as IBusiness;
    const accessError = getBusinessAccessError(business);
    if (accessError) {
      return res.status(403).json({ message: accessError });
    }

    const tenantConnection = await getTenantConnection(business);
    await ensureTenantReady(tenantConnection, business);
    req.tenantDB = tenantConnection;
    req.business = business;
    next();
  } catch (error: any) {
    console.error('Tenant middleware error:', error?.message || error);
    res.status(error?.status || 500).json({
      message: error?.message || 'Error connecting to tenant database'
    });
  }
};
