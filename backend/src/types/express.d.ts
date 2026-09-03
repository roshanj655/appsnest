import type { Permission } from '../constants/permissions';

declare global {
  namespace Express {
    interface Request {
      user?: any;
      permissions?: Permission[];
      tenantDB?: any;
      business?: any;
    }
  }
}

export {};
