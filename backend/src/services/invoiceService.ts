import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import { Response } from 'express';

interface InvoiceItem {
  name: string;
  quantity: number;
  price: number;
  total: number;
  hsn?: string;
  gst?: number;
  discount?: number;
  description?: string;
}

interface InvoiceData {
  invoiceNumber: string;
  date: Date;
  dueDate?: Date;
  businessName: string;
  businessPhone: string;
  businessEmail: string;
  businessAddress?: string;
  businessCity?: string;
  businessState?: string;
  businessPincode?: string;
  gstin?: string;
  pan?: string;
  logo?: string;
  partyName?: string;
  partyPhone?: string;
  partyEmail?: string;
  partyAddress?: string;
  partyGstin?: string;
  partyPan?: string;
  placeOfSupply?: string;
  isPurchase?: boolean;
  items: InvoiceItem[];
  subtotal: number;
  discount?: number;
  tax?: number;
  total: number;
  paymentMode?: string;
  paidAmount?: number;
  changeAmount?: number;
  source?: string;
  reprint?: boolean;
  footerText?: string;
  interstate?: boolean;
  bankName?: string;
  bankBranch?: string;
  bankAccountName?: string;
  bankAccountNumber?: string;
  bankIfsc?: string;
  bankSwift?: string;
}

const BLUE = '#1d4f91';
const INK = '#111111';
const MUTED = '#333333';

const panFromGstin = (gstin?: string) => {
  const value = String(gstin || '').replace(/\s/g, '').toUpperCase();
  return value.length >= 12 ? value.slice(2, 12) : '';
};

export const indianMoney = (value?: number) => {
  const amount = Number(value || 0).toFixed(2);
  const [whole, decimal] = amount.split('.');
  const last3 = whole.slice(-3);
  const rest = whole.slice(0, -3);
  const grouped = rest ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${last3}` : last3;
  return `${grouped}.${decimal}`;
};

const ones = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen'
];
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

const twoDigits = (n: number) => {
  if (n < 20) return ones[n];
  const unit = n % 10;
  const ten = tens[Math.floor(n / 10)];
  return unit ? `${ten}-${ones[unit]}` : ten;
};

const threeDigits = (n: number) => {
  const hundred = Math.floor(n / 100);
  const rest = n % 100;
  if (hundred && rest) return `${ones[hundred]} Hundred And ${twoDigits(rest)}`;
  if (hundred) return `${ones[hundred]} Hundred`;
  return twoDigits(rest);
};

export const amountInWords = (value?: number) => {
  let amount = Math.round(Number(value || 0) * 100) / 100;
  if (amount < 0) amount = 0;
  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);
  if (rupees === 0 && paise === 0) return 'ZERO RUPEES ONLY';

  const crore = Math.floor(rupees / 10000000);
  const lakh = Math.floor((rupees % 10000000) / 100000);
  const thousand = Math.floor((rupees % 100000) / 1000);
  const rest = rupees % 1000;
  const parts: string[] = [];
  if (crore) parts.push(`${threeDigits(crore)} Crore`);
  if (lakh) parts.push(`${threeDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${threeDigits(thousand)} Thousand`);
  if (rest) parts.push(threeDigits(rest));
  let text = parts.join(' ').toUpperCase();
  if (paise) text += ` AND ${twoDigits(paise).toUpperCase()} PAISE`;
  return `${text} RUPEES ONLY`;
};

export const invoicePdfFilename = (invoiceNumber: string, kind: 'sale' | 'purchase' | 'pos' = 'sale') => {
  const safe = String(invoiceNumber || 'invoice')
    .replace(/\//g, '_')
    .replace(/[\\:*?"<>|]+/g, '-')
    .trim();
  if (kind === 'pos') return `POS-${safe}.pdf`;
  return `${safe}.pdf`;
};

const formatDate = (date?: Date) =>
  date ? new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-') : '';

const joinAddress = (...parts: Array<string | undefined>) =>
  parts.map((part) => String(part || '').trim()).filter(Boolean).join(', ');

const initials = (name?: string, prefix?: string) => {
  if (prefix && prefix.length <= 4) return prefix.toUpperCase();
  const letters = String(name || 'INV')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
  return letters || 'INV';
};

const lineTaxable = (item: InvoiceItem) =>
  Math.max(0, Number(item.price || 0) * Number(item.quantity || 0) - Number(item.discount || 0));

const lineGst = (item: InvoiceItem) => lineTaxable(item) * (Number(item.gst || 0) / 100);

const renderInvoicePDF = (data: InvoiceData, doc: any) => {
  const L = 28;
  const R = 567;
  const W = R - L;
  const pageBottom = 812;
  const interstate = Boolean(data.interstate);
  const sellerAddress = joinAddress(data.businessAddress, data.businessCity, data.businessState, data.businessPincode);
  const sellerPan = data.pan || panFromGstin(data.gstin);
  const partyPan = data.partyPan || panFromGstin(data.partyGstin);
  const billedName = data.partyName || (data.isPurchase ? 'Unknown Supplier' : 'Walk-in Customer');

  doc.lineWidth(1.6).strokeColor(BLUE).rect(18, 18, 559, pageBottom - 18).stroke();
  doc.lineWidth(0.7);

  let logoDrawn = false;
  if (data.logo) {
    const logoPath = path.isAbsolute(data.logo) ? data.logo : path.join(process.cwd(), data.logo);
    if (fs.existsSync(logoPath)) {
      try {
        doc.image(logoPath, L, 28, { fit: [72, 48] });
        logoDrawn = true;
      } catch {
        logoDrawn = false;
      }
    }
  }
  if (!logoDrawn) {
    doc.save();
    doc.roundedRect(L, 28, 54, 48, 4).fill(BLUE);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(12);
    doc.text(initials(data.businessName, data.invoiceNumber?.split('/')[0]), L, 44, { width: 54, align: 'center' });
    doc.restore();
  }

  doc.fillColor(INK).font('Helvetica-Bold').fontSize(16);
  doc.text(data.businessName || 'Business', L + 80, 28, { width: 300, align: 'center' });
  doc.font('Helvetica').fontSize(8).fillColor(MUTED);
  doc.text(sellerAddress || '', L + 80, 48, { width: 300, align: 'center' });

  doc.font('Helvetica-Bold').fontSize(8).fillColor(INK);
  doc.text(data.businessName || 'Business', L + 390, 28, { width: 149, align: 'right' });
  doc.font('Helvetica').fontSize(8);
  if (data.businessPhone) doc.text(`Phone: ${data.businessPhone}`, L + 390, 42, { width: 149, align: 'right' });
  if (data.businessEmail) doc.text(`Email: ${data.businessEmail}`, L + 390, 54, { width: 149, align: 'right' });

  const barY = 86;
  doc.strokeColor(BLUE).rect(L, barY, W, 22).stroke();
  doc.font('Helvetica-Bold').fontSize(8).fillColor(INK);
  doc.text(data.gstin ? `GSTIN: ${data.gstin}` : '', L + 6, barY + 7, { width: 170 });
  doc.fillColor(BLUE).fontSize(11).text(data.isPurchase ? 'PURCHASE INVOICE' : 'TAX INVOICE', L, barY + 5, { width: W, align: 'center' });
  doc.fillColor(INK).fontSize(7).text(data.isPurchase ? 'ORIGINAL FOR SUPPLIER' : 'ORIGINAL FOR RECIPIENT', L + 360, barY + 8, { width: 173, align: 'right' });

  const blockY = barY + 22;
  const colW = W / 3;
  const blockH = 118;
  doc.strokeColor(BLUE).rect(L, blockY, W, blockH).stroke();
  doc.moveTo(L + colW, blockY).lineTo(L + colW, blockY + blockH).stroke();
  doc.moveTo(L + colW * 2, blockY).lineTo(L + colW * 2, blockY + blockH).stroke();

  const partyBlock = (x: number, title: string) => {
    doc.font('Helvetica-Bold').fontSize(8).fillColor(BLUE).text(title, x + 6, blockY + 6, { width: colW - 12 });
    doc.fillColor(INK).fontSize(8);
    let y = blockY + 20;
    const rows: Array<[string, string]> = [
      ['Name', billedName],
      ['Address', data.partyAddress || '-'],
      ['Phone', data.partyPhone || '-'],
      ['GSTIN', data.partyGstin || '-'],
      ['PAN', partyPan || '-'],
      ['Place of Supply', data.placeOfSupply || data.businessState || '-']
    ];
    rows.forEach(([label, value]) => {
      doc.font('Helvetica-Bold').text(`${label}:`, x + 6, y, { width: 52, continued: false });
      doc.font('Helvetica').text(value, x + 58, y, { width: colW - 66 });
      y += label === 'Address' ? 20 : 14;
    });
  };
  partyBlock(L, data.isPurchase ? 'Details of Supplier | Billed from:' : 'Details of Buyer | Billed to:');
  partyBlock(L + colW, data.isPurchase ? 'Details of Consignee | Shipped from:' : 'Details of Consignee | Shipped to:');

  doc.fillColor(INK);
  const meta = [
    ['Invoice No:', data.invoiceNumber],
    ['Invoice Date:', formatDate(data.date)],
    ['Due Date:', formatDate(data.dueDate)]
  ];
  let metaY = blockY + 18;
  meta.forEach(([label, value]) => {
    doc.font('Helvetica-Bold').fontSize(8).text(label, L + colW * 2 + 8, metaY, { width: 72 });
    doc.font('Helvetica').text(String(value || '-'), L + colW * 2 + 80, metaY, { width: colW - 90 });
    metaY += 18;
  });
  if (sellerPan) {
    doc.font('Helvetica-Bold').text('PAN:', L + colW * 2 + 8, metaY);
    doc.font('Helvetica').text(sellerPan, L + colW * 2 + 80, metaY, { width: colW - 90 });
  }

  const cols = [
    { x: L, w: 36, label: 'Sr. No.' },
    { x: L + 36, w: 210, label: 'Name of Product / Service' },
    { x: L + 246, w: 70, label: 'HSN / SAC' },
    { x: L + 316, w: 50, label: 'Qty' },
    { x: L + 366, w: 80, label: 'Rate' },
    { x: L + 446, w: 93, label: 'Taxable Value' }
  ];
  let y = blockY + blockH;
  const headerH = 22;
  doc.rect(L, y, W, headerH).fill(BLUE);
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(7);
  cols.forEach((col) => {
    doc.text(col.label, col.x + 3, y + 7, { width: col.w - 6, align: 'center' });
  });
  y += headerH;

  let totalQty = 0;
  let taxableSum = 0;
  let cgstSum = 0;
  let sgstSum = 0;
  let igstSum = 0;
  const hsnMap = new Map<string, { taxable: number; gst: number; cgst: number; sgst: number; igst: number }>();

  doc.strokeColor(BLUE);
  data.items.forEach((item, index) => {
    const taxable = lineTaxable(item);
    const gstAmt = lineGst(item);
    const rate = Number(item.gst || 0);
    const half = gstAmt / 2;
    totalQty += Number(item.quantity || 0);
    taxableSum += taxable;
    if (interstate) igstSum += gstAmt;
    else {
      cgstSum += half;
      sgstSum += half;
    }
    const hsn = item.hsn || '-';
    const current = hsnMap.get(hsn) || { taxable: 0, gst: rate, cgst: 0, sgst: 0, igst: 0 };
    current.taxable += taxable;
    current.gst = rate;
    if (interstate) current.igst += gstAmt;
    else {
      current.cgst += half;
      current.sgst += half;
    }
    hsnMap.set(hsn, current);

    const name = String(item.name || 'Product');
    const desc = String(item.description || '').trim();
    const nameH = doc.heightOfString(name, { width: cols[1].w - 8 });
    const descH = desc ? doc.heightOfString(desc, { width: cols[1].w - 8 }) : 0;
    const rowH = Math.max(24, nameH + descH + 12);
    doc.rect(L, y, W, rowH).stroke();
    cols.slice(1).forEach((col) => {
      doc.moveTo(col.x, y).lineTo(col.x, y + rowH).stroke();
    });
    doc.fillColor(INK).font('Helvetica').fontSize(8);
    doc.text(String(index + 1), cols[0].x, y + 6, { width: cols[0].w, align: 'center' });
    doc.font('Helvetica-Bold').text(name, cols[1].x + 4, y + 4, { width: cols[1].w - 8 });
    if (desc) {
      doc.font('Helvetica-Oblique').fontSize(7).text(desc, cols[1].x + 4, y + 4 + nameH, { width: cols[1].w - 8 });
    }
    doc.font('Helvetica').fontSize(8);
    doc.text(hsn, cols[2].x, y + 6, { width: cols[2].w, align: 'center' });
    doc.text(Number(item.quantity || 0).toFixed(2), cols[3].x, y + 6, { width: cols[3].w - 4, align: 'right' });
    doc.text(indianMoney(item.price), cols[4].x, y + 6, { width: cols[4].w - 4, align: 'right' });
    doc.text(indianMoney(taxable), cols[5].x, y + 6, { width: cols[5].w - 4, align: 'right' });
    y += rowH;
  });

  const defaultRate = Number(data.items[0]?.gst || 0);
  const taxRows = interstate
    ? [[`IGST (${defaultRate.toFixed(2)}%)`, igstSum]]
    : [[`CGST (${(defaultRate / 2).toFixed(2)}%)`, cgstSum], [`SGST (${(defaultRate / 2).toFixed(2)}%)`, sgstSum]];
  taxRows.forEach(([label, amount]) => {
    const rowH = 16;
    doc.strokeColor(BLUE).rect(L, y, W, rowH).stroke();
    cols.slice(1).forEach((col) => doc.moveTo(col.x, y).lineTo(col.x, y + rowH).stroke());
    doc.font('Helvetica').fontSize(8).fillColor(INK);
    doc.text(String(label), cols[1].x + 4, y + 4, { width: cols[1].w - 8 });
    doc.text(indianMoney(Number(amount)), cols[5].x, y + 4, { width: cols[5].w - 4, align: 'right' });
    y += rowH;
  });

  const totalH = 20;
  doc.rect(L, y, W, totalH).stroke();
  cols.slice(1).forEach((col) => doc.moveTo(col.x, y).lineTo(col.x, y + totalH).stroke());
  doc.font('Helvetica-Bold').fontSize(8).fillColor(INK);
  doc.text('Total', cols[1].x + 4, y + 6);
  doc.text(totalQty.toFixed(2), cols[3].x, y + 6, { width: cols[3].w - 4, align: 'right' });
  doc.text(`Rs ${indianMoney(data.total)}`, cols[5].x, y + 6, { width: cols[5].w - 4, align: 'right' });
  y += totalH + 8;

  doc.font('Helvetica-Bold').fontSize(8);
  doc.text('Total in words:', L, y);
  doc.font('Helvetica-Bold').text(amountInWords(data.total), L + 78, y, { width: 360 });
  doc.font('Helvetica').fontSize(7).text('E. & O.E.', R - 60, y, { width: 60, align: 'right' });
  y += 22;

  const summaryCols = interstate
    ? [
        { w: 90, label: 'HSN/SAC' },
        { w: 90, label: 'Taxable Value' },
        { w: 70, label: 'Rate' },
        { w: 90, label: 'IGST' },
        { w: 90, label: 'Total Tax' }
      ]
    : [
        { w: 80, label: 'HSN/SAC' },
        { w: 85, label: 'Taxable Value' },
        { w: 50, label: 'Rate' },
        { w: 75, label: 'CGST' },
        { w: 50, label: 'Rate' },
        { w: 75, label: 'SGST' },
        { w: 74, label: 'Total Tax' }
      ];
  doc.rect(L, y, W, 18).fill(BLUE);
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(7);
  let sx = L;
  summaryCols.forEach((col) => {
    doc.text(col.label, sx + 2, y + 5, { width: col.w - 4, align: 'center' });
    sx += col.w;
  });
  y += 18;
  let taxTotal = 0;
  hsnMap.forEach((row, hsn) => {
    const rowTax = interstate ? row.igst : row.cgst + row.sgst;
    taxTotal += rowTax;
    const rowH = 16;
    doc.strokeColor(BLUE).rect(L, y, W, rowH).stroke();
    doc.fillColor(INK).font('Helvetica').fontSize(7);
    sx = L;
    const values = interstate
      ? [hsn, indianMoney(row.taxable), `${row.gst.toFixed(2)}%`, indianMoney(row.igst), indianMoney(rowTax)]
      : [
          hsn,
          indianMoney(row.taxable),
          `${(row.gst / 2).toFixed(2)}%`,
          indianMoney(row.cgst),
          `${(row.gst / 2).toFixed(2)}%`,
          indianMoney(row.sgst),
          indianMoney(rowTax)
        ];
    summaryCols.forEach((col, i) => {
      doc.text(values[i], sx + 2, y + 4, { width: col.w - 4, align: 'center' });
      sx += col.w;
    });
    y += rowH;
  });
  y += 6;
  doc.font('Helvetica-Bold').fontSize(8).fillColor(INK);
  doc.text(`Total Tax in words: ${amountInWords(taxTotal)}`, L, y, { width: W });
  y += 20;

  const footerH = 92;
  if (y + footerH > pageBottom - 28) {
    doc.addPage();
    y = 36;
    doc.lineWidth(1.6).strokeColor(BLUE).rect(18, 18, 559, pageBottom - 18).stroke();
    doc.lineWidth(0.7);
  }
  const leftW = 330;
  doc.strokeColor(BLUE).rect(L, y, leftW, footerH).stroke();
  doc.rect(L + leftW, y, W - leftW, footerH).stroke();
  doc.font('Helvetica-Bold').fontSize(8).fillColor(BLUE).text('Bank Details', L + 8, y + 6);
  doc.font('Helvetica').fontSize(7).fillColor(INK);
  const bankLines = [
    data.bankName ? `Name: ${data.bankName}` : '',
    data.bankBranch ? `Branch: ${data.bankBranch}` : '',
    data.bankAccountName ? `Acc. Name: ${data.bankAccountName}` : '',
    data.bankAccountNumber ? `Acc. Number: ${data.bankAccountNumber}` : '',
    data.bankIfsc ? `IFSC: ${data.bankIfsc}` : '',
    data.bankSwift ? `Swift Code: ${data.bankSwift}` : ''
  ].filter(Boolean);
  doc.text(bankLines.join('\n') || 'Add bank details in Settings to print them here.', L + 8, y + 20, { width: leftW - 16 });

  doc.font('Helvetica').fontSize(7).text(
    data.footerText || 'Certified that the particulars given above are true and correct.',
    L + leftW + 8,
    y + 8,
    { width: W - leftW - 16, align: 'center' }
  );
  doc.font('Helvetica-Bold').fontSize(8).text(`For ${data.businessName || 'Business'}`, L + leftW + 8, y + 28, {
    width: W - leftW - 16,
    align: 'center'
  });
  doc.font('Helvetica').fontSize(7).text('Authorized Signatory', L + leftW + 8, y + footerH - 16, {
    width: W - leftW - 16,
    align: 'center'
  });
};

const mmToPt = (mm: number) => mm * 2.83465;

const money = (value?: number) => `Rs ${indianMoney(value)}`;

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

  const filename = invoicePdfFilename(data.invoiceNumber, 'pos');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `${options?.inline ? 'inline' : 'attachment'}; filename="${filename}"`
  );
  doc.pipe(res);
  renderThermalReceipt(data, doc, widthMm);
  doc.end();
};

export const generateInvoicePDF = async (data: InvoiceData, res: Response) => {
  const buffer = await generateInvoicePDFBuffer(data);
  const filename = invoicePdfFilename(data.invoiceNumber, data.isPurchase ? 'purchase' : 'sale');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
};

export const generateInvoicePDFBuffer = async (data: InvoiceData): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      margin: 24,
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
