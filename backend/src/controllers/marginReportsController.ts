import { Response } from 'express';
import { TenantRequest } from '../middleware/tenant';
import { getSaleModel } from '../models/tenant/Sale';
import { getProductModel } from '../models/tenant/Product';
import { getCategoryModel } from '../models/tenant/Category';
import { mergeFilters, unitScope } from '../utils/businessUnit';
import { money2 } from '../utils/money';

const dateFilter = (req: TenantRequest) => {
  const { startDate, endDate, month, year } = req.query;
  if (month && year) {
    const m = Number(month) - 1;
    const y = Number(year);
    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 0, 23, 59, 59, 999);
    return { createdAt: { $gte: start, $lte: end } };
  }
  if (startDate || endDate) {
    const createdAt: Record<string, Date> = {};
    if (startDate) createdAt.$gte = new Date(String(startDate));
    if (endDate) createdAt.$lte = new Date(String(endDate));
    return { createdAt };
  }
  return {};
};

const saleMatch = (req: TenantRequest) =>
  mergeFilters(
    {
      status: { $ne: 'cancelled' },
      ...dateFilter(req),
      ...(req.query.customerId ? { customerId: req.query.customerId } : {}),
      ...(req.query.paymentStatus ? { paymentStatus: req.query.paymentStatus } : {}),
      ...(req.query.paymentMethod
        ? { $or: [{ paymentMode: req.query.paymentMethod }, { 'payments.method': req.query.paymentMethod }] }
        : {})
    },
    unitScope(req)
  );

const emptyBucket = () => ({
  quantity: 0,
  salesRevenue: 0,
  discounts: 0,
  cogs: 0,
  grossProfit: 0,
  paymentsReceived: 0,
  outstanding: 0,
  invoiceCount: 0
});

const finalize = (row: ReturnType<typeof emptyBucket> & { key?: string; name?: string }) => {
  const grossMarginPercent = row.salesRevenue > 0 ? money2((row.grossProfit / row.salesRevenue) * 100) : 0;
  const averageSellingPrice = row.quantity > 0 ? money2(row.salesRevenue / row.quantity) : 0;
  const collectionPercent =
    row.salesRevenue + row.outstanding > 0
      ? money2((row.paymentsReceived / (row.paymentsReceived + row.outstanding || 1)) * 100)
      : row.paymentsReceived > 0
        ? 100
        : 0;
  return {
    ...row,
    salesRevenue: money2(row.salesRevenue),
    discounts: money2(row.discounts),
    cogs: money2(row.cogs),
    grossProfit: money2(row.grossProfit),
    paymentsReceived: money2(row.paymentsReceived),
    outstanding: money2(row.outstanding),
    grossMarginPercent,
    averageSellingPrice,
    collectionPercent
  };
};

export const getMarginReports = async (req: TenantRequest, res: Response) => {
  try {
    const Sale = getSaleModel(req.tenantDB!);
    const Product = getProductModel(req.tenantDB!);
    const Category = getCategoryModel(req.tenantDB!);
    const sales = await Sale.find(saleMatch(req)).populate('customerId').lean();
    const products = await Product.find().lean();
    const categories = await Category.find().lean();
    const productMap = new Map(products.map((row: any) => [String(row._id), row]));
    const categoryMap = new Map(categories.map((row: any) => [String(row._id), row]));

    const productBuckets = new Map<string, ReturnType<typeof emptyBucket> & { key: string; name: string; brand?: string; category?: string }>();
    const categoryBuckets = new Map<string, ReturnType<typeof emptyBucket> & { key: string; name: string }>();
    const monthlyBuckets = new Map<string, ReturnType<typeof emptyBucket> & { key: string; name: string }>();
    const priceVsMax: any[] = [];
    const discountsOverrides: any[] = [];
    const belowCost: any[] = [];
    const receivables: any[] = [];

    let org = emptyBucket();
    let partiallyPaid = 0;
    let unpaid = 0;

    for (const sale of sales as any[]) {
      const invoiceDiscount = Number(sale.discount || 0);
      const amountReceived = Number(sale.amountReceived ?? sale.paidAmount ?? 0);
      const outstanding = Number(sale.outstandingAmount ?? Math.max(0, Number(sale.total || 0) - amountReceived));
      if (sale.paymentStatus === 'partially_paid') partiallyPaid += 1;
      if (sale.paymentStatus === 'unpaid' || (!sale.paymentStatus && outstanding > 0 && amountReceived <= 0)) unpaid += 1;

      if (outstanding > 0.009) {
        receivables.push({
          saleId: sale._id,
          invoiceNumber: sale.invoiceNumber,
          customer: sale.customerId?.name || 'Walk-in',
          customerId: sale.customerId?._id || sale.customerId,
          date: sale.createdAt,
          total: Number(sale.total || 0),
          amountReceived,
          outstanding,
          paymentStatus: sale.paymentStatus || (amountReceived > 0 ? 'partially_paid' : 'unpaid')
        });
      }

      const monthKey = new Date(sale.createdAt).toISOString().slice(0, 7);
      if (!monthlyBuckets.has(monthKey)) {
        monthlyBuckets.set(monthKey, { ...emptyBucket(), key: monthKey, name: monthKey });
      }
      const month = monthlyBuckets.get(monthKey)!;
      month.invoiceCount += 1;
      month.paymentsReceived += amountReceived;
      month.outstanding += outstanding;

      org.invoiceCount += 1;
      org.paymentsReceived += amountReceived;
      org.outstanding += outstanding;

      const items = sale.items || [];
      const lineBases = items.map((item: any) =>
        Math.max(0, Number(item.actualSoldAmount ?? item.price ?? 0) * Number(item.quantity || 0) - Number(item.discount || 0))
      );
      const baseTotal = lineBases.reduce((sum: number, value: number) => sum + value, 0) || 1;

      items.forEach((item: any, index: number) => {
        const product = productMap.get(String(item.productId));
        if (req.query.productId && String(item.productId) !== String(req.query.productId)) return;
        if (req.query.variantId && String(item.variantId || '') !== String(req.query.variantId)) return;
        if (req.query.brand && String(item.brand || product?.brand || '').toLowerCase() !== String(req.query.brand).toLowerCase()) return;
        const categoryId = String(item.categoryId || product?.categoryId || '');
        if (req.query.categoryId && categoryId !== String(req.query.categoryId)) return;

        const qty = Number(item.quantity || 0);
        const lineDiscount = Number(item.discount || 0);
        const allocated = Number(item.allocatedInvoiceDiscount ?? (baseTotal ? (lineBases[index] / baseTotal) * invoiceDiscount : 0));
        const revenue = Number(item.netRevenue ?? Math.max(0, lineBases[index] - allocated));
        const cogs = Number(item.cogs || 0);
        const profit = Number(item.grossProfit ?? revenue - cogs);
        const discounts = money2(lineDiscount + allocated);
        const actual = Number(item.actualSoldAmount ?? item.price ?? 0);
        const maxPrice = Number(item.maxSellingPrice || product?.maxSellingPrice || item.sellingPrice || product?.sellingPrice || 0);
        const defaultPrice = Number(item.sellingPrice || product?.sellingPrice || 0);
        const key = `${item.productId}:${item.variantId || 'base'}`;
        const name = item.productName || product?.name || 'Product';

        if (!productBuckets.has(key)) {
          productBuckets.set(key, {
            ...emptyBucket(),
            key,
            name,
            brand: item.brand || product?.brand,
            category: categoryMap.get(categoryId)?.name || 'Uncategorized'
          });
        }
        const productRow = productBuckets.get(key)!;
        productRow.quantity += qty;
        productRow.salesRevenue += revenue;
        productRow.discounts += discounts;
        productRow.cogs += cogs;
        productRow.grossProfit += profit;

        if (!categoryBuckets.has(categoryId || 'none')) {
          categoryBuckets.set(categoryId || 'none', {
            ...emptyBucket(),
            key: categoryId || 'none',
            name: categoryMap.get(categoryId)?.name || 'Uncategorized'
          });
        }
        const categoryRow = categoryBuckets.get(categoryId || 'none')!;
        categoryRow.quantity += qty;
        categoryRow.salesRevenue += revenue;
        categoryRow.discounts += discounts;
        categoryRow.cogs += cogs;
        categoryRow.grossProfit += profit;

        month.quantity += qty;
        month.salesRevenue += revenue;
        month.discounts += discounts;
        month.cogs += cogs;
        month.grossProfit += profit;

        org.quantity += qty;
        org.salesRevenue += revenue;
        org.discounts += discounts;
        org.cogs += cogs;
        org.grossProfit += profit;

        if (maxPrice > 0) {
          priceVsMax.push({
            invoiceNumber: sale.invoiceNumber,
            date: sale.createdAt,
            product: name,
            quantity: qty,
            defaultPrice,
            maxSellingPrice: maxPrice,
            actualSellingPrice: actual,
            difference: money2(maxPrice - actual),
            overrideReason: item.priceOverrideReason || ''
          });
        }

        if (discounts > 0 || (maxPrice > 0 && actual > maxPrice) || (defaultPrice > 0 && actual !== defaultPrice)) {
          discountsOverrides.push({
            invoiceNumber: sale.invoiceNumber,
            date: sale.createdAt,
            product: name,
            defaultPrice,
            maxSellingPrice: maxPrice,
            actualSellingPrice: actual,
            discount: discounts,
            overrideReason: item.priceOverrideReason || ''
          });
        }

        if (actual > 0 && Number(item.costPerUnit || item.costPrice || 0) > actual) {
          belowCost.push({
            invoiceNumber: sale.invoiceNumber,
            date: sale.createdAt,
            product: name,
            quantity: qty,
            costPerUnit: Number(item.costPerUnit || item.costPrice || 0),
            actualSellingPrice: actual,
            loss: money2((Number(item.costPerUnit || item.costPrice || 0) - actual) * qty)
          });
        }
      });
    }

    const organization = finalize(org);
    res.json({
      organization,
      products: [...productBuckets.values()].map(finalize).sort((a, b) => b.grossProfit - a.grossProfit),
      categories: [...categoryBuckets.values()].map(finalize).sort((a, b) => b.grossProfit - a.grossProfit),
      monthly: [...monthlyBuckets.values()].map(finalize).sort((a, b) => String(a.key || '').localeCompare(String(b.key || ''))),
      receivables: receivables.sort((a, b) => b.outstanding - a.outstanding),
      collections: {
        totalInvoices: org.invoiceCount,
        partiallyPaid,
        unpaid,
        amountReceived: organization.paymentsReceived,
        outstanding: organization.outstanding,
        collectionPercent: organization.collectionPercent
      },
      priceVsMax,
      discountsOverrides,
      belowCost
    });
  } catch (error) {
    console.error('Error building margin reports:', error);
    res.status(500).json({ message: 'Error building margin reports' });
  }
};
