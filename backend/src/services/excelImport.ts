import { Connection } from 'mongoose';
import { TenantRequest } from '../middleware/tenant';
import { getProductModel } from '../models/tenant/Product';
import { getCategoryModel } from '../models/tenant/Category';
import { getCustomerModel } from '../models/tenant/Customer';
import { getSupplierModel } from '../models/tenant/Supplier';
import { getExpenseModel, EXPENSE_CATEGORIES, resolveExpenseKind, type ExpenseCategory } from '../models/tenant/Expense';
import { getBusinessUnitModel } from '../models/tenant/BusinessUnit';
import { recordOpeningIfNeeded } from './inventoryCosting';
import { resolveBusinessUnitId } from '../utils/businessUnit';
import { buildSampleWorkbook, cellBoolean, cellNumber, pick, readSheetRows, type ExcelColumn } from '../utils/excel';
import { logAuditEvent } from '../utils/auditLogger';

export type ImportKind = 'products' | 'customers' | 'suppliers' | 'categories' | 'expenses' | 'business-units';

export type ImportError = { row: number; message: string };

export type ImportResult = {
  created: number;
  skipped: number;
  errors: ImportError[];
};

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const commonInstructions = [
  'Keep the first row as column headers. Do not rename them.',
  'Fill one record per row. Delete the sample rows before uploading your data, or leave them if they are valid.',
  'Empty rows are ignored. Upload the filled .xlsx file from the same screen.',
  'Maximum 500 data rows per upload.'
];

const productColumns: ExcelColumn[] = [
  { header: 'Name', key: 'name', width: 24 },
  { header: 'SKU', key: 'sku', width: 14 },
  { header: 'Barcode', key: 'barcode', width: 16 },
  { header: 'Brand', key: 'brand', width: 14 },
  { header: 'Unit', key: 'unit', width: 10 },
  { header: 'Category', key: 'category', width: 16 },
  { header: 'Location', key: 'location', width: 14 },
  { header: 'Selling Price', key: 'sellingPrice', width: 14 },
  { header: 'Cost Price', key: 'purchasePrice', width: 14 },
  { header: 'Opening Stock', key: 'stock', width: 14 },
  { header: 'Min Stock', key: 'minStock', width: 12 },
  { header: 'Max Stock', key: 'maxStock', width: 12 },
  { header: 'MRP', key: 'mrp', width: 10 },
  { header: 'GST', key: 'gst', width: 10 },
  { header: 'HSN', key: 'hsn', width: 12 },
  { header: 'Description', key: 'description', width: 22 },
  { header: 'Notes', key: 'notes', width: 18 },
  { header: 'Online Price', key: 'onlinePrice', width: 14 },
  { header: 'Online Visible', key: 'onlineVisible', width: 14 },
  { header: 'Variant Name', key: 'variantName', width: 16 },
  { header: 'Variant SKU', key: 'variantSku', width: 14 },
  { header: 'Variant Barcode', key: 'variantBarcode', width: 16 },
  { header: 'Variant Attributes', key: 'variantAttributes', width: 18 },
  { header: 'Variant Selling Price', key: 'variantSellingPrice', width: 18 },
  { header: 'Variant Cost Price', key: 'variantPurchasePrice', width: 16 },
  { header: 'Variant Opening Stock', key: 'variantStock', width: 18 }
];

const partyColumns: ExcelColumn[] = [
  { header: 'Name', key: 'name', width: 24 },
  { header: 'Phone', key: 'phone', width: 16 },
  { header: 'Email', key: 'email', width: 24 },
  { header: 'GSTIN', key: 'gstin', width: 18 },
  { header: 'Credit Limit', key: 'creditLimit', width: 14 },
  { header: 'Address', key: 'address', width: 28 },
  { header: 'Notes', key: 'notes', width: 22 }
];

const categoryColumns: ExcelColumn[] = [
  { header: 'Name', key: 'name', width: 24 },
  { header: 'Description', key: 'description', width: 36 }
];

const expenseColumns: ExcelColumn[] = [
  { header: 'Title', key: 'title', width: 24 },
  { header: 'Amount', key: 'amount', width: 12 },
  { header: 'Category', key: 'category', width: 16 },
  { header: 'Kind', key: 'kind', width: 12 },
  { header: 'Expense Date', key: 'expenseDate', width: 16 },
  { header: 'Notes', key: 'notes', width: 28 }
];

const unitColumns: ExcelColumn[] = [
  { header: 'Name', key: 'name', width: 24 },
  { header: 'Code', key: 'code', width: 12 },
  { header: 'Notes', key: 'notes', width: 36 }
];

export const sampleFileName = (kind: ImportKind) => `${kind}-import-sample.xlsx`;

export const buildImportSample = (kind: ImportKind) => {
  if (kind === 'products') {
    return buildSampleWorkbook(
      'Products',
      productColumns,
      [
        {
          name: 'Sample Tea',
          sku: 'TEA-001',
          barcode: '8901234567890',
          brand: 'House',
          unit: 'pcs',
          category: 'Grocery',
          location: 'A1',
          sellingPrice: 120,
          purchasePrice: 90,
          stock: 10,
          minStock: 5,
          maxStock: 100,
          mrp: 130,
          gst: 5,
          hsn: '0902',
          description: 'Loose tea 250g',
          notes: '',
          onlinePrice: 120,
          onlineVisible: 'No'
        },
        {
          name: 'Cotton Shirt',
          sku: 'SHIRT-001',
          sellingPrice: 799,
          purchasePrice: 450,
          unit: 'pcs',
          variantName: 'Small',
          variantSku: 'SHIRT-001-S',
          variantBarcode: '',
          variantAttributes: 'Size=S',
          variantSellingPrice: 799,
          variantPurchasePrice: 450,
          variantStock: 4
        },
        {
          name: 'Cotton Shirt',
          sku: 'SHIRT-001',
          sellingPrice: 799,
          purchasePrice: 450,
          unit: 'pcs',
          variantName: 'Medium',
          variantSku: 'SHIRT-001-M',
          variantAttributes: 'Size=M',
          variantSellingPrice: 799,
          variantPurchasePrice: 450,
          variantStock: 6
        }
      ],
      [
        ...commonInstructions,
        'Required: Name and SKU. SKU must be unique.',
        'Cost Price is the cost of opening stock. Opening Stock plus Cost Price records opening inventory.',
        'Category is matched by name. If it does not exist, it is created.',
        'To import variants, repeat the same SKU on extra rows and fill Variant Name. Parent opening stock is ignored when variants exist.'
      ]
    );
  }

  if (kind === 'customers' || kind === 'suppliers') {
    const noun = kind === 'customers' ? 'Customer' : 'Supplier';
    return buildSampleWorkbook(
      noun,
      partyColumns,
      [
        {
          name: `Sample ${noun}`,
          phone: '9876543210',
          email: `${kind.slice(0, -1)}@example.com`,
          gstin: '22AAAAA0000A1Z5',
          creditLimit: 10000,
          address: 'Shop 12, Main Road',
          notes: ''
        }
      ],
      [...commonInstructions, 'Required: Name and Phone.']
    );
  }

  if (kind === 'categories') {
    return buildSampleWorkbook(
      'Categories',
      categoryColumns,
      [{ name: 'Grocery', description: 'Daily grocery items' }],
      [...commonInstructions, 'Required: Name. Duplicate names are skipped.']
    );
  }

  if (kind === 'expenses') {
    return buildSampleWorkbook(
      'Expenses',
      expenseColumns,
      [
        {
          title: 'Shop rent',
          amount: 15000,
          category: 'rent',
          kind: 'shop',
          expenseDate: new Date().toISOString().slice(0, 10),
          notes: 'April'
        },
        {
          title: 'Home groceries from shop cash',
          amount: 2000,
          category: 'home',
          kind: 'personal',
          expenseDate: new Date().toISOString().slice(0, 10),
          notes: 'Owner draw'
        }
      ],
      [
        ...commonInstructions,
        'Required: Title, Amount, Category.',
        `Category must be one of: ${EXPENSE_CATEGORIES.join(', ')}.`,
        'Kind is optional: shop or personal. personal/home/family categories default to personal.',
        'Expense Date format: YYYY-MM-DD. Blank uses today.'
      ]
    );
  }

  return buildSampleWorkbook(
    'BusinessUnits',
    unitColumns,
    [{ name: 'Warehouse 2', code: 'WH2', notes: 'Secondary store' }],
    [...commonInstructions, 'Required: Name and Code. Code must be unique.']
  );
};

const auditCreate = async (req: TenantRequest, entity: string, entityId: string, changes: unknown) => {
  if (!req.user || !req.business) return;
  await logAuditEvent({
    user: req.user as any,
    business: req.business,
    action: 'CREATE',
    entity,
    entityId,
    changes,
    req
  });
};

const resolveCategoryId = async (connection: Connection, name: string, req: TenantRequest) => {
  const trimmed = name.trim();
  if (!trimmed) return undefined;
  const Category = getCategoryModel(connection);
  const existing = await Category.findOne({
    name: new RegExp(`^${escapeRegex(trimmed)}$`, 'i')
  });
  if (existing) return existing._id;
  const created = await Category.create({
    name: trimmed,
    businessUnitId: resolveBusinessUnitId(req),
    status: 'active'
  });
  await auditCreate(req, 'Category', created._id.toString(), { name: trimmed, source: 'excel-import' });
  return created._id;
};

const importProducts = async (req: TenantRequest, rows: Array<{ rowNumber: number; data: Record<string, string> }>): Promise<ImportResult> => {
  const Product = getProductModel(req.tenantDB!);
  const errors: ImportError[] = [];
  const grouped = new Map<string, { rowNumber: number; data: Record<string, string>; variants: any[] }>();

  for (const { rowNumber, data } of rows) {
    const sku = pick(data, 'sku').toUpperCase();
    const name = pick(data, 'name', 'productname');
    const variantName = pick(data, 'variantname');
    if (!sku) {
      errors.push({ row: rowNumber, message: 'SKU is required.' });
      continue;
    }
    const current = grouped.get(sku);
    if (!current && !name) {
      errors.push({ row: rowNumber, message: 'Name and SKU are required.' });
      continue;
    }
    if (!current) {
      grouped.set(sku, { rowNumber, data, variants: [] });
    }
    const target = grouped.get(sku)!;
    if (variantName) {
      const stock = cellNumber(pick(data, 'variantopeningstock', 'variantstock'));
      const purchasePrice = cellNumber(pick(data, 'variantcostprice', 'variantpurchaseprice'));
      if (stock > 0 && purchasePrice <= 0) {
        errors.push({ row: rowNumber, message: `Enter cost price for variant "${variantName}" with opening stock.` });
        continue;
      }
      target.variants.push({
        name: variantName,
        sku: pick(data, 'variantsku').toUpperCase() || undefined,
        barcode: pick(data, 'variantbarcode') || undefined,
        attributes: pick(data, 'variantattributes') || undefined,
        sellingPrice: cellNumber(pick(data, 'variantsellingprice'), cellNumber(pick(data, 'sellingprice'))),
        purchasePrice,
        stock
      });
    }
  }

  let created = 0;
  for (const [sku, draft] of grouped) {
    const existing = await Product.findOne({ sku });
    if (existing) {
      errors.push({ row: draft.rowNumber, message: `SKU ${sku} already exists.` });
      continue;
    }
    const name = pick(draft.data, 'name', 'productname');
    const stock = cellNumber(pick(draft.data, 'openingstock', 'stock'));
    const purchasePrice = cellNumber(pick(draft.data, 'costprice', 'purchaseprice'));
    if (!draft.variants.length && stock > 0 && purchasePrice <= 0) {
      errors.push({ row: draft.rowNumber, message: 'Enter opening stock quantity and the cost per unit for that stock.' });
      continue;
    }
    try {
      const sellingPrice = cellNumber(pick(draft.data, 'sellingprice'));
      const categoryId = await resolveCategoryId(req.tenantDB!, pick(draft.data, 'category'), req);
      const payload: Record<string, unknown> = {
        name,
        sku,
        barcode: pick(draft.data, 'barcode'),
        brand: pick(draft.data, 'brand'),
        unit: pick(draft.data, 'unit') || 'pcs',
        location: pick(draft.data, 'location', 'racklocation'),
        sellingPrice,
        purchasePrice,
        onlinePrice: cellNumber(pick(draft.data, 'onlineprice')),
        onlineVisible: cellBoolean(pick(draft.data, 'onlinevisible')),
        mrp: cellNumber(pick(draft.data, 'mrp')),
        stock: draft.variants.length ? 0 : stock,
        minStock: cellNumber(pick(draft.data, 'minstock'), 10),
        maxStock: cellNumber(pick(draft.data, 'maxstock')),
        gst: cellNumber(pick(draft.data, 'gst')),
        hsn: pick(draft.data, 'hsn'),
        description: pick(draft.data, 'description'),
        notes: pick(draft.data, 'notes'),
        variants: draft.variants,
        lastPurchaseCost: purchasePrice,
        averageCost: purchasePrice,
        businessUnitId: resolveBusinessUnitId(req)
      };
      if (categoryId) payload.categoryId = categoryId;
      const product = await Product.create(payload);
      await recordOpeningIfNeeded(req.tenantDB!, product, req.user ? String((req.user as any)._id || '') : undefined);
      await auditCreate(req, 'Product', product._id.toString(), { sku, source: 'excel-import' });
      created += 1;
    } catch (error: any) {
      errors.push({ row: draft.rowNumber, message: error?.message || `Unable to create SKU ${sku}.` });
    }
  }

  return { created, skipped: errors.length, errors };
};

const importParties = async (
  req: TenantRequest,
  rows: Array<{ rowNumber: number; data: Record<string, string> }>,
  kind: 'customers' | 'suppliers'
): Promise<ImportResult> => {
  const Model =
    kind === 'customers' ? getCustomerModel(req.tenantDB!) : getSupplierModel(req.tenantDB!);
  const entity = kind === 'customers' ? 'Customer' : 'Supplier';
  const errors: ImportError[] = [];
  let created = 0;

  for (const { rowNumber, data } of rows) {
    const name = pick(data, 'name');
    const phone = pick(data, 'phone');
    if (!name || !phone) {
      errors.push({ row: rowNumber, message: 'Name and phone are required.' });
      continue;
    }
    const email = pick(data, 'email');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push({ row: rowNumber, message: 'Enter a valid email address.' });
      continue;
    }
    try {
      const existing = await (Model as any).findOne({
        $or: [{ phone }, ...(email ? [{ email }] : [])]
      });
      if (existing) {
        errors.push({ row: rowNumber, message: 'A record with this phone or email already exists.' });
        continue;
      }
      const doc = await Model.create({
        name,
        phone,
        email: email || undefined,
        gstin: pick(data, 'gstin').toUpperCase() || undefined,
        creditLimit: cellNumber(pick(data, 'creditlimit')),
        address: pick(data, 'address') || undefined,
        notes: pick(data, 'notes') || undefined
      });
      if (!doc?._id) {
        errors.push({ row: rowNumber, message: 'Unable to create this row.' });
        continue;
      }
      await auditCreate(req, entity, String(doc._id), { name, phone, source: 'excel-import' });
      created += 1;
    } catch (error: any) {
      errors.push({ row: rowNumber, message: error?.message || 'Unable to create this row.' });
    }
  }

  return { created, skipped: errors.length, errors };
};

const importCategories = async (req: TenantRequest, rows: Array<{ rowNumber: number; data: Record<string, string> }>): Promise<ImportResult> => {
  const Category = getCategoryModel(req.tenantDB!);
  const errors: ImportError[] = [];
  let created = 0;
  for (const { rowNumber, data } of rows) {
    const name = pick(data, 'name', 'categoryname');
    if (!name) {
      errors.push({ row: rowNumber, message: 'Category name is required.' });
      continue;
    }
    const existing = await Category.findOne({ name: new RegExp(`^${escapeRegex(name)}$`, 'i') });
    if (existing) {
      errors.push({ row: rowNumber, message: 'A category with this name already exists.' });
      continue;
    }
    try {
      const category = await Category.create({
        name,
        description: pick(data, 'description') || undefined,
        businessUnitId: resolveBusinessUnitId(req),
        status: 'active'
      });
      await auditCreate(req, 'Category', category._id.toString(), { name, source: 'excel-import' });
      created += 1;
    } catch (error: any) {
      errors.push({ row: rowNumber, message: error?.message || 'Unable to create category.' });
    }
  }
  return { created, skipped: errors.length, errors };
};

const importExpenses = async (req: TenantRequest, rows: Array<{ rowNumber: number; data: Record<string, string> }>): Promise<ImportResult> => {
  const Expense = getExpenseModel(req.tenantDB!);
  const errors: ImportError[] = [];
  let created = 0;
  for (const { rowNumber, data } of rows) {
    const title = pick(data, 'title');
    const amount = cellNumber(pick(data, 'amount'));
    const category = pick(data, 'category').toLowerCase() as ExpenseCategory;
    if (!title) {
      errors.push({ row: rowNumber, message: 'Title is required.' });
      continue;
    }
    if (!Number.isFinite(amount) || amount < 0) {
      errors.push({ row: rowNumber, message: 'Amount must be zero or greater.' });
      continue;
    }
    if (!EXPENSE_CATEGORIES.includes(category)) {
      errors.push({ row: rowNumber, message: `Category must be one of: ${EXPENSE_CATEGORIES.join(', ')}.` });
      continue;
    }
    const dateText = pick(data, 'expensedate', 'date');
    const expenseDate = dateText ? new Date(dateText) : new Date();
    if (Number.isNaN(expenseDate.getTime())) {
      errors.push({ row: rowNumber, message: 'Expense Date must be YYYY-MM-DD.' });
      continue;
    }
    try {
      const kindText = pick(data, 'kind', 'type').toLowerCase();
      const kind = resolveExpenseKind(category, kindText || undefined);
      const expense = await Expense.create({
        title,
        amount,
        category,
        kind,
        expenseDate,
        notes: pick(data, 'notes') || undefined,
        businessUnitId: resolveBusinessUnitId(req),
        status: 'active'
      });
      await auditCreate(req, 'Expense', expense._id.toString(), { title, amount, kind, source: 'excel-import' });
      created += 1;
    } catch (error: any) {
      errors.push({ row: rowNumber, message: error?.message || 'Unable to create expense.' });
    }
  }
  return { created, skipped: errors.length, errors };
};

const importUnits = async (req: TenantRequest, rows: Array<{ rowNumber: number; data: Record<string, string> }>): Promise<ImportResult> => {
  const BusinessUnit = getBusinessUnitModel(req.tenantDB!);
  const errors: ImportError[] = [];
  let created = 0;
  for (const { rowNumber, data } of rows) {
    const name = pick(data, 'name');
    const code = pick(data, 'code').toUpperCase();
    if (!name || !code) {
      errors.push({ row: rowNumber, message: 'Name and code are required.' });
      continue;
    }
    const existing = await BusinessUnit.findOne({ code });
    if (existing) {
      errors.push({ row: rowNumber, message: 'A unit with this code already exists.' });
      continue;
    }
    try {
      const unit = await BusinessUnit.create({
        name,
        code,
        notes: pick(data, 'notes') || undefined,
        status: 'active'
      });
      await auditCreate(req, 'BusinessUnit', unit._id.toString(), { name, code, source: 'excel-import' });
      created += 1;
    } catch (error: any) {
      errors.push({ row: rowNumber, message: error?.message || 'Unable to create unit.' });
    }
  }
  return { created, skipped: errors.length, errors };
};

export const runExcelImport = async (kind: ImportKind, req: TenantRequest, buffer: Buffer): Promise<ImportResult> => {
  const rows = await readSheetRows(buffer);
  if (!rows.length) {
    return { created: 0, skipped: 0, errors: [{ row: 1, message: 'No data rows found. Keep the header row and add records below it.' }] };
  }
  if (kind === 'products') return importProducts(req, rows);
  if (kind === 'customers' || kind === 'suppliers') return importParties(req, rows, kind);
  if (kind === 'categories') return importCategories(req, rows);
  if (kind === 'expenses') return importExpenses(req, rows);
  return importUnits(req, rows);
};
