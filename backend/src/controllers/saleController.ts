import { Response } from 'express';
import { TenantRequest } from '../middleware/tenant';
import { getSaleModel, IAttachment } from '../models/tenant/Sale';
import { getProductModel } from '../models/tenant/Product';
import { getCustomerModel } from '../models/tenant/Customer';
import { getSettingsModel } from '../models/tenant/Settings';
import { generateInvoicePDF, generateThermalReceipt, generateInvoicePDFBuffer, invoicePdfFilename } from '../services/invoiceService';
import { applySaleLines, reverseSaleLines, withOptionalTransaction } from '../services/inventoryCosting';
import {
  applyFinanceSnapshot,
  recordSalePayment,
  reverseSalePayment,
  syncCustomerBalances
} from '../services/salePayments';
import { money2, mulMoney } from '../utils/money';
import { buildInitialPayment, normalizePaymentMethod } from '../utils/saleFinance';
import { logAuditEvent } from '../utils/auditLogger';
import { sendEmail, mailerConfigFromSettings, describeMailError } from '../services/emailService';
import path from 'path';
import fs from 'fs';
import mongoose from 'mongoose';

import { paginatedResult, parsePagination, textSearch } from '../utils/pagination';
import { mergeFilters, resolveBusinessUnitId, unitScope } from '../utils/businessUnit';
import { nextFyInvoiceNumber, fyInvoiceQuery } from '../utils/invoiceNumber';

const partyAddress = (party: any) =>
  [party?.address, party?.city, party?.state, party?.pincode].map((part) => String(part || '').trim()).filter(Boolean).join(', ');

const sameState = (left?: string, right?: string) => {
  const a = String(left || '').trim().toLowerCase();
  const b = String(right || '').trim().toLowerCase();
  return Boolean(a && b && a === b);
};

const saleInvoicePayload = (sale: any, settings: any) => {
  const customer = sale.customerId && typeof sale.customerId === 'object' ? sale.customerId : null;
  const dueDays = Number(settings?.invoiceDueDays || 15);
  const dueDate = new Date(sale.createdAt);
  dueDate.setDate(dueDate.getDate() + dueDays);
  const interstate = Boolean(customer?.state && settings?.state && !sameState(customer.state, settings.state));
  return {
    invoiceNumber: sale.invoiceNumber,
    date: sale.createdAt,
    dueDate,
    businessName: settings?.businessName || '',
    businessPhone: settings?.phone || '',
    businessEmail: settings?.email || '',
    businessAddress: settings?.address,
    businessCity: settings?.city,
    businessState: settings?.state,
    businessPincode: settings?.pincode,
    gstin: settings?.gstin,
    pan: settings?.pan,
    logo: settings?.logo,
    partyName: customer?.name,
    partyPhone: customer?.phone,
    partyEmail: customer?.email,
    partyAddress: partyAddress(customer),
    partyGstin: customer?.gstin,
    placeOfSupply: customer?.state || settings?.state,
    interstate,
    items: (sale.items || []).map((item: any) => ({
      name: item.productName || item.productId?.name || 'Product',
      description: item.productId?.description || item.notes || '',
      quantity: item.quantity,
      price: item.price,
      total: item.total,
      hsn: item.productId?.hsn || '',
      gst: item.gst,
      discount: item.discount
    })),
    subtotal: sale.subtotal,
    discount: sale.discount,
    tax: sale.gst,
    total: sale.total,
    paymentMode: sale.paymentMode,
    paidAmount: sale.paidAmount,
    changeAmount: sale.changeAmount,
    source: sale.source,
    footerText: settings?.footerText,
    bankName: settings?.bankName,
    bankBranch: settings?.bankBranch,
    bankAccountName: settings?.bankAccountName,
    bankAccountNumber: settings?.bankAccountNumber,
    bankIfsc: settings?.bankIfsc,
    bankSwift: settings?.bankSwift
  };
};

export const getSales = async (req: TenantRequest, res: Response) => {
  try {
    const Sale = getSaleModel(req.tenantDB!);
    const { page, limit, skip, search } = parsePagination(req.query);
    const filter = mergeFilters(textSearch(search, ['invoiceNumber', 'paymentMode', 'status']), unitScope(req));
    const [items, total] = await Promise.all([
      Sale.find(filter).populate('customerId').populate('items.productId').sort({ createdAt: -1 }).skip(skip).limit(limit),
      Sale.countDocuments(filter)
    ]);
    res.json(paginatedResult(items, total, page, limit));
  } catch (error) {
    res.status(500).json({ message: 'Error fetching sales' });
  }
};

export const createSale = async (req: TenantRequest, res: Response) => {
  try {
    const Sale = getSaleModel(req.tenantDB!);
    const Product = getProductModel(req.tenantDB!);
    const Settings = getSettingsModel(req.tenantDB!);

    // Get settings for invoice prefix
    let settings = await Settings.findOne();
    const prefix = settings?.invoicePrefix || 'INV';
    const lastInSeries = await Sale.findOne({ invoiceNumber: fyInvoiceQuery(prefix) }).sort({ invoiceNumber: -1 });
    const invoiceNumber = nextFyInvoiceNumber(lastInSeries?.invoiceNumber, prefix);

    // Parse items from JSON string if needed (in case of FormData)
    let items = req.body.items;
    if (typeof items === 'string') {
      items = JSON.parse(items);
    }

    // Process attachments
    const attachments: IAttachment[] = [];
    if (req.files && Array.isArray(req.files)) {
      req.files.forEach((file) => {
        attachments.push({
          originalName: file.originalname,
          filename: file.filename,
          path: file.path,
          size: file.size,
          mimetype: file.mimetype
        });
      });
    }

    items = (items || []).map((item: any) => {
      const listPrice = Number(item.sellingPrice ?? item.price ?? 0);
      const actualSoldAmount = Number(item.actualSoldAmount ?? item.price ?? listPrice);
      return { ...item, sellingPrice: listPrice, actualSoldAmount, price: actualSoldAmount };
    });

    if (!items.length) {
      return res.status(400).json({ message: 'Add at least one item.' });
    }

    const productIds = items.map((item: any) => item.productId);
    const products = await Product.find({ _id: { $in: productIds } });
    const enrichedItems = [];
    for (const item of items) {
      const product = products.find((row: any) => String(row._id) === String(item.productId));
      if (!product) {
        return res.status(400).json({ message: 'One or more products were not found.' });
      }
      if (product.status === 'inactive') {
        return res.status(400).json({ message: `${product.name} is inactive.` });
      }
      const variants = product.variants || [];
      const variantId = String(item.variantId || '').trim();
      if (variants.length) {
        if (!variantId) {
          return res.status(400).json({ message: `Pick a variant for ${product.name}.` });
        }
        const variant = variants.find((row: any) => String(row._id) === variantId);
        if (!variant) {
          return res.status(400).json({ message: `Variant not found for ${product.name}.` });
        }
        if (Number(variant.stock) < Number(item.quantity)) {
          return res.status(400).json({ message: `${product.name} (${variant.name}) has only ${variant.stock} in stock.` });
        }
        const maxSellingPrice = Number(variant.maxSellingPrice || product.maxSellingPrice || variant.sellingPrice || product.sellingPrice || 0);
        const minSellingPrice = Number(variant.minSellingPrice || product.minSellingPrice || 0);
        const defaultPrice = Number(item.sellingPrice ?? variant.sellingPrice ?? product.sellingPrice);
        const actual = Number(item.actualSoldAmount ?? item.price ?? defaultPrice);
        if (maxSellingPrice > 0 && actual > maxSellingPrice && !item.priceOverrideReason) {
          return res.status(400).json({
            message: `${product.name} (${variant.name}): actual price ₹${actual} exceeds max ₹${maxSellingPrice}. Provide an override reason.`
          });
        }
        enrichedItems.push({
          ...item,
          variantId: variant._id,
          variantName: variant.name,
          productName: `${product.name} (${variant.name})`,
          barcode: variant.barcode || variant.sku || product.barcode || product.sku,
          categoryId: product.categoryId,
          brand: product.brand,
          sellingPrice: defaultPrice,
          maxSellingPrice,
          minSellingPrice,
          actualSoldAmount: actual,
          price: actual
        });
      } else {
        if (product.stock < Number(item.quantity)) {
          return res.status(400).json({ message: `${product.name} has only ${product.stock} in stock.` });
        }
        const maxSellingPrice = Number(product.maxSellingPrice || product.sellingPrice || 0);
        const minSellingPrice = Number(product.minSellingPrice || 0);
        const defaultPrice = Number(item.sellingPrice ?? product.sellingPrice);
        const actual = Number(item.actualSoldAmount ?? item.price ?? defaultPrice);
        if (maxSellingPrice > 0 && actual > maxSellingPrice && !item.priceOverrideReason) {
          return res.status(400).json({
            message: `${product.name}: actual price ₹${actual} exceeds max ₹${maxSellingPrice}. Provide an override reason.`
          });
        }
        enrichedItems.push({
          ...item,
          productName: product.name,
          barcode: product.barcode || product.sku,
          categoryId: product.categoryId,
          brand: product.brand,
          sellingPrice: defaultPrice,
          maxSellingPrice,
          minSellingPrice,
          actualSoldAmount: actual,
          price: actual
        });
      }
    }
    items = enrichedItems;

    const source = req.body.source === 'pos' ? 'pos' : 'manual';
    const computedSubtotal = money2(
      items.reduce((sum: number, item: any) => sum + Number(item.actualSoldAmount || 0) * Number(item.quantity || 0), 0)
    );
    const lineDiscount = money2(items.reduce((sum: number, item: any) => sum + Number(item.discount || 0), 0));
    const invoiceDiscount = money2(Math.max(lineDiscount, Number(req.body.discount || 0)));
    const netBeforeTax = money2(Math.max(0, computedSubtotal - invoiceDiscount));
    const computedGst = money2(
      items.reduce((sum: number, item: any) => {
        const lineNet = Math.max(0, Number(item.actualSoldAmount || 0) * Number(item.quantity || 0) - Number(item.discount || 0));
        return sum + (lineNet * Number(item.gst || 0)) / 100;
      }, 0)
    );
    const total = money2(Number(req.body.total ?? netBeforeTax + computedGst));
    const paidAmount = money2(Math.max(0, Number(req.body.paidAmount ?? 0)));
    const paymentMethod = normalizePaymentMethod(req.body.paymentMode);
    const createdBy = req.user ? String((req.user as any)._id || (req.user as any).id || '') : undefined;
    const payments =
      paidAmount > 0
        ? [
            buildInitialPayment({
              amount: paidAmount,
              method: paymentMethod,
              reference: req.body.paymentReference,
              notes: req.body.paymentNotes,
              createdBy,
              idempotencyKey: req.body.paymentIdempotencyKey || `sale-create:${invoiceNumber}`
            })
          ]
        : [];

    const saleData: Record<string, unknown> = {
      ...req.body,
      invoiceNumber,
      items,
      attachments,
      source,
      subtotal: computedSubtotal,
      discount: invoiceDiscount,
      gst: money2(Number(req.body.gst ?? computedGst)),
      total,
      paymentMode: paymentMethod,
      payments,
      paidAmount,
      paymentDetails: {
        ...(typeof req.body.paymentDetails === 'object' && req.body.paymentDetails ? req.body.paymentDetails : {}),
        paidAmount
      },
      businessUnitId: resolveBusinessUnitId(req, req.body)
    };
    if (!saleData.customerId) {
      delete saleData.customerId;
    }
    const warehouseId = saleData.businessUnitId ? String(saleData.businessUnitId) : undefined;
    const saleId = new mongoose.Types.ObjectId();

    const sale = await withOptionalTransaction(req.tenantDB!, async (session) => {
      const priced = await applySaleLines(req.tenantDB!, items, String(saleId), createdBy, warehouseId, session);
      items = items.map((item: any, index: number) => {
        const costPerUnit = Number(priced[index]?.costPerUnit || 0);
        const cogs = Number(priced[index]?.cogs || money2(mulMoney(Number(item.quantity || 0), costPerUnit)));
        const revenue = money2(Math.max(0, Number(item.actualSoldAmount ?? item.price) * Number(item.quantity || 0) - Number(item.discount || 0)));
        return {
          ...item,
          costPerUnit,
          costPrice: costPerUnit,
          cogs,
          grossProfit: money2(revenue - cogs)
        };
      });
      const draft: any = { _id: saleId, ...saleData, items };
      applyFinanceSnapshot(draft);
      const [doc] = session
        ? await Sale.create([draft], { session })
        : [await Sale.create(draft)];
      return doc;
    });

    await syncCustomerBalances(req.tenantDB!, sale.customerId as any);

    if (req.user && req.business) {
      await logAuditEvent({
        user: req.user as any,
        business: req.business,
        action: 'CREATE',
        entity: 'Sale',
        entityId: sale._id.toString(),
        changes: {
          invoiceNumber,
          total,
          paidAmount,
          paymentStatus: sale.paymentStatus,
          outstandingAmount: sale.outstandingAmount,
          netSalesRevenue: sale.netSalesRevenue,
          grossProfit: sale.grossProfit
        },
        req
      });
    }

    res.status(201).json(sale);
  } catch (error: any) {
    console.error('Error creating sale:', error);
    if (error?.message && /stock|variant|Product not found/i.test(error.message)) {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Error creating sale' });
  }
};

export const uploadAttachment = async (req: TenantRequest, res: Response) => {
  try {
    const Sale = getSaleModel(req.tenantDB!);
    const sale = await Sale.findById(req.params.id);
    
    if (!sale) {
      return res.status(404).json({ message: 'Sale not found' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const attachment: IAttachment = {
      originalName: req.file.originalname,
      filename: req.file.filename,
      path: req.file.path,
      size: req.file.size,
      mimetype: req.file.mimetype
    };

    sale.attachments.push(attachment);
    await sale.save();

    res.json({ message: 'Attachment uploaded successfully', attachment });
  } catch (error) {
    console.error('Error uploading attachment:', error);
    res.status(500).json({ message: 'Error uploading attachment' });
  }
};

export const downloadAttachment = async (req: TenantRequest, res: Response) => {
  try {
    const Sale = getSaleModel(req.tenantDB!);
    const sale = await Sale.findById(req.params.saleId);
    
    if (!sale) {
      return res.status(404).json({ message: 'Sale not found' });
    }

    const attachment = sale.attachments.find(
      (a: IAttachment) => a._id?.toString() === req.params.attachmentId
    );

    if (!attachment) {
      return res.status(404).json({ message: 'Attachment not found' });
    }

    const filePath = path.resolve(attachment.path);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File not found' });
    }

    res.setHeader('Content-Disposition', `attachment; filename="${attachment.originalName}"`);
    res.setHeader('Content-Type', attachment.mimetype);
    res.sendFile(filePath);
  } catch (error) {
    console.error('Error downloading attachment:', error);
    res.status(500).json({ message: 'Error downloading attachment' });
  }
};

export const downloadInvoice = async (req: TenantRequest, res: Response) => {
  try {
    const Sale = getSaleModel(req.tenantDB!);
    const Settings = getSettingsModel(req.tenantDB!);
    getCustomerModel(req.tenantDB!);
    getProductModel(req.tenantDB!);
    
    const sale = await Sale.findById(req.params.id).populate('customerId').populate('items.productId');
    if (!sale) {
      return res.status(404).json({ message: 'Sale not found' });
    }
    
    const settings = await Settings.findOne();
    const invoiceData = {
      ...saleInvoicePayload(sale, settings),
      reprint: String(req.query.reprint || '') === '1'
    };
    
    const isPos = req.query.format === 'thermal' || req.query.format === 'pos';
    if (isPos) {
      await generateThermalReceipt(invoiceData, res, {
        inline: String(req.query.print || '') === '1',
        widthMm: settings?.thermalPrinterWidth || 58
      });
    } else {
      await generateInvoicePDF(invoiceData, res);
    }
  } catch (error) {
    console.error('Error generating invoice:', error);
    res.status(500).json({ message: 'Error generating invoice' });
  }
};

export const sendInvoiceEmail = async (req: TenantRequest, res: Response) => {
  try {
    const to = String(req.body?.to || '').trim();
    if (!to || !to.includes('@')) {
      return res.status(400).json({ message: 'Enter a valid recipient email.' });
    }
    const Sale = getSaleModel(req.tenantDB!);
    const Settings = getSettingsModel(req.tenantDB!);
    
    const sale = await Sale.findById(req.params.id).populate('customerId').populate('items.productId');
    if (!sale) {
      return res.status(404).json({ message: 'Sale not found' });
    }
    
    const settings = await Settings.findOne();
    const invoiceData = saleInvoicePayload(sale, settings);
    const pdfBuffer = await generateInvoicePDFBuffer(invoiceData);
    
    await sendEmail({
      to,
      subject: `Invoice ${sale.invoiceNumber} from ${settings?.businessName || 'your business'}`,
      html: `
        <p>Hello,</p>
        <p>Please find attached invoice ${sale.invoiceNumber} for your reference.</p>
        <p>Thank you for your business!</p>
        <p>Best regards,<br>${settings?.businessName || 'Your Business'}</p>
      `,
      attachments: [
        {
          filename: invoicePdfFilename(sale.invoiceNumber, 'sale'),
          content: pdfBuffer
        }
      ],
      config: mailerConfigFromSettings(settings)
    });
    
    res.json({ message: 'Invoice sent successfully!' });
  } catch (error: any) {
    console.error('Error sending invoice email:', error);
    return res.status(error?.status || 400).json({ message: describeMailError(error) });
  }
};

export const updateSale = async (req: TenantRequest, res: Response) => {
  try {
    const Sale = getSaleModel(req.tenantDB!);
    const Product = getProductModel(req.tenantDB!);
    const sale = await Sale.findById(req.params.id);
    if (!sale) {
      return res.status(404).json({ message: 'Sale not found' });
    }

    const previousStatus = sale.status;
    const createdBy = req.user ? String((req.user as any)._id || '') : undefined;
    const warehouseId = sale.businessUnitId ? String(sale.businessUnitId) : undefined;
    if (previousStatus === 'completed') {
      await reverseSaleLines(req.tenantDB!, sale.items as any[], sale._id.toString(), createdBy, warehouseId);
    }

    let items = req.body.items ?? sale.items;
    if (typeof items === 'string') {
      items = JSON.parse(items);
    }

    if (req.body.customerId !== undefined) {
      sale.customerId = req.body.customerId || undefined;
    }
    if (req.body.paymentMode) {
      sale.paymentMode = req.body.paymentMode;
    }
    if (req.body.status) {
      sale.status = req.body.status;
    }
    if (req.body.items) {
      sale.items = items;
      if (req.body.subtotal != null) sale.subtotal = Number(req.body.subtotal);
      if (req.body.discount != null) sale.discount = Number(req.body.discount);
      if (req.body.gst != null) sale.gst = Number(req.body.gst);
      if (req.body.total != null) sale.total = Number(req.body.total);
    }

    await sale.save();

    if (sale.status === 'completed') {
      const priced = await applySaleLines(req.tenantDB!, sale.items as any[], sale._id.toString(), createdBy, warehouseId);
      sale.items = (sale.items as any[]).map((item: any, index: number) => {
        const costPerUnit = Number(priced[index]?.costPerUnit || item.costPerUnit || item.costPrice || 0);
        const cogs = Number(priced[index]?.cogs || money2(mulMoney(Number(item.quantity || 0), costPerUnit)));
        const revenue = money2(Number(item.actualSoldAmount ?? item.price) * Number(item.quantity || 0));
        return { ...item, costPerUnit, costPrice: costPerUnit, cogs, grossProfit: money2(revenue - cogs) };
      });
      await sale.save();
    }

    if (req.user && req.business) {
      await logAuditEvent({
        user: req.user as any,
        business: req.business,
        action: 'UPDATE',
        entity: 'Sale',
        entityId: sale._id.toString(),
        changes: req.body,
        req
      });
    }

    res.json(sale);
  } catch (error) {
    console.error('Error updating sale:', error);
    res.status(500).json({ message: 'Error updating sale' });
  }
};

export const deleteSale = async (req: TenantRequest, res: Response) => {
  try {
    const Sale = getSaleModel(req.tenantDB!);
    const Product = getProductModel(req.tenantDB!);
    const sale = await Sale.findById(req.params.id);
    if (!sale) {
      return res.status(404).json({ message: 'Sale not found' });
    }

    if (sale.status === 'completed') {
      await reverseSaleLines(
        req.tenantDB!,
        sale.items as any[],
        sale._id.toString(),
        req.user ? String((req.user as any)._id || '') : undefined,
        sale.businessUnitId ? String(sale.businessUnitId) : undefined
      );
    }

    await sale.deleteOne();

    if (req.user && req.business) {
      await logAuditEvent({
        user: req.user as any,
        business: req.business,
        action: 'DELETE',
        entity: 'Sale',
        entityId: req.params.id as string,
        req
      });
    }

    res.json({ message: 'Sale deleted' });
  } catch (error) {
    console.error('Error deleting sale:', error);
    res.status(500).json({ message: 'Error deleting sale' });
  }
};

export const returnSale = async (req: TenantRequest, res: Response) => {
  try {
    const Sale = getSaleModel(req.tenantDB!);
    const sale = await Sale.findById(req.params.id);
    if (!sale) {
      return res.status(404).json({ message: 'Sale not found' });
    }
    if (sale.status !== 'completed') {
      return res.status(400).json({ message: 'Only completed sales can be returned.' });
    }

    const requested = Array.isArray(req.body?.items) ? req.body.items : sale.items;
    const lines = [];
    for (const row of requested) {
      const original = (sale.items as any[]).find((item: any) =>
        String(item.productId) === String(row.productId || item.productId)
        && String(item.variantId || '') === String(row.variantId || item.variantId || '')
      );
      if (!original) {
        return res.status(400).json({ message: 'Return lines must match the original sale.' });
      }
      const quantity = Number(row.quantity ?? original.quantity);
      const alreadyReturned = (sale.returns || []).reduce((sum: number, ret: any) => {
        const match = (ret.items || []).find((item: any) =>
          String(item.productId) === String(original.productId)
          && String(item.variantId || '') === String(original.variantId || '')
        );
        return sum + Number(match?.quantity || 0);
      }, 0);
      if (quantity <= 0 || alreadyReturned + quantity > Number(original.quantity)) {
        return res.status(400).json({ message: 'Return quantity exceeds the original sale.' });
      }
      const costPerUnit = Number(original.costPerUnit ?? original.costPrice ?? 0);
      lines.push({
        productId: original.productId,
        variantId: original.variantId,
        quantity,
        costPerUnit,
        costPrice: costPerUnit,
        cogs: money2(mulMoney(quantity, costPerUnit))
      });
    }

    const createdBy = req.user ? String((req.user as any)._id || '') : undefined;
    const warehouseId = sale.businessUnitId ? String(sale.businessUnitId) : undefined;
    await reverseSaleLines(req.tenantDB!, lines, sale._id.toString(), createdBy, warehouseId);
    sale.returns = [...(sale.returns || []), {
      items: lines,
      notes: typeof req.body?.notes === 'string' ? req.body.notes : undefined,
      createdBy,
      createdAt: new Date()
    }];
    await sale.save();
    res.json(sale);
  } catch (error: any) {
    return res.status(error?.status || 400).json({ message: error.message || 'Unable to return sale.' });
  }
};

export const addSalePayment = async (req: TenantRequest, res: Response) => {
  try {
    const createdBy = req.user ? String((req.user as any)._id || '') : undefined;
    const sale = await recordSalePayment(
      req.tenantDB!,
      String(req.params.id),
      {
        amount: Number(req.body.amount),
        method: req.body.method || req.body.paymentMode,
        reference: req.body.reference,
        notes: req.body.notes,
        paidAt: req.body.paidAt,
        idempotencyKey: req.body.idempotencyKey
      },
      createdBy
    );

    if (req.user && req.business) {
      await logAuditEvent({
        user: req.user as any,
        business: req.business,
        action: 'UPDATE',
        entity: 'SalePayment',
        entityId: String(sale._id),
        changes: {
          amount: req.body.amount,
          method: req.body.method || req.body.paymentMode,
          paymentStatus: sale.paymentStatus,
          outstandingAmount: sale.outstandingAmount
        },
        req
      });
    }

    res.status(201).json(sale);
  } catch (error: any) {
    res.status(error?.status || 500).json({ message: error?.message || 'Unable to record payment.' });
  }
};

export const reversePayment = async (req: TenantRequest, res: Response) => {
  try {
    const reversedBy = req.user ? String((req.user as any)._id || '') : undefined;
    const sale = await reverseSalePayment(
      req.tenantDB!,
      String(req.params.id),
      String(req.params.paymentId),
      String(req.body.reason || 'Reversed'),
      reversedBy
    );

    if (req.user && req.business) {
      await logAuditEvent({
        user: req.user as any,
        business: req.business,
        action: 'UPDATE',
        entity: 'SalePayment',
        entityId: String(sale._id),
        changes: { paymentId: req.params.paymentId, reason: req.body.reason, reversed: true },
        req
      });
    }

    res.json(sale);
  } catch (error: any) {
    res.status(error?.status || 500).json({ message: error?.message || 'Unable to reverse payment.' });
  }
};
