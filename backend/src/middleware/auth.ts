import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import User from '../models/master/User';
import { resolvePermissions, type Permission } from '../constants/permissions';

export interface AuthRequest extends Request {
  user?: any;
  permissions?: Permission[];
}

export const protect = async (req: AuthRequest, res: Response, next: NextFunction) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }

  try {
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET as string);
    req.user = await User.findById(decoded.id).populate('businessId');
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized, user not found' });
    }
    req.permissions = resolvePermissions(req.user);
    next();
  } catch (error) {
    res.status(401).json({ message: 'Not authorized, token failed' });
  }
};

export const authorize = (...requiredPermissions: Permission[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    const resolvedPermissions = req.permissions || resolvePermissions(req.user);
    const hasRequiredPermission = requiredPermissions.some((permission) =>
      resolvedPermissions.includes(permission)
    );

    if (!hasRequiredPermission) {
      return res.status(403).json({
        message: 'Forbidden: insufficient permissions',
        requiredPermissions
      });
    }

    req.permissions = resolvedPermissions;
    next();
  };
};

export const requireSuperAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Not authorized' });
  }

  if (req.user.role !== 'superadmin') {
    return res.status(403).json({ message: 'Forbidden: super admin only' });
  }

  next();
};
