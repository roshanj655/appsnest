import express from 'express';
import {
  getDashboardStats,
  getSalesReport,
  getPurchasesReport,
  getInventoryReport,
  getLowStockReport,
  getProfitReport,
  getPersonalExpenseReport,
  getByUnitReport,
  getPurchaseHistoryReport
} from '../controllers/reportsController';
import { getMarginReports } from '../controllers/marginReportsController';
import { protect, authorize } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';

const router = express.Router();

router.get('/dashboard', protect, authorize('reports.dashboard.read'), tenantMiddleware, getDashboardStats);
router.get('/sales', protect, authorize('reports.sales.read'), tenantMiddleware, getSalesReport);
router.get('/purchases', protect, authorize('reports.purchases.read'), tenantMiddleware, getPurchasesReport);
router.get('/inventory', protect, authorize('reports.inventory.read'), tenantMiddleware, getInventoryReport);
router.get('/low-stock', protect, authorize('reports.lowStock.read'), tenantMiddleware, getLowStockReport);
router.get('/profit', protect, authorize('reports.profit.read'), tenantMiddleware, getProfitReport);
router.get('/personal-expenses', protect, authorize('reports.profit.read', 'expenses.read'), tenantMiddleware, getPersonalExpenseReport);
router.get('/margins', protect, authorize('reports.margins.read'), tenantMiddleware, getMarginReports);
router.get('/purchase-history', protect, authorize('reports.purchases.read'), tenantMiddleware, getPurchaseHistoryReport);
router.get('/by-unit', protect, authorize('reports.dashboard.read'), tenantMiddleware, getByUnitReport);

export default router;
