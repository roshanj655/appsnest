import { Connection } from 'mongoose';
import {
  applyInventoryMovement,
  rollupProductStock as rollup,
  type MovementSource
} from '../services/inventoryCosting';

export type { MovementSource };
export const rollupProductStock = rollup;

const typeFromSource = (source: MovementSource, direction: 'in' | 'out', notes?: string) => {
  if (source === 'purchase') return direction === 'in' ? 'PURCHASE' : 'PURCHASE_RETURN';
  if (source === 'sale') return direction === 'out' ? 'SALE' : 'SALE_RETURN';
  if (source === 'opening') return 'OPENING';
  if (source === 'return') return direction === 'in' ? 'SALE_RETURN' : 'PURCHASE_RETURN';
  if (/expir/i.test(String(notes || ''))) return 'EXPIRY';
  if (/damage/i.test(String(notes || ''))) return 'DAMAGE';
  return 'ADJUSTMENT';
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
    unitCost?: number;
    createdBy?: string;
    warehouseId?: string;
  }
) => {
  const result = await applyInventoryMovement(connection, {
    productId: input.productId,
    variantId: input.variantId,
    quantity: input.quantity,
    direction: input.direction,
    transactionType: typeFromSource(input.source, input.direction, input.notes) as any,
    unitCost: input.unitCost,
    referenceType: input.source.toUpperCase(),
    referenceId: input.sourceId,
    notes: input.notes,
    createdBy: input.createdBy,
    warehouseId: input.warehouseId
  });
  return result.product;
};

export const applyLineStock = async (
  connection: Connection,
  items: Array<{ productId?: any; variantId?: any; quantity?: number; price?: number; unitCost?: number; costPerUnit?: number; costPrice?: number }>,
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
      sourceId,
      unitCost: Number(item.unitCost ?? item.price ?? item.costPerUnit ?? item.costPrice ?? 0) || undefined
    });
  }
};
