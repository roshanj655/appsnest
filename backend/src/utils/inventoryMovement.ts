import { Connection } from 'mongoose';
import { getProductModel } from '../models/tenant/Product';
import { getInventoryTransactionModel } from '../models/tenant/InventoryTransaction';

type MovementSource = 'sale' | 'purchase' | 'adjustment' | 'opening' | 'return';

const findVariant = (product: any, variantId?: string) => {
  if (!variantId) return null;
  return (product.variants || []).find((variant: any) => String(variant._id) === String(variantId)) || null;
};

export const rollupProductStock = (product: any) => {
  if (product.variants?.length) {
    product.stock = product.variants.reduce((sum: number, variant: any) => sum + Number(variant.stock || 0), 0);
  }
};

export const applyStockDelta = async (
  connection: Connection,
  input: {
    productId: string;
    variantId?: string;
    quantity: number;
    direction: 'in' | 'out';
    source: MovementSource;
    sourceId?: string;
    notes?: string;
  }
) => {
  const Product = getProductModel(connection);
  const product = await Product.findById(input.productId);
  if (!product) {
    throw new Error('Product not found');
  }
  const delta = input.direction === 'in' ? input.quantity : -input.quantity;
  const variant = findVariant(product, input.variantId);
  if (input.variantId && !variant) {
    throw new Error('Variant not found');
  }
  if (variant) {
    const next = Number(variant.stock || 0) + delta;
    if (next < 0) {
      throw new Error(`${product.name} (${variant.name}) would have negative stock.`);
    }
    variant.stock = next;
    rollupProductStock(product);
  } else {
    const next = Number(product.stock || 0) + delta;
    if (next < 0) {
      throw new Error(`${product.name} would have negative stock.`);
    }
    product.stock = next;
  }
  await product.save();
  const InventoryTransaction = getInventoryTransactionModel(connection);
  await InventoryTransaction.create({
    productId: input.productId,
    variantId: variant?._id,
    variantName: variant?.name,
    quantity: input.quantity,
    direction: input.direction,
    source: input.source,
    sourceId: input.sourceId,
    notes: input.notes,
    stockAfter: variant ? variant.stock : product.stock,
    businessUnitId: product.businessUnitId
  });
  return product;
};

export const applyLineStock = async (
  connection: Connection,
  items: Array<{ productId?: any; variantId?: any; quantity?: number }>,
  multiplier: number,
  source: MovementSource,
  sourceId?: string
) => {
  for (const item of items || []) {
    const productId = String(item.productId?._id || item.productId || '');
    const variantId = String(item.variantId?._id || item.variantId || '');
    const quantity = Number(item.quantity);
    if (!productId || !quantity) continue;
    const delta = multiplier * quantity;
    await applyStockDelta(connection, {
      productId,
      variantId: variantId || undefined,
      quantity: Math.abs(quantity),
      direction: delta >= 0 ? 'in' : 'out',
      source,
      sourceId
    });
  }
};
