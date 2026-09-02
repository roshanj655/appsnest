import { Response } from 'express';
import { TenantRequest } from '../middleware/tenant';
import { getProductModel } from '../models/tenant/Product';
import { getSaleModel } from '../models/tenant/Sale';
import { getPurchaseModel } from '../models/tenant/Purchase';
import { getExpenseModel } from '../models/tenant/Expense';
import { getBusinessUnitModel } from '../models/tenant/BusinessUnit';
import { mergeFilters, unitScope } from '../utils/businessUnit';
import { startOfDay, endOfDay, startOfMonth, endOfMonth, subMonths } from 'date-fns';

const scoped = (req: TenantRequest, extra: Record<string, unknown> = {}) =>
  mergeFilters(extra, unitScope(req));

export const getDashboardStats = async (req: TenantRequest, res: Response) => {
  try {
    const Product = getProductModel(req.tenantDB!);
    const Sale = getSaleModel(req.tenantDB!);
    const Purchase = getPurchaseModel(req.tenantDB!);
    const Expense = getExpenseModel(req.tenantDB!);

    const now = new Date();
    const startOfCurrentMonth = startOfMonth(now);
    const endOfCurrentMonth = endOfMonth(now);
    const startOfLastMonth = startOfMonth(subMonths(now, 1));
    const endOfLastMonth = endOfMonth(subMonths(now, 1));

    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);

    const [
      totalProducts,
      lowStockProducts,
      monthlySales,
      lastMonthSales,
      monthlyPurchases,
      lastMonthPurchases,
      monthlyExpenses,
      lastMonthExpenses,
      todaySales,
      todayPurchases,
      todayExpenses,
      recentSales,
      recentPurchases,
      topProducts
    ] = await Promise.all([
      Product.countDocuments(unitScope(req)),
      Product.countDocuments(scoped(req, { stock: { $lte: 10 } })),
      Sale.aggregate([
        { $match: scoped(req, { createdAt: { $gte: startOfCurrentMonth, $lte: endOfCurrentMonth } }) },
        { $group: { _id: null, total: { $sum: '$total' } } }
      ]),
      Sale.aggregate([
        { $match: scoped(req, { createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth } }) },
        { $group: { _id: null, total: { $sum: '$total' } } }
      ]),
      Purchase.aggregate([
        { $match: scoped(req, { createdAt: { $gte: startOfCurrentMonth, $lte: endOfCurrentMonth } }) },
        { $group: { _id: null, total: { $sum: '$total' } } }
      ]),
      Purchase.aggregate([
        { $match: scoped(req, { createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth } }) },
        { $group: { _id: null, total: { $sum: '$total' } } }
      ]),
      Expense.aggregate([
        { $match: scoped(req, { status: 'active', expenseDate: { $gte: startOfCurrentMonth, $lte: endOfCurrentMonth } }) },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Expense.aggregate([
        { $match: scoped(req, { status: 'active', expenseDate: { $gte: startOfLastMonth, $lte: endOfLastMonth } }) },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Sale.aggregate([
        { $match: scoped(req, { status: 'completed', createdAt: { $gte: todayStart, $lte: todayEnd } }) },
        { $group: { _id: null, total: { $sum: '$total' } } }
      ]),
      Purchase.aggregate([
        { $match: scoped(req, { status: 'completed', createdAt: { $gte: todayStart, $lte: todayEnd } }) },
        { $group: { _id: null, total: { $sum: '$total' } } }
      ]),
      Expense.aggregate([
        { $match: scoped(req, { status: 'active', expenseDate: { $gte: todayStart, $lte: todayEnd } }) },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Sale.find(scoped(req, { status: 'completed' })).populate('customerId').sort({ createdAt: -1 }).limit(5),
      Purchase.find(scoped(req, { status: 'completed' })).populate('supplierId').sort({ createdAt: -1 }).limit(5),
      Sale.aggregate([
        { $match: scoped(req, { status: 'completed' }) },
        { $unwind: '$items' },
        { $group: { _id: '$items.productId', quantity: { $sum: '$items.quantity' }, revenue: { $sum: '$items.total' } } },
        { $sort: { quantity: -1 } },
        { $limit: 5 }
      ])
    ]);

    const monthlySalesTotal = monthlySales[0]?.total || 0;
    const lastMonthSalesTotal = lastMonthSales[0]?.total || 0;
    const monthlyPurchasesTotal = monthlyPurchases[0]?.total || 0;
    const lastMonthPurchasesTotal = lastMonthPurchases[0]?.total || 0;
    const monthlyExpensesTotal = monthlyExpenses[0]?.total || 0;
    const lastMonthExpensesTotal = lastMonthExpenses[0]?.total || 0;
    const todaySalesTotal = todaySales[0]?.total || 0;
    const todayPurchasesTotal = todayPurchases[0]?.total || 0;
    const todayExpensesTotal = todayExpenses[0]?.total || 0;
    const todayProfit = todaySalesTotal - todayPurchasesTotal - todayExpensesTotal;

    const monthlyProfit = monthlySalesTotal - monthlyPurchasesTotal - monthlyExpensesTotal;
    const lastMonthProfit = lastMonthSalesTotal - lastMonthPurchasesTotal - lastMonthExpensesTotal;

    const populatedTop = await Product.find({ _id: { $in: topProducts.map((row: any) => row._id) } });
    const topProductRows = topProducts.map((row: any) => {
      const product = populatedTop.find((item: any) => item._id.toString() === String(row._id));
      return {
        productId: row._id,
        name: product?.name || 'Unknown',
        quantity: row.quantity,
        revenue: row.revenue
      };
    });

    res.json({
      totalProducts,
      lowStockProducts,
      monthlySales: monthlySalesTotal,
      lastMonthSales: lastMonthSalesTotal,
      monthlyPurchases: monthlyPurchasesTotal,
      lastMonthPurchases: lastMonthPurchasesTotal,
      monthlyExpenses: monthlyExpensesTotal,
      lastMonthExpenses: lastMonthExpensesTotal,
      monthlyProfit,
      lastMonthProfit,
      todaySales: todaySalesTotal,
      todayPurchases: todayPurchasesTotal,
      todayExpenses: todayExpensesTotal,
      todayProfit,
      recentSales,
      recentPurchases,
      topProducts: topProductRows
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ message: 'Error fetching dashboard stats' });
  }
};

export const getSalesReport = async (req: TenantRequest, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    const Sale = getSaleModel(req.tenantDB!);

    let query: any = scoped(req, { status: 'completed' });

    if (startDate && endDate) {
      query = scoped(req, {
        status: 'completed',
        createdAt: {
          $gte: new Date(startDate as string),
          $lte: new Date(endDate as string)
        }
      });
    }

    const sales = await Sale.find(query).populate('customerId').sort({ createdAt: -1 });
    const totalAmount = sales.reduce((sum: number, sale: any) => sum + sale.total, 0);

    res.json({ sales, totalAmount });
  } catch (error) {
    console.error('Error fetching sales report:', error);
    res.status(500).json({ message: 'Error fetching sales report' });
  }
};

export const getPurchasesReport = async (req: TenantRequest, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    const Purchase = getPurchaseModel(req.tenantDB!);

    let query: any = scoped(req, { status: 'completed' });

    if (startDate && endDate) {
      query = scoped(req, {
        status: 'completed',
        createdAt: {
          $gte: new Date(startDate as string),
          $lte: new Date(endDate as string)
        }
      });
    }

    const purchases = await Purchase.find(query).populate('supplierId').sort({ createdAt: -1 });
    const totalAmount = purchases.reduce((sum: number, purchase: any) => sum + purchase.total, 0);

    res.json({ purchases, totalAmount });
  } catch (error) {
    console.error('Error fetching purchases report:', error);
    res.status(500).json({ message: 'Error fetching purchases report' });
  }
};

export const getInventoryReport = async (req: TenantRequest, res: Response) => {
  try {
    const Product = getProductModel(req.tenantDB!);
    const products = await Product.find(unitScope(req)).populate('categoryId').sort({ name: 1 });
    const rows: any[] = [];
    for (const product of products as any[]) {
      if (product.variants?.length) {
        for (const variant of product.variants) {
          const purchasePrice = Number(variant.purchasePrice || product.purchasePrice || 0);
          const sellingPrice = Number(variant.sellingPrice || product.sellingPrice || 0);
          rows.push({
            productId: product._id,
            variantId: variant._id,
            name: `${product.name} (${variant.name})`,
            sku: variant.sku || product.sku,
            categoryId: product.categoryId,
            stock: variant.stock,
            purchasePrice,
            sellingPrice,
            stockValue: variant.stock * purchasePrice,
            sellingValue: variant.stock * sellingPrice
          });
        }
      } else {
        rows.push({
          productId: product._id,
          variantId: null,
          name: product.name,
          sku: product.sku,
          categoryId: product.categoryId,
          stock: product.stock,
          purchasePrice: product.purchasePrice,
          sellingPrice: product.sellingPrice,
          stockValue: product.stock * product.purchasePrice,
          sellingValue: product.stock * product.sellingPrice
        });
      }
    }
    const totalStockValue = rows.reduce((sum, row) => sum + row.stockValue, 0);
    const totalSellingValue = rows.reduce((sum, row) => sum + row.sellingValue, 0);
    res.json({ products: rows, totalStockValue, totalSellingValue });
  } catch (error) {
    console.error('Error fetching inventory report:', error);
    res.status(500).json({ message: 'Error fetching inventory report' });
  }
};

export const getLowStockReport = async (req: TenantRequest, res: Response) => {
  try {
    const Product = getProductModel(req.tenantDB!);
    const threshold = parseInt(req.query.threshold as string) || 10;
    const products = await Product.find(unitScope(req)).populate('categoryId');
    const lowStockProducts: any[] = [];
    for (const product of products as any[]) {
      if (product.variants?.length) {
        for (const variant of product.variants) {
          if (Number(variant.stock) <= threshold) {
            lowStockProducts.push({
              ...product.toObject(),
              name: `${product.name} (${variant.name})`,
              sku: variant.sku || product.sku,
              stock: variant.stock,
              variantId: variant._id
            });
          }
        }
      } else if (product.stock <= threshold) {
        lowStockProducts.push(product);
      }
    }

    res.json({ products: lowStockProducts, threshold });
  } catch (error) {
    console.error('Error fetching low stock report:', error);
    res.status(500).json({ message: 'Error fetching low stock report' });
  }
};

export const getProfitReport = async (req: TenantRequest, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    const Sale = getSaleModel(req.tenantDB!);
    const Purchase = getPurchaseModel(req.tenantDB!);
    const Expense = getExpenseModel(req.tenantDB!);

    const dateRange = startDate && endDate
      ? {
          $gte: new Date(startDate as string),
          $lte: new Date(endDate as string)
        }
      : undefined;
    const saleQuery: any = scoped(req, {
      status: 'completed',
      ...(dateRange ? { createdAt: dateRange } : {})
    });
    const purchaseQuery: any = scoped(req, {
      status: 'completed',
      ...(dateRange ? { createdAt: dateRange } : {})
    });
    const expenseQuery: any = scoped(req, {
      status: 'active',
      ...(dateRange ? { expenseDate: dateRange } : {})
    });

    const [sales, purchases, expenses, catalog] = await Promise.all([
      Sale.find(saleQuery),
      Purchase.find(purchaseQuery),
      Expense.find(expenseQuery),
      getProductModel(req.tenantDB!).find()
    ]);

    const totalSales = sales.reduce((sum: number, s: any) => sum + s.total, 0);
    const totalPurchases = purchases.reduce((sum: number, p: any) => sum + p.total, 0);
    const totalMiscExpenses = expenses.reduce((sum: number, e: any) => sum + e.amount, 0);
    const totalExpenses = totalPurchases + totalMiscExpenses;
    const grossProfit = totalSales - totalExpenses;

    // Calculate per-item profit from sales
    const itemProfits: any[] = [];
    for (const sale of sales) {
      for (const item of sale.items as any[]) {
        const productId = String(item.productId);
        const variantId = item.variantId ? String(item.variantId) : '';
        const key = `${productId}:${variantId || 'base'}`;
        let existingItem = itemProfits.find((row) => row.key === key);
        const product = (catalog as any[]).find((row) => String(row._id) === productId);
        const variant = variantId
          ? product?.variants?.find((row: any) => String(row._id) === variantId)
          : null;
        const costEach = Number(
          item.costPrice ??
          variant?.purchasePrice ??
          product?.purchasePrice ??
          0
        );
        if (!existingItem) {
          existingItem = {
            key,
            productId,
            variantId: variantId || null,
            name: item.productName || (variant ? `${product?.name} (${variant.name})` : product?.name) || 'Product',
            quantity: 0,
            totalRevenue: 0,
            totalCost: 0,
            profit: 0
          };
          itemProfits.push(existingItem);
        }
        existingItem.quantity += item.quantity;
        existingItem.totalRevenue += item.total;
        existingItem.totalCost += costEach * item.quantity;
        existingItem.profit = existingItem.totalRevenue - existingItem.totalCost;
      }
    }

    res.json({
      totalSales,
      totalPurchases,
      totalMiscExpenses,
      totalExpenses,
      grossProfit,
      profitMargin: totalSales > 0 ? ((grossProfit / totalSales) * 100) : 0,
      itemProfits
    });
  } catch (error) {
    console.error('Error fetching profit report:', error);
    res.status(500).json({ message: 'Error fetching profit report' });
  }
};

export const getByUnitReport = async (req: TenantRequest, res: Response) => {
  try {
    const BusinessUnit = getBusinessUnitModel(req.tenantDB!);
    const Sale = getSaleModel(req.tenantDB!);
    const Purchase = getPurchaseModel(req.tenantDB!);
    const Expense = getExpenseModel(req.tenantDB!);
    const Product = getProductModel(req.tenantDB!);

    const units = await BusinessUnit.find({ status: 'active' }).sort({ name: 1 });
    const [salesByUnit, purchasesByUnit, expensesByUnit, productsByUnit] = await Promise.all([
      Sale.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: '$businessUnitId', total: { $sum: '$total' }, count: { $sum: 1 } } }
      ]),
      Purchase.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: '$businessUnitId', total: { $sum: '$total' }, count: { $sum: 1 } } }
      ]),
      Expense.aggregate([
        { $match: { status: 'active' } },
        { $group: { _id: '$businessUnitId', total: { $sum: '$amount' }, count: { $sum: 1 } } }
      ]),
      Product.aggregate([
        { $group: { _id: '$businessUnitId', count: { $sum: 1 }, stockValue: { $sum: { $multiply: ['$stock', '$purchasePrice'] } } } }
      ])
    ]);

    const pick = (rows: Array<{ _id: unknown; total?: number; count?: number; stockValue?: number }>, id: string | null) => {
      const row = rows.find((item) => {
        if (!id) {
          return item._id == null;
        }
        return String(item._id) === id;
      });
      return {
        total: row?.total || 0,
        count: row?.count || 0,
        stockValue: row?.stockValue || 0
      };
    };

    const unitsWithTotals = units.map((unit) => {
      const id = unit._id.toString();
      const sales = pick(salesByUnit, id);
      const purchases = pick(purchasesByUnit, id);
      const expenses = pick(expensesByUnit, id);
      const products = pick(productsByUnit, id);
      const profit = sales.total - purchases.total - expenses.total;
      return {
        businessUnitId: id,
        name: unit.name,
        code: unit.code,
        sales: sales.total,
        salesCount: sales.count,
        purchases: purchases.total,
        purchasesCount: purchases.count,
        expenses: expenses.total,
        expensesCount: expenses.count,
        products: products.count,
        stockValue: products.stockValue,
        profit
      };
    });

    const unassignedSales = pick(salesByUnit, null);
    const unassignedPurchases = pick(purchasesByUnit, null);
    const unassignedExpenses = pick(expensesByUnit, null);
    const unassignedProducts = pick(productsByUnit, null);
    const unassigned = {
      businessUnitId: null,
      name: 'Unassigned',
      code: 'NONE',
      sales: unassignedSales.total,
      salesCount: unassignedSales.count,
      purchases: unassignedPurchases.total,
      purchasesCount: unassignedPurchases.count,
      expenses: unassignedExpenses.total,
      expensesCount: unassignedExpenses.count,
      products: unassignedProducts.count,
      stockValue: unassignedProducts.stockValue,
      profit: unassignedSales.total - unassignedPurchases.total - unassignedExpenses.total
    };

    const allRows = [...unitsWithTotals, unassigned];
    const combined = allRows.reduce(
      (acc, row) => ({
        sales: acc.sales + row.sales,
        purchases: acc.purchases + row.purchases,
        expenses: acc.expenses + row.expenses,
        products: acc.products + row.products,
        stockValue: acc.stockValue + row.stockValue,
        profit: acc.profit + row.profit
      }),
      { sales: 0, purchases: 0, expenses: 0, products: 0, stockValue: 0, profit: 0 }
    );

    res.json({ units: allRows, combined });
  } catch (error) {
    console.error('Error fetching by-unit report:', error);
    res.status(500).json({ message: 'Error fetching by-unit report' });
  }
};
