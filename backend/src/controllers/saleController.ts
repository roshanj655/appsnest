import { Response } from 'express';
import { TenantRequest } from '../middleware/tenant';
import { getSaleModel, IAttachment } from '../models/tenant/Sale';
import { getProductModel } from '../models/tenant/Product';
import { getCustomerModel } from '../models/tenant/Customer';
import { getSettingsModel } from '../models/tenant/Settings';
import { generateInvoicePDF, generateThermalReceipt, generateInvoicePDFBuffer } from '../services/invoiceService';
import { applyLineStock } from '../utils/inventoryMovement';
import { logAuditEvent } from '../utils/auditLogger';
import { sendEmail } from '../services/emailService';
import path from 'path';
import fs from 'fs';

import { paginatedResult, parsePagination, textSearch } from '../utils/pagination';
import { mergeFilters, resolveBusinessUnitId, unitScope } from '../utils/businessUnit';

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

    // Generate invoice number
    const lastSale = await Sale.findOne().sort({ createdAt: -1 });
    const invoiceNumber = lastSale 
      ? `${prefix}-${(parseInt(lastSale.invoiceNumber.split('-')[1]) + 1).toString().padStart(6, '0')}` 
      : `${prefix}-000001`;

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
        enrichedItems.push({
          ...item,
          variantId: variant._id,
          variantName: variant.name,
          productName: `${product.name} (${variant.name})`,
          barcode: variant.barcode || variant.sku || product.barcode || product.sku,
          costPrice: Number(variant.purchasePrice || product.purchasePrice || 0),
          sellingPrice: Number(item.sellingPrice ?? variant.sellingPrice ?? product.sellingPrice)
        });
      } else {
        if (product.stock < Number(item.quantity)) {
          return res.status(400).json({ message: `${product.name} has only ${product.stock} in stock.` });
        }
        enrichedItems.push({
          ...item,
          productName: product.name,
          barcode: product.barcode || product.sku,
          costPrice: Number(product.purchasePrice || 0)
        });
      }
    }
    items = enrichedItems;

    const source = req.body.source === 'pos' ? 'pos' : 'manual';
    let total = Number(req.body.total || 0);
    let paidAmount = Number(req.body.paidAmount ?? total);
    let changeAmount = Math.max(0, Number(req.body.changeAmount ?? paidAmount - total));

    if (source === 'pos' && paidAmount >= 0 && total > paidAmount) {
      const factor = paidAmount / total;
      items = items.map((item: any) => {
        const actualSoldAmount = Number(((item.actualSoldAmount ?? item.price) * factor).toFixed(4));
        const lineBase = actualSoldAmount * Number(item.quantity || 0);
        const gst = Number(item.gst || 0);
        return {
          ...item,
          actualSoldAmount,
          price: actualSoldAmount,
          total: lineBase + (lineBase * gst) / 100
        };
      });
      req.body.discount = Number((total - paidAmount).toFixed(2));
      total = paidAmount;
      changeAmount = 0;
    }

    const saleData: Record<string, unknown> = {
      ...req.body,
      invoiceNumber,
      items,
      attachments,
      source,
      paidAmount,
      changeAmount,
      total,
      discount: Number(req.body.discount || 0),
      paymentDetails: {
        ...(typeof req.body.paymentDetails === 'object' && req.body.paymentDetails ? req.body.paymentDetails : {}),
        paidAmount,
        changeAmount
      },
      businessUnitId: resolveBusinessUnitId(req, req.body)
    };
    if (!saleData.customerId) {
      delete saleData.customerId;
    }
    const sale = await Sale.create(saleData);

    await applyLineStock(req.tenantDB!, items, -1, 'sale', sale._id.toString());

    if (req.user && req.business) {
      await logAuditEvent({
        user: req.user as any,
        business: req.business,
        action: 'CREATE',
        entity: 'Sale',
        entityId: sale._id.toString(),
        changes: saleData,
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
    
    const invoiceItems = sale.items.map((item: any) => ({
      name: item.productName || item.productId?.name || 'Product',
      quantity: item.quantity,
      price: item.price,
      total: item.total
    }));
    
    const customerId = sale.customerId as any;
    const saleAny = sale as any;
    
    const invoiceData = {
      invoiceNumber: sale.invoiceNumber,
      date: sale.createdAt,
      businessName: settings?.businessName || '',
      businessPhone: settings?.phone || '',
      businessEmail: settings?.email || '',
      businessAddress: settings?.address,
      gstin: settings?.gstin,
      partyName: customerId?.name,
      partyPhone: customerId?.phone,
      items: invoiceItems,
      subtotal: sale.subtotal,
      tax: sale.gst,
      total: sale.total,
      paymentMode: sale.paymentMode,
      paidAmount: saleAny.paidAmount,
      changeAmount: saleAny.changeAmount,
      source: saleAny.source,
      reprint: String(req.query.reprint || '') === '1',
      footerText: settings?.footerText
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
    const { to } = req.body;
    const Sale = getSaleModel(req.tenantDB!);
    const Settings = getSettingsModel(req.tenantDB!);
    
    const sale = await Sale.findById(req.params.id).populate('customerId');
    if (!sale) {
      return res.status(404).json({ message: 'Sale not found' });
    }
    
    const settings = await Settings.findOne();
    
    // Prepare invoice data
    const invoiceItems = sale.items.map((item: any) => ({
      name: item.productName || 'Product',
      quantity: item.quantity,
      price: item.price,
      total: item.total
    }));
    
    const customerId = sale.customerId as any;
    
    const invoiceData = {
      invoiceNumber: sale.invoiceNumber,
      date: sale.createdAt,
      businessName: settings?.businessName || '',
      businessPhone: settings?.phone || '',
      businessEmail: settings?.email || '',
      businessAddress: settings?.address,
      partyName: customerId?.name,
      partyPhone: customerId?.phone,
      items: invoiceItems,
      subtotal: sale.subtotal,
      tax: sale.gst,
      total: sale.total
    };
    
    const pdfBuffer = await generateInvoicePDFBuffer(invoiceData);
    
    const smtpConfig = settings?.smtpHost ? {
      host: settings.smtpHost,
      port: settings.smtpPort,
      secure: settings.smtpSecure,
      auth: {
        user: settings.smtpUser,
        pass: settings.smtpPass
      }
    } : undefined;
    
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
          filename: `invoice-${sale.invoiceNumber}.pdf`,
          content: pdfBuffer
        }
      ],
      config: smtpConfig
    });
    
    res.json({ message: 'Invoice sent successfully!' });
  } catch (error) {
    console.error('Error sending invoice email:', error);
    res.status(500).json({ message: 'Error sending invoice email' });
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
    if (previousStatus === 'completed') {
      await applyLineStock(req.tenantDB!, sale.items as any[], 1, 'return', sale._id.toString());
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
      await applyLineStock(req.tenantDB!, sale.items as any[], -1, 'sale', sale._id.toString());
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
      await applyLineStock(req.tenantDB!, sale.items as any[], 1, 'return', sale._id.toString());
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
