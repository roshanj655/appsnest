import PDFDocument from 'pdfkit';
import { Response } from 'express';

interface InvoiceItem {
  name: string;
  quantity: number;
  price: number;
  total: number;
}

interface InvoiceData {
  invoiceNumber: string;
  date: Date;
  businessName: string;
  businessPhone: string;
  businessEmail: string;
  businessAddress?: string;
  gstin?: string;
  partyName?: string;
  partyPhone?: string;
  isPurchase?: boolean;
  items: InvoiceItem[];
  subtotal: number;
  tax?: number;
  total: number;
  paymentMode?: string;
  paidAmount?: number;
  changeAmount?: number;
  source?: string;
  reprint?: boolean;
  footerText?: string;
}

const money = (value?: number) => `Rs ${Number(value || 0).toFixed(2)}`;

const renderInvoicePDF = (data: InvoiceData, doc: any) => {
  const left = 50;
  const right = 545;

  doc.font('Helvetica-Bold').fontSize(18).text(data.businessName || 'Business', left, 50, { width: 320 });
  doc.font('Helvetica').fontSize(10);
  let headerY = 74;
  if (data.businessPhone) {
    doc.text(data.businessPhone, left, headerY);
    headerY += 14;
  }
  if (data.businessEmail) {
    doc.text(data.businessEmail, left, headerY);
    headerY += 14;
  }
  if (data.businessAddress) {
    doc.text(data.businessAddress, left, headerY, { width: 320 });
    headerY += 28;
  }
  if (data.gstin) {
    doc.text(`GSTIN: ${data.gstin}`, left, headerY);
  }

  doc.font('Helvetica-Bold').fontSize(16).text(data.isPurchase ? 'PURCHASE INVOICE' : 'TAX INVOICE', 330, 50, {
    width: 215,
    align: 'right'
  });
  doc.font('Helvetica').fontSize(10);
  doc.text(`#${data.invoiceNumber}`, 330, 72, { width: 215, align: 'right' });
  doc.text(`Date: ${new Date(data.date).toLocaleDateString()}`, 330, 88, { width: 215, align: 'right' });
  if (data.paymentMode) {
    doc.text(`Payment: ${String(data.paymentMode).toUpperCase()}`, 330, 104, { width: 215, align: 'right' });
  }

  const partyY = Math.max(headerY + 24, 140);
  doc.font('Helvetica-Bold').fontSize(11).text(data.isPurchase ? 'From' : 'Bill To', left, partyY);
  doc.font('Helvetica').fontSize(10);
  doc.text(data.partyName || (data.isPurchase ? 'Unknown Supplier' : 'Walk-in Customer'), left, partyY + 16);
  if (data.partyPhone) {
    doc.text(data.partyPhone, left, partyY + 30);
  }

  const tableTop = partyY + 56;
  doc.moveTo(left, tableTop).lineTo(right, tableTop).stroke();
  doc.font('Helvetica-Bold').fontSize(10);
  doc.text('Item', left, tableTop + 8, { width: 230 });
  doc.text('Qty', 290, tableTop + 8, { width: 40, align: 'right' });
  doc.text('Price', 340, tableTop + 8, { width: 90, align: 'right' });
  doc.text('Total', 440, tableTop + 8, { width: 105, align: 'right' });
  doc.moveTo(left, tableTop + 24).lineTo(right, tableTop + 24).stroke();

  doc.font('Helvetica').fontSize(10);
  let rowY = tableTop + 32;
  data.items.forEach((item) => {
    if (rowY > 720) {
      doc.addPage();
      rowY = 50;
    }
    doc.text(String(item.name || 'Product'), left, rowY, { width: 230 });
    doc.text(String(item.quantity || 0), 290, rowY, { width: 40, align: 'right' });
    doc.text(money(item.price), 340, rowY, { width: 90, align: 'right' });
    doc.text(money(item.total), 440, rowY, { width: 105, align: 'right' });
    rowY += 20;
  });

  doc.moveTo(left, rowY).lineTo(right, rowY).stroke();
  rowY += 16;
  doc.text('Subtotal', 340, rowY, { width: 90, align: 'right' });
  doc.text(money(data.subtotal), 440, rowY, { width: 105, align: 'right' });
  rowY += 16;
  if (data.tax) {
    doc.text('Tax', 340, rowY, { width: 90, align: 'right' });
    doc.text(money(data.tax), 440, rowY, { width: 105, align: 'right' });
    rowY += 16;
  }
  doc.font('Helvetica-Bold').fontSize(12);
  doc.text('Total', 340, rowY, { width: 90, align: 'right' });
  doc.text(money(data.total), 440, rowY, { width: 105, align: 'right' });

  doc.font('Helvetica').fontSize(9);
  doc.text(
    data.footerText || (data.isPurchase ? 'Thank you for your service.' : 'Thank you for your business.'),
    left,
    760,
    { width: 495, align: 'center' }
  );
};

const mmToPt = (mm: number) => mm * 2.83465;

const renderThermalReceipt = (data: InvoiceData, doc: any, widthMm = 58) => {
  const width = mmToPt(widthMm || 58);
  const lineCount = data.items.length;
  const height = Math.max(320, 220 + lineCount * 36);
  doc.addPage({ size: [width, height], margin: 8 });

  const title = data.isPurchase ? 'PURCHASE' : 'POS SALE';
  doc.fontSize(11).text(data.businessName || 'Store', { align: 'center' });
  doc.fontSize(8).text(title, { align: 'center' });
  if (data.reprint) {
    doc.text('*** REPRINT ***', { align: 'center' });
  }
  if (data.businessPhone) {
    doc.text(data.businessPhone, { align: 'center' });
  }
  if (data.gstin) {
    doc.text(`GSTIN: ${data.gstin}`, { align: 'center' });
  }
  doc.moveDown(0.3);
  doc.text('--------------------------------');
  doc.text(`Bill: ${data.invoiceNumber}`);
  doc.text(`Date: ${new Date(data.date).toLocaleString()}`);
  doc.text(`${data.isPurchase ? 'Supplier' : 'Customer'}: ${data.partyName || (data.isPurchase ? 'Unknown' : 'Walk-in')}`);
  if (data.paymentMode) {
    doc.text(`Pay: ${String(data.paymentMode).toUpperCase()}`);
  }
  doc.text('--------------------------------');
  data.items.forEach((item) => {
    doc.text(String(item.name || 'Product'));
    doc.text(`${item.quantity || 0} x ${money(item.price)}`, { continued: true });
    doc.text(money(item.total), { align: 'right' });
  });
  doc.text('--------------------------------');
  doc.text(`Subtotal: ${money(data.subtotal)}`, { align: 'right' });
  if (data.tax) {
    doc.text(`Tax: ${money(data.tax)}`, { align: 'right' });
  }
  doc.fontSize(10).text(`TOTAL: ${money(data.total)}`, { align: 'right' });
  doc.fontSize(8);
  if (data.paidAmount != null) {
    doc.text(`Received: ${money(data.paidAmount)}`, { align: 'right' });
  }
  if (data.changeAmount != null && Number(data.changeAmount) > 0) {
    doc.text(`Change: ${money(data.changeAmount)}`, { align: 'right' });
  }
  doc.moveDown(0.4);
  doc.text(data.footerText || 'Thank you. Visit again.', { align: 'center' });
};

export const generateThermalReceipt = async (
  data: InvoiceData,
  res: Response,
  options?: { inline?: boolean; widthMm?: number }
) => {
  const widthMm = options?.widthMm || 58;
  const doc = new PDFDocument({
    margin: 8,
    size: [mmToPt(widthMm), 500],
    autoFirstPage: false
  }) as any;

  const filename = data.isPurchase
    ? `purchase-pos-${data.invoiceNumber}.pdf`
    : `pos-${data.invoiceNumber}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `${options?.inline ? 'inline' : 'attachment'}; filename=${filename}`
  );

  doc.pipe(res);
  renderThermalReceipt(data, doc, widthMm);
  doc.end();
};

export const generateInvoicePDF = async (data: InvoiceData, res: Response) => {
  const buffer = await generateInvoicePDFBuffer(data);
  const filename = data.isPurchase
    ? `purchase-invoice-${data.invoiceNumber}.pdf`
    : `invoice-${data.invoiceNumber}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
};

export const generateInvoicePDFBuffer = async (data: InvoiceData): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      margin: 50,
      size: 'A4'
    }) as any;
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    renderInvoicePDF(data, doc);
    doc.end();
  });
};

export const generateThermalReceiptBuffer = async (data: InvoiceData): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      margin: 8,
      size: [mmToPt(58), 500],
      autoFirstPage: false
    }) as any;
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    renderThermalReceipt(data, doc, 58);
    doc.end();
  });
};
