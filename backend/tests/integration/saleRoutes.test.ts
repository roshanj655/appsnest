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

vi.mock('../../src/controllers/saleController', () => ({
  getSales: (_req: any, res: any) => res.json({ route: 'getSales' }),
  createSale: (_req: any, res: any) => res.status(201).json({ route: 'createSale' }),
  updateSale: (_req: any, res: any) => res.json({ route: 'updateSale' }),
  deleteSale: (_req: any, res: any) => res.json({ route: 'deleteSale' }),
  downloadInvoice: (_req: any, res: any) => res.json({ route: 'downloadInvoice' }),
  sendInvoiceEmail: (_req: any, res: any) => res.json({ route: 'sendInvoiceEmail' }),
  uploadAttachment: (_req: any, res: any) => res.json({ route: 'uploadAttachment' }),
  downloadAttachment: (_req: any, res: any) => res.json({ route: 'downloadAttachment' })
}));

import saleRoutes from '../../src/routes/saleRoutes';

const app = express();
app.use(express.json());
app.use('/sales', saleRoutes);

describe('sale routes RBAC integration', () => {
  beforeEach(() => {
    authState.permissions = [];
  });

  it('blocks invoice download without sales.invoice.download', async () => {
    authState.permissions = ['sales.read'];

    const response = await request(app).get('/sales/123/invoice');

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      message: 'Forbidden: insufficient permissions',
      requiredPermissions: ['sales.invoice.download']
    });
  });

  it('allows sending invoice email with sales.email.send', async () => {
    authState.permissions = ['sales.email.send'];

    const response = await request(app).post('/sales/123/email').send({ to: 'customer@example.com' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ route: 'sendInvoiceEmail' });
  });

  it('allows attachment download with sales.attachments.download', async () => {
    authState.permissions = ['sales.attachments.download'];

    const response = await request(app).get('/sales/123/attachments/456/download');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ route: 'downloadAttachment' });
  });
});
