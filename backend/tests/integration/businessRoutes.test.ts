import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authState = vi.hoisted(() => ({
  role: 'staff'
}));

vi.mock('../../src/middleware/auth', async () => {
  const actual = await vi.importActual<typeof import('../../src/middleware/auth')>('../../src/middleware/auth');

  return {
    ...actual,
    protect: (req: any, _res: any, next: any) => {
      req.user = { _id: 'user-1', role: authState.role };
      next();
    }
  };
});

vi.mock('../../src/controllers/businessController', () => ({
  getBusinesses: (_req: any, res: any) => res.json({ route: 'getBusinesses' }),
  updateBusiness: (_req: any, res: any) => res.json({ route: 'updateBusiness' }),
  updateBusinessStatus: (_req: any, res: any) => res.json({ route: 'updateBusinessStatus' }),
  updateBusinessSubscription: (_req: any, res: any) => res.json({ route: 'updateBusinessSubscription' }),
  deleteBusiness: (_req: any, res: any) => res.json({ route: 'deleteBusiness' })
}));

import businessRoutes from '../../src/routes/businessRoutes';

const app = express();
app.use(express.json());
app.use('/businesses', businessRoutes);

describe('business routes super admin RBAC', () => {
  beforeEach(() => {
    authState.role = 'staff';
  });

  it('blocks tenant admins from listing businesses', async () => {
    authState.role = 'admin';

    const response = await request(app).get('/businesses');

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: 'Forbidden: super admin only' });
  });

  it('allows super admin to list and update subscription', async () => {
    authState.role = 'superadmin';

    const list = await request(app).get('/businesses');
    const subscription = await request(app)
      .patch('/businesses/123/subscription')
      .send({ subscriptionEndsAt: '2026-12-31' });

    expect(list.status).toBe(200);
    expect(list.body).toEqual({ route: 'getBusinesses' });
    expect(subscription.status).toBe(200);
    expect(subscription.body).toEqual({ route: 'updateBusinessSubscription' });
  });
});
