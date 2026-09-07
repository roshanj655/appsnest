import { Response } from 'express';
import { TenantRequest } from '../middleware/tenant';
import { getPurchaseModel, IAttachment } from '../models/tenant/Purchase';
import { getProductModel } from '../models/tenant/Product';
import { getSettingsModel } from '../models/tenant/Settings';
import { generateInvoicePDF, generateThermalReceipt, generateInvoicePDFBuffer } from '../services/invoiceService';
import { applyPurchaseLines, reversePurchaseLines, withOptionalTransaction } from '../services/inventoryCosting';
import { money2, mulMoney } from '../utils/money';
import { logAuditEvent } from '../utils/auditLogger';
import { sendEmail, mailerConfigFromSettings, describeMailError } from '../services/emailService';
import path from 'path';
import fs from 'fs';

import { paginatedResult, parsePagination, textSearch } from '../utils/pagination';
import { mergeFilters, resolveBusinessUnitId, unitScope } from '../utils/businessUnit';

export const getPurchases = async (req: TenantRequest, res: Response) => {
  try {
    const Purchase = getPurchaseModel(req.tenantDB!);
    const { page, limit, skip, search } = parsePagination(req.query);
    const filter = mergeFilters(
      textSearch(search, ['invoiceNumber', 'supplierInvoiceNumber', 'status']),
      unitScope(req)
    );
    const [items, total] = await Promise.all([
      Purchase.find(filter).populate('supplierId').populate('items.productId').sort({ createdAt: -1 }).skip(skip).limit(limit),
      Purchase.countDocuments(filter)
    ]);
    res.json(paginatedResult(items, total, page, limit));
  } catch (error) {
    res.status(500).json({ message: 'Error fetching purchases' });
  }
};

export const createPurchase = async (req: TenantRequest, res: Response) => {
  try {
    const Purchase = getPurchaseModel(req.tenantDB!);
    const Product = getProductModel(req.tenantDB!);
    const Settings = getSettingsModel(req.tenantDB!);

    // Get settings for invoice prefix
    let settings = await Settings.findOne();
    const prefix = settings?.purchaseInvoicePrefix || 'PUR';

    // Generate invoice number
    const lastPurchase = await Purchase.findOne().sort({ createdAt: -1 });
    const invoiceNumber = lastPurchase 
      ? `${prefix}-${(parseInt(lastPurchase.invoiceNumber.split('-')[1]) + 1).toString().padStart(6, '0')}` 
      : `${prefix}-000001`;

    // Parse items from JSON string if needed (in case of FormData)
    let items = req.body.items;
    if (typeof items === 'string') {
      items = JSON.parse(items);
    }

    const purchasedProducts = await Product.find({
      _id: { $in: (items || []).map((item: any) => item.productId) }
    });
    items = (items || []).map((item: any) => {
      const product = purchasedProducts.find((row: any) => String(row._id) === String(item.productId));
      const variantId = String(item.variantId || '').trim();
      const variant = product?.variants?.find((row: any) => String(row._id) === variantId);
      if (product?.variants?.length && !variant) {
        throw Object.assign(new Error(`Pick a variant for ${product.name}.`), { status: 400 });
      }
      const unitCost = Number(item.unitCost ?? item.price ?? 0);
      return {
        ...item,
        variantId: variant?._id || undefined,
        variantName: variant?.name,
        unitCost,
        totalCost: money2(mulMoney(Number(item.quantity || 0), unitCost))
      };
    });

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

    const total = Number(req.body.total || 0);
    const paidAmount = Number(req.body.paidAmount ?? total);
    const dueAmount = Math.max(0, total - paidAmount);
    const status = req.body.status === 'draft' ? 'draft' : 'completed';
    const purchaseData = {
      ...req.body,
      invoiceNumber,
      supplierInvoiceNumber: req.body.supplierInvoiceNumber,
      items,
      attachments,
      paidAmount,
      dueAmount,
      status,
      receivedAt: status === 'completed' ? new Date() : undefined,
      businessUnitId: resolveBusinessUnitId(req, req.body)
    };
    const createdBy = req.user ? String((req.user as any)._id || (req.user as any).id || '') : undefined;
    const warehouseId = purchaseData.businessUnitId ? String(purchaseData.businessUnitId) : undefined;

    const purchase = await withOptionalTransaction(req.tenantDB!, async (session) => {
      const doc = session
        ? (await Purchase.create([purchaseData], { session }))[0]
        : await Purchase.create(purchaseData);
      if (status === 'completed') {
        await applyPurchaseLines(req.tenantDB!, items, doc._id.toString(), createdBy, warehouseId, session);
      }
      return doc;
    });

    if (req.user && req.business) {
      await logAuditEvent({
        user: req.user as any,
        business: req.business,
        action: 'CREATE',
        entity: 'Purchase',
        entityId: purchase._id.toString(),
        changes: purchaseData,
        req
      });
    }

    res.status(201).json(purchase);
  } catch (error: any) {
    console.error('Error creating purchase:', error);
    if (error?.status === 400 || (error?.message && /variant|stock/i.test(error.message))) {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Error creating purchase' });
  }
};

export const uploadAttachment = async (req: TenantRequest, res: Response) => {
  try {
    const Purchase = getPurchaseModel(req.tenantDB!);
    const purchase = await Purchase.findById(req.params.id);
    
    if (!purchase) {
      return res.status(404).json({ message: 'Purchase not found' });
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

    purchase.attachments.push(attachment);
    await purchase.save();

    res.json({ message: 'Attachment uploaded successfully', attachment });
  } catch (error) {
    console.error('Error uploading attachment:', error);
    res.status(500).json({ message: 'Error uploading attachment' });
  }
};

export const downloadAttachment = async (req: TenantRequest, res: Response) => {
  try {
    const Purchase = getPurchaseModel(req.tenantDB!);
    const purchase = await Purchase.findById(req.params.purchaseId);
    
    if (!purchase) {
      return res.status(404).json({ message: 'Purchase not found' });
    }

    const attachment = purchase.attachments.find(
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
    const Purchase = getPurchaseModel(req.tenantDB!);
    const Settings = getSettingsModel(req.tenantDB!);
    
    const purchase = await Purchase.findById(req.params.id).populate('supplierId');
    if (!purchase) {
      return res.status(404).json({ message: 'Purchase not found' });
    }
    
    const settings = await Settings.findOne();
    
    // Prepare invoice data
    const invoiceItems = purchase.items.map((item: any) => ({
      name: item.productName || 'Product',
      quantity: item.quantity,
      price: item.price,
      total: item.total
    }));
    
    const supplierId = purchase.supplierId as any;
    
    const invoiceData = {
      invoiceNumber: purchase.invoiceNumber,
      date: purchase.createdAt,
      businessName: settings?.businessName || '',
      businessPhone: settings?.phone || '',
      businessEmail: settings?.email || '',
      businessAddress: settings?.address,
      partyName: supplierId?.name,
      partyPhone: supplierId?.phone,
      isPurchase: true,
      items: invoiceItems,
      subtotal: purchase.subtotal,
      tax: purchase.gst,
      total: purchase.total
    };
    
    // Check if thermal receipt requested
    if (req.query.format === 'thermal') {
      await generateThermalReceipt(invoiceData, res);
    } else {
      await generateInvoicePDF(invoiceData, res);
    }
  } catch (error) {
    console.error('Error generating purchase invoice:', error);
    res.status(500).json({ message: 'Error generating purchase invoice' });
  }
};

export const sendPurchaseInvoiceEmail = async (req: TenantRequest, res: Response) => {
  try {
    const { to } = req.body;
    const Purchase = getPurchaseModel(req.tenantDB!);
    const Settings = getSettingsModel(req.tenantDB!);
    
    const purchase = await Purchase.findById(req.params.id).populate('supplierId');
    if (!purchase) {
      return res.status(404).json({ message: 'Purchase not found' });
    }
    
    const settings = await Settings.findOne();
    
    // Prepare invoice data
    const invoiceItems = purchase.items.map((item: any) => ({
      name: item.productName || 'Product',
      quantity: item.quantity,
      price: item.price,
      total: item.total
    }));
    
    const supplierId = purchase.supplierId as any;
    
    const invoiceData = {
      invoiceNumber: purchase.invoiceNumber,
      date: purchase.createdAt,
      businessName: settings?.businessName || '',
      businessPhone: settings?.phone || '',
      businessEmail: settings?.email || '',
      businessAddress: settings?.address,
      partyName: supplierId?.name,
      partyPhone: supplierId?.phone,
      isPurchase: true,
      items: invoiceItems,
      subtotal: purchase.subtotal,
      tax: purchase.gst,
      total: purchase.total
    };
    
    const pdfBuffer = await generateInvoicePDFBuffer(invoiceData);
    
    await sendEmail({
      to,
      subject: `Purchase Invoice ${purchase.invoiceNumber} from ${settings?.businessName || 'your business'}`,
      html: `
        <p>Hello,</p>
        <p>Please find attached purchase invoice ${purchase.invoiceNumber} for your reference.</p>
        <p>Best regards,<br>${settings?.businessName || 'Your Business'}</p>
      `,
      attachments: [
        {
          filename: `purchase-invoice-${purchase.invoiceNumber}.pdf`,
          content: pdfBuffer
        }
      ],
      config: mailerConfigFromSettings(settings)
    });
    
    res.json({ message: 'Purchase invoice sent successfully!' });
  } catch (error: any) {
    console.error('Error sending purchase invoice email:', error);
    return res.status(error?.status || 400).json({ message: describeMailError(error) });
  }
};

export const updatePurchase = async (req: TenantRequest, res: Response) => {
  try {
    const Purchase = getPurchaseModel(req.tenantDB!);
    const Product = getProductModel(req.tenantDB!);
    const purchase = await Purchase.findById(req.params.id);
    if (!purchase) {
      return res.status(404).json({ message: 'Purchase not found' });
    }

    if (purchase.status === 'completed') {
      await reversePurchaseLines(
        req.tenantDB!,
        purchase.items as any[],
        purchase._id.toString(),
        req.user ? String((req.user as any)._id || '') : undefined,
        purchase.businessUnitId ? String(purchase.businessUnitId) : undefined
      );
    }

    let items = req.body.items ?? purchase.items;
    if (typeof items === 'string') {
      items = JSON.parse(items);
    }

    if (req.body.supplierId !== undefined) {
      purchase.supplierId = req.body.supplierId || undefined;
    }
    if (req.body.supplierInvoiceNumber !== undefined) {
      purchase.supplierInvoiceNumber = req.body.supplierInvoiceNumber;
    }
    if (req.body.paidAmount != null || req.body.total != null) {
      const total = Number(req.body.total ?? purchase.total);
      const paidAmount = Number(req.body.paidAmount ?? purchase.paidAmount ?? total);
      purchase.paidAmount = paidAmount;
      purchase.dueAmount = Math.max(0, total - paidAmount);
    }
    if (req.body.items) {
      purchase.items = items;
      if (req.body.subtotal != null) purchase.subtotal = Number(req.body.subtotal);
      if (req.body.discount != null) purchase.discount = Number(req.body.discount);
      if (req.body.gst != null) purchase.gst = Number(req.body.gst);
      if (req.body.total != null) purchase.total = Number(req.body.total);
    }

    await purchase.save();

    if (purchase.status === 'completed') {
      const nextItems = (purchase.items as any[]).map((item: any) => ({
        ...item,
        unitCost: Number(item.unitCost ?? item.price ?? 0),
        totalCost: money2(mulMoney(Number(item.quantity || 0), Number(item.unitCost ?? item.price ?? 0)))
      }));
      purchase.items = nextItems;
      await applyPurchaseLines(
        req.tenantDB!,
        nextItems,
        purchase._id.toString(),
        req.user ? String((req.user as any)._id || '') : undefined,
        purchase.businessUnitId ? String(purchase.businessUnitId) : undefined
      );
    }

    if (req.user && req.business) {
      await logAuditEvent({
        user: req.user as any,
        business: req.business,
        action: 'UPDATE',
        entity: 'Purchase',
        entityId: purchase._id.toString(),
        changes: req.body,
        req
      });
    }

    res.json(purchase);
  } catch (error) {
    console.error('Error updating purchase:', error);
    res.status(500).json({ message: 'Error updating purchase' });
  }
};

export const deletePurchase = async (req: TenantRequest, res: Response) => {
  try {
    const Purchase = getPurchaseModel(req.tenantDB!);
    const Product = getProductModel(req.tenantDB!);
    const purchase = await Purchase.findById(req.params.id);
    if (!purchase) {
      return res.status(404).json({ message: 'Purchase not found' });
    }

    if (purchase.status === 'completed') {
      await reversePurchaseLines(
        req.tenantDB!,
        purchase.items as any[],
        purchase._id.toString(),
        req.user ? String((req.user as any)._id || '') : undefined,
        purchase.businessUnitId ? String(purchase.businessUnitId) : undefined
      );
    }

    await purchase.deleteOne();

    if (req.user && req.business) {
      await logAuditEvent({
        user: req.user as any,
        business: req.business,
        action: 'DELETE',
        entity: 'Purchase',
        entityId: req.params.id as string,
        req
      });
    }

    res.json({ message: 'Purchase deleted' });
  } catch (error) {
    console.error('Error deleting purchase:', error);
    res.status(500).json({ message: 'Error deleting purchase' });
  }
};

export const receivePurchase = async (req: TenantRequest, res: Response) => {
  try {
    const Purchase = getPurchaseModel(req.tenantDB!);
    const purchase = await Purchase.findById(req.params.id);
    if (!purchase) {
      return res.status(404).json({ message: 'Purchase not found' });
    }
    if (purchase.status === 'completed') {
      return res.status(400).json({ message: 'This purchase is already received.' });
    }
    if (purchase.status === 'cancelled') {
      return res.status(400).json({ message: 'Cancelled purchases cannot be received.' });
    }

    const createdBy = req.user ? String((req.user as any)._id || '') : undefined;
    const warehouseId = purchase.businessUnitId ? String(purchase.businessUnitId) : undefined;
    await applyPurchaseLines(req.tenantDB!, purchase.items as any[], purchase._id.toString(), createdBy, warehouseId);
    purchase.status = 'completed';
    purchase.receivedAt = new Date();
    await purchase.save();

    if (req.user && req.business) {
      await logAuditEvent({
        user: req.user as any,
        business: req.business,
        action: 'UPDATE',
        entity: 'Purchase',
        entityId: purchase._id.toString(),
        changes: { status: 'completed', receivedAt: purchase.receivedAt },
        req
      });
    }
    res.json(purchase);
  } catch (error: any) {
    return res.status(error?.status || 400).json({ message: error.message || 'Unable to receive purchase.' });
  }
};

export const returnPurchase = async (req: TenantRequest, res: Response) => {
  try {
    const Purchase = getPurchaseModel(req.tenantDB!);
    const purchase = await Purchase.findById(req.params.id);
    if (!purchase) {
      return res.status(404).json({ message: 'Purchase not found' });
    }
    if (purchase.status !== 'completed') {
      return res.status(400).json({ message: 'Only received purchases can be returned.' });
    }

    const requested = Array.isArray(req.body?.items) ? req.body.items : purchase.items;
    const lines = [];
    for (const row of requested) {
      const original = (purchase.items as any[]).find((item: any) =>
        String(item.productId) === String(row.productId || item.productId)
        && String(item.variantId || '') === String(row.variantId || item.variantId || '')
      );
      if (!original) {
        return res.status(400).json({ message: 'Return lines must match the original purchase.' });
      }
      const quantity = Number(row.quantity ?? original.quantity);
      const alreadyReturned = (purchase.returns || []).reduce((sum: number, ret: any) => {
        const match = (ret.items || []).find((item: any) =>
          String(item.productId) === String(original.productId)
          && String(item.variantId || '') === String(original.variantId || '')
        );
        return sum + Number(match?.quantity || 0);
      }, 0);
      if (quantity <= 0 || alreadyReturned + quantity > Number(original.quantity)) {
        return res.status(400).json({ message: 'Return quantity exceeds the original purchase.' });
      }
      const unitCost = Number(original.unitCost ?? original.price ?? 0);
      lines.push({
        productId: original.productId,
        variantId: original.variantId,
        quantity,
        unitCost,
        totalCost: money2(mulMoney(quantity, unitCost))
      });
    }

    const createdBy = req.user ? String((req.user as any)._id || '') : undefined;
    const warehouseId = purchase.businessUnitId ? String(purchase.businessUnitId) : undefined;
    await reversePurchaseLines(req.tenantDB!, lines, purchase._id.toString(), createdBy, warehouseId);
    purchase.returns = [...(purchase.returns || []), {
      items: lines,
      notes: typeof req.body?.notes === 'string' ? req.body.notes : undefined,
      createdBy,
      createdAt: new Date()
    }];
    await purchase.save();
    res.json(purchase);
  } catch (error: any) {
    return res.status(error?.status || 400).json({ message: error.message || 'Unable to return purchase.' });
  }
};
