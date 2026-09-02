import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Response } from 'express';
import { authorize, requireSuperAdmin, type AuthRequest } from '../../src/middleware/auth';

const createResponse = () => {
  const response = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis()
  };

  return response as unknown as Response;
};

describe('authorize middleware', () => {
  it('returns 401 when the request has no authenticated user', () => {
    const middleware = authorize('products.read');
    const req = {} as AuthRequest;
    const res = createResponse();
    const next = vi.fn() as NextFunction;

    middleware(req, res, next);

    expect((res.status as any)).toHaveBeenCalledWith(401);
    expect((res.json as any)).toHaveBeenCalledWith({ message: 'Not authorized' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when the user lacks the required permission', () => {
    const middleware = authorize('products.delete');
    const req = {
      user: { role: 'staff' },
      permissions: ['products.read']
    } as unknown as AuthRequest;
    const res = createResponse();
    const next = vi.fn() as NextFunction;

    middleware(req, res, next);

    expect((res.status as any)).toHaveBeenCalledWith(403);
    expect((res.json as any)).toHaveBeenCalledWith({
      message: 'Forbidden: insufficient permissions',
      requiredPermissions: ['products.delete']
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next when the user has one of the required permissions', () => {
    const middleware = authorize('products.read', 'products.create');
    const req = {
      user: { role: 'staff' },
      permissions: ['products.read']
    } as unknown as AuthRequest;
    const res = createResponse();
    const next = vi.fn() as NextFunction;

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect((res.status as any)).not.toHaveBeenCalled();
  });
});

describe('requireSuperAdmin middleware', () => {
  it('returns 401 when the request has no authenticated user', () => {
    const req = {} as AuthRequest;
    const res = createResponse();
    const next = vi.fn() as NextFunction;

    requireSuperAdmin(req, res, next);

    expect((res.status as any)).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when the user is not a super admin', () => {
    const req = { user: { role: 'admin' } } as AuthRequest;
    const res = createResponse();
    const next = vi.fn() as NextFunction;

    requireSuperAdmin(req, res, next);

    expect((res.status as any)).toHaveBeenCalledWith(403);
    expect((res.json as any)).toHaveBeenCalledWith({ message: 'Forbidden: super admin only' });
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next when the user is a super admin', () => {
    const req = { user: { role: 'superadmin' } } as AuthRequest;
    const res = createResponse();
    const next = vi.fn() as NextFunction;

    requireSuperAdmin(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect((res.status as any)).not.toHaveBeenCalled();
  });
});
