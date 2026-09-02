import { z } from 'zod';

const money = z.coerce.number().min(0);
const optionalString = z.string().trim().optional();

export const loginSchema = z.object({
  email: z.string().trim().min(3),
  password: z.string().min(1)
});

export const emailSchema = z.object({
  to: z.string().trim().min(3)
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1)
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6)
});

export const productSchema = z.object({
  name: z.string().trim().min(1),
  sku: z.string().trim().min(1),
  barcode: optionalString,
  brand: optionalString,
  unit: optionalString,
  purchasePrice: money.optional(),
  sellingPrice: money.optional(),
  onlinePrice: money.optional(),
  onlineVisible: z.coerce.boolean().optional(),
  mrp: money.optional(),
  stock: money.optional(),
  minStock: money.optional(),
  maxStock: money.optional(),
  location: optionalString,
  gst: money.optional(),
  hsn: optionalString,
  description: optionalString,
  notes: optionalString,
  categoryId: optionalString,
  businessUnitId: optionalString,
  status: z.enum(['active', 'inactive']).optional(),
  variants: z.array(z.object({
    _id: optionalString,
    name: z.string().trim().min(1),
    sku: optionalString,
    barcode: optionalString,
    attributes: optionalString,
    purchasePrice: money.optional(),
    sellingPrice: money.optional(),
    stock: money.optional()
  })).optional()
}).passthrough();

export const productUpdateSchema = productSchema.partial();

export const categorySchema = z.object({
  name: z.string().trim().min(1),
  description: optionalString,
  businessUnitId: optionalString,
  status: z.enum(['active', 'inactive']).optional()
});

export const categoryUpdateSchema = categorySchema.partial();

export const partySchema = z.object({
  name: z.string().trim().min(1),
  phone: z.string().trim().min(1),
  email: z.union([z.literal(''), z.string().trim().min(3)]).optional(),
  gstin: optionalString,
  creditLimit: money.optional(),
  notes: optionalString,
  address: optionalString,
  city: optionalString,
  state: optionalString,
  country: optionalString,
  pincode: optionalString,
  status: z.enum(['active', 'inactive']).optional()
}).passthrough();

export const partyUpdateSchema = partySchema.partial();

const lineItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().positive(),
  price: money,
  sellingPrice: money.optional(),
  actualSoldAmount: money.optional(),
  discount: money.optional(),
  gst: money.optional(),
  total: money,
  productName: optionalString,
  variantId: optionalString,
  variantName: optionalString,
  costPrice: money.optional()
});

const jsonItems = z.preprocess((value) => {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}, z.array(lineItemSchema).min(1));

export const saleSchema = z.object({
  customerId: optionalString,
  businessUnitId: optionalString,
  items: jsonItems,
  paymentMode: z.string().optional(),
  status: z.enum(['draft', 'completed', 'cancelled']).optional(),
  subtotal: money.optional(),
  discount: money.optional(),
  gst: money.optional(),
  total: money.optional(),
  source: z.enum(['pos', 'manual']).optional(),
  paidAmount: money.optional(),
  changeAmount: money.optional()
}).passthrough();

export const saleUpdateSchema = saleSchema.partial().extend({
  items: jsonItems.optional()
});

export const purchaseSchema = z.object({
  supplierId: optionalString,
  supplierInvoiceNumber: optionalString,
  businessUnitId: optionalString,
  items: jsonItems,
  status: z.enum(['draft', 'completed', 'cancelled']).optional(),
  paidAmount: money.optional(),
  subtotal: money.optional(),
  discount: money.optional(),
  gst: money.optional(),
  total: money.optional()
}).passthrough();

export const purchaseUpdateSchema = purchaseSchema.partial().extend({
  items: jsonItems.optional()
});

export const expenseSchema = z.object({
  title: z.string().trim().min(1),
  amount: money,
  category: z.enum(['personal', 'rent', 'utilities', 'transport', 'salary', 'maintenance', 'other']),
  businessUnitId: optionalString,
  expenseDate: z.coerce.date().optional(),
  notes: optionalString,
  status: z.enum(['active', 'inactive']).optional()
});

export const expenseUpdateSchema = expenseSchema.partial();

export const stockAdjustmentSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().int().min(1),
  direction: z.enum(['in', 'out']),
  reason: z.enum(['opening', 'found', 'damage', 'loss', 'return', 'correction', 'other']),
  notes: optionalString
});

export const stockAdjustmentUpdateSchema = z.object({
  status: z.enum(['active', 'cancelled'])
});

export const settingsSchema = z.object({
  businessName: z.string().trim().min(1),
  email: z.string().trim().min(3),
  phone: z.string().trim().min(1)
}).passthrough();

export const businessUnitSchema = z.object({
  name: z.string().trim().min(1),
  code: z.string().trim().min(1),
  notes: optionalString,
  status: z.enum(['active', 'inactive']).optional()
});

export const businessUnitUpdateSchema = businessUnitSchema.partial();
