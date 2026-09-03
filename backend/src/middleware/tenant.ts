import { Request, RequestHandler } from 'express';
import { getTenantConnection } from '../utils/tenantConnection';
import { getBusinessAccessError } from '../utils/businessAccess';
import { IBusiness } from '../models/master/Business';

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
    req.tenantDB = tenantConnection;
    req.business = business;
    next();
  } catch (error) {
    console.error('Tenant middleware error:', error);
    res.status(500).json({ message: 'Error connecting to tenant database' });
  }
};
