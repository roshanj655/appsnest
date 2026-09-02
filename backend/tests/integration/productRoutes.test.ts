import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authState = vi.hoisted(() => ({
  permissions: [] as string[]
}));

vi.mock('../../src/middleware/auth', async () => {
  const actual = await vi.importActual<typeof import('../../src/middleware/auth')>('../../src/middleware/auth');

  return {
    ...actual,
    protect: (req: any, _res: any, next: any) => {
      req.user = { _id: 'user-1', role: 'staff' };
      req.permissions = [...authState.permissions];
      next();
    }
  };
});

vi.mock('../../src/middleware/tenant', () => ({
  tenantMiddleware: (req: any, _res: any, next: any) => {
    req.tenantDB = {};
    req.business = { _id: 'business-1' };
    next();
  }
}));

vi.mock('../../src/controllers/productController', () => ({
  getProducts: (_req: any, res: any) => res.json({ route: 'getProducts' }),
  createProduct: (_req: any, res: any) => res.status(201).json({ route: 'createProduct' }),
  updateProduct: (_req: any, res: any) => res.json({ route: 'updateProduct' }),
  deleteProduct: (_req: any, res: any) => res.json({ route: 'deleteProduct' })
}));

import productRoutes from '../../src/routes/productRoutes';

const app = express();
app.use(express.json());
app.use('/products', productRoutes);

describe('product routes RBAC integration', () => {
  beforeEach(() => {
    authState.permissions = [];
  });

  it('allows listing products when products.read is present', async () => {
    authState.permissions = ['products.read'];

    const response = await request(app).get('/products');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ route: 'getProducts' });
  });

  it('blocks product deletion when products.delete is missing', async () => {
    authState.permissions = ['products.read'];

    const response = await request(app).delete('/products/123');

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      message: 'Forbidden: insufficient permissions',
      requiredPermissions: ['products.delete']
    });
  });

  it('allows product creation when products.create is present', async () => {
    authState.permissions = ['products.create'];

    const response = await request(app).post('/products').send({ name: 'Keyboard', sku: 'KB-1' });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ route: 'createProduct' });
  });
});
