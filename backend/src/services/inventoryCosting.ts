import { ClientSession, Connection, Types } from 'mongoose';
import { getProductModel } from '../models/tenant/Product';
import { getInventoryTransactionModel, InventoryTransactionType } from '../models/tenant/InventoryTransaction';
import { inboundAverage, outboundAverage, outboundSpecific, money2, money6, mulMoney } from '../utils/money';

export type MovementSource = 'sale' | 'purchase' | 'adjustment' | 'opening' | 'return';

type MovementInput = {
  productId: string;
  variantId?: string;
  quantity: number;
  transactionType: InventoryTransactionType;
  direction?: 'in' | 'out';
  unitCost?: number;
  referenceType?: string;
  referenceId?: string;
  originalTransactionId?: string;
  notes?: string;
  createdBy?: string;
  warehouseId?: string;
  session?: ClientSession;
};

const sourceFromType = (type: InventoryTransactionType): MovementSource => {
  if (type === 'OPENING') return 'opening';
  if (type === 'PURCHASE') return 'purchase';
  if (type === 'SALE') return 'sale';
  if (type === 'PURCHASE_RETURN' || type === 'SALE_RETURN') return 'return';
  return 'adjustment';
};

const findVariant = (product: any, variantId?: string) => {
  if (!variantId) return null;
  return (product.variants || []).find((variant: any) => String(variant._id) === String(variantId)) || null;
};

export const costingOf = (product: any, variant?: any) => {
  const layer = variant || product;
  const stock = Number(layer?.stock || 0);
  const lastPurchaseCost = Number(layer?.lastPurchaseCost || layer?.purchasePrice || product?.purchasePrice || 0);
  const averageCost = Number(layer?.averageCost || lastPurchaseCost || 0);
  const inventoryValue = Number(layer?.inventoryValue || mulMoney(stock, averageCost));
  return { stock, averageCost, lastPurchaseCost, inventoryValue };
};

export const rollupProductStock = (product: any) => {
  if (!product.variants?.length) {
    product.inventoryValue = money2(mulMoney(Number(product.stock || 0), Number(product.averageCost || 0)));
    return;
  }
  product.stock = product.variants.reduce((sum: number, variant: any) => sum + Number(variant.stock || 0), 0);
  product.inventoryValue = money2(
    product.variants.reduce((sum: number, variant: any) => sum + Number(variant.inventoryValue || mulMoney(variant.stock || 0, variant.averageCost || 0)), 0)
  );
  const weighted = product.variants.reduce(
    (acc: { qty: number; value: number }, variant: any) => {
      const qty = Number(variant.stock || 0);
      return { qty: acc.qty + qty, value: acc.value + Number(variant.inventoryValue || mulMoney(qty, variant.averageCost || 0)) };
    },
    { qty: 0, value: 0 }
  );
  product.averageCost = weighted.qty > 0 ? money6(weighted.value / weighted.qty) : 0;
};

const applyLayer = (
  product: any,
  variant: any,
  next: { quantity: number; averageCost: number; inventoryValue: number },
  extras: { lastPurchaseCost?: number; lastPurchaseDate?: Date }
) => {
  const target = variant || product;
  target.stock = next.quantity;
  target.averageCost = next.averageCost;
  target.inventoryValue = next.inventoryValue;
  if (extras.lastPurchaseCost != null) {
    target.lastPurchaseCost = extras.lastPurchaseCost;
    target.purchasePrice = extras.lastPurchaseCost;
    target.lastPurchaseDate = extras.lastPurchaseDate || new Date();
  }
  rollupProductStock(product);
};

const inboundTypes: InventoryTransactionType[] = ['OPENING', 'PURCHASE', 'SALE_RETURN', 'TRANSFER_IN'];

export const applyInventoryMovement = async (connection: Connection, input: MovementInput) => {
  const qty = Number(input.quantity);
  if (!Number.isFinite(qty) || qty <= 0) {
    throw Object.assign(new Error('Quantity must be greater than 0.'), { status: 400 });
  }

  const Product = getProductModel(connection);
  const InventoryTransaction = getInventoryTransactionModel(connection);

  for (let attempt = 0; attempt < 8; attempt++) {
    const product = await Product.findById(input.productId).session(input.session || null);
    if (!product) {
      throw Object.assign(new Error('Product not found'), { status: 404 });
    }
    const variant = findVariant(product, input.variantId);
    if (input.variantId && !variant) {
      throw Object.assign(new Error('Variant not found'), { status: 400 });
    }

    const current = costingOf(product, variant);
    const goingIn = input.direction
      ? input.direction === 'in'
      : inboundTypes.includes(input.transactionType);
    let next;
    let unitCost = Number(input.unitCost ?? 0);

    if (goingIn) {
      if (input.transactionType === 'SALE_RETURN') {
        if (unitCost <= 0) {
          throw Object.assign(new Error('Sales returns must restore the original sale cost.'), { status: 400 });
        }
        next = inboundAverage(current.stock, current.averageCost, qty, unitCost);
      } else {
        if (unitCost <= 0) {
          unitCost = current.averageCost || current.lastPurchaseCost;
        }
        if (unitCost <= 0) {
          throw Object.assign(new Error('A cost basis is required to add stock.'), { status: 400 });
        }
        next = inboundAverage(current.stock, current.averageCost, qty, unitCost);
      }
    } else if (input.transactionType === 'PURCHASE_RETURN') {
      if (unitCost <= 0) {
        throw Object.assign(new Error('Purchase returns must use the original purchase cost.'), { status: 400 });
      }
      next = outboundSpecific(current.stock, current.averageCost, qty, unitCost);
    } else {
      unitCost = current.averageCost || current.lastPurchaseCost;
      next = outboundAverage(current.stock, current.averageCost, qty);
    }

    const purchaseLike = input.transactionType === 'PURCHASE' || input.transactionType === 'OPENING';
    applyLayer(product, variant, next, purchaseLike ? { lastPurchaseCost: unitCost, lastPurchaseDate: new Date() } : {});

    try {
      await product.save({ session: input.session });
    } catch (error: any) {
      if (error?.name === 'VersionError' || error?.code === 11000) {
        continue;
      }
      throw error;
    }

    const signedQty = goingIn ? qty : -qty;
    const totalCost = money2(mulMoney(signedQty, unitCost));
    const warehouseId = input.warehouseId || product.businessUnitId;
    const txPayload = {
      productId: input.productId,
      variantId: variant?._id,
      variantName: variant?.name,
      warehouseId,
      businessUnitId: product.businessUnitId,
      transactionType: input.transactionType,
      quantity: signedQty,
      direction: goingIn ? 'in' : 'out',
      source: sourceFromType(input.transactionType),
      sourceId: input.referenceId,
      unitCost: money6(unitCost),
      totalCost,
      averageCostAfter: next.averageCost,
      stockAfter: variant ? variant.stock : product.stock,
      inventoryValueAfter: variant ? variant.inventoryValue : product.inventoryValue,
      referenceType: input.referenceType || input.transactionType,
      referenceId: input.referenceId,
      originalTransactionId: input.originalTransactionId,
      notes: input.notes,
      createdBy: input.createdBy
    };
    const txDocs = input.session
      ? await InventoryTransaction.create([txPayload as any], { session: input.session })
      : [await InventoryTransaction.create(txPayload as any)];
    const tx = txDocs;

    return { product, transaction: tx[0], unitCost, layer: next };
  }

  throw Object.assign(new Error('Inventory was updated by another user. Retry the transaction.'), { status: 409 });
};

export const applyPurchaseLines = async (
  connection: Connection,
  items: Array<{ productId?: any; variantId?: any; quantity?: number; price?: number; unitCost?: number }>,
  referenceId: string,
  createdBy?: string,
  warehouseId?: string,
  session?: ClientSession
) => {
  const results = [];
  for (const item of items || []) {
    const productId = String(item.productId?._id || item.productId || '');
    const variantId = String(item.variantId?._id || item.variantId || '');
    const quantity = Number(item.quantity);
    const unitCost = Number(item.unitCost ?? item.price ?? 0);
    if (!productId || !quantity) continue;
    results.push(await applyInventoryMovement(connection, {
      productId,
      variantId: variantId || undefined,
      quantity,
      transactionType: 'PURCHASE',
      unitCost,
      referenceType: 'PURCHASE',
      referenceId,
      createdBy,
      warehouseId,
      session
    }));
  }
  return results;
};

export const reversePurchaseLines = async (
  connection: Connection,
  items: Array<{ productId?: any; variantId?: any; quantity?: number; price?: number; unitCost?: number }>,
  referenceId: string,
  createdBy?: string,
  warehouseId?: string,
  session?: ClientSession
) => {
  for (const item of items || []) {
    const productId = String(item.productId?._id || item.productId || '');
    const variantId = String(item.variantId?._id || item.variantId || '');
    const quantity = Number(item.quantity);
    const unitCost = Number(item.unitCost ?? item.price ?? 0);
    if (!productId || !quantity) continue;
    await applyInventoryMovement(connection, {
      productId,
      variantId: variantId || undefined,
      quantity,
      transactionType: 'PURCHASE_RETURN',
      unitCost,
      referenceType: 'PURCHASE',
      referenceId,
      createdBy,
      warehouseId,
      session
    });
  }
};

export const applySaleLines = async (
  connection: Connection,
  items: Array<{ productId?: any; variantId?: any; quantity?: number }>,
  referenceId: string,
  createdBy?: string,
  warehouseId?: string,
  session?: ClientSession
) => {
  const priced = [];
  for (const item of items || []) {
    const productId = String(item.productId?._id || item.productId || '');
    const variantId = String(item.variantId?._id || item.variantId || '');
    const quantity = Number(item.quantity);
    if (!productId || !quantity) continue;
    const result = await applyInventoryMovement(connection, {
      productId,
      variantId: variantId || undefined,
      quantity,
      transactionType: 'SALE',
      referenceType: 'SALE',
      referenceId,
      createdBy,
      warehouseId,
      session
    });
    priced.push({
      productId,
      variantId,
      quantity,
      costPerUnit: result.unitCost,
      cogs: money2(mulMoney(quantity, result.unitCost))
    });
  }
  return priced;
};

export const reverseSaleLines = async (
  connection: Connection,
  items: Array<{ productId?: any; variantId?: any; quantity?: number; costPerUnit?: number; costPrice?: number }>,
  referenceId: string,
  createdBy?: string,
  warehouseId?: string,
  session?: ClientSession
) => {
  for (const item of items || []) {
    const productId = String(item.productId?._id || item.productId || '');
    const variantId = String(item.variantId?._id || item.variantId || '');
    const quantity = Number(item.quantity);
    const unitCost = Number(item.costPerUnit ?? item.costPrice ?? 0);
    if (!productId || !quantity) continue;
    await applyInventoryMovement(connection, {
      productId,
      variantId: variantId || undefined,
      quantity,
      transactionType: 'SALE_RETURN',
      unitCost,
      referenceType: 'SALE',
      referenceId,
      createdBy,
      warehouseId,
      session
    });
  }
};

export const recordOpeningIfNeeded = async (
  connection: Connection,
  product: any,
  createdBy?: string
) => {
  const writeOpening = async (variant?: any) => {
    const layer = costingOf(product, variant);
    if (layer.stock <= 0) return;
    const unitCost = layer.averageCost || layer.lastPurchaseCost;
    if (unitCost <= 0) return;
    const InventoryTransaction = getInventoryTransactionModel(connection);
    await InventoryTransaction.create({
      productId: product._id,
      variantId: variant?._id,
      variantName: variant?.name,
      warehouseId: product.businessUnitId,
      businessUnitId: product.businessUnitId,
      transactionType: 'OPENING',
      quantity: layer.stock,
      direction: 'in',
      source: 'opening',
      sourceId: String(product._id),
      unitCost,
      totalCost: money2(mulMoney(layer.stock, unitCost)),
      averageCostAfter: unitCost,
      stockAfter: layer.stock,
      inventoryValueAfter: money2(mulMoney(layer.stock, unitCost)),
      referenceType: 'PRODUCT',
      referenceId: String(product._id),
      notes: 'Opening stock',
      createdBy
    });
  };

  if (product.variants?.length) {
    for (const variant of product.variants) {
      const stock = Number(variant.stock || 0);
      const unitCost = Number(variant.lastPurchaseCost || variant.purchasePrice || product.purchasePrice || 0);
      variant.averageCost = unitCost;
      variant.lastPurchaseCost = unitCost;
      variant.lastPurchaseDate = stock ? new Date() : undefined;
      variant.inventoryValue = money2(mulMoney(stock, unitCost));
      await writeOpening(variant);
    }
    rollupProductStock(product);
    await product.save();
    return;
  }

  const stock = Number(product.stock || 0);
  const unitCost = Number(product.lastPurchaseCost || product.purchasePrice || 0);
  product.averageCost = unitCost;
  product.lastPurchaseCost = unitCost;
  product.lastPurchaseDate = stock ? new Date() : undefined;
  product.inventoryValue = money2(mulMoney(stock, unitCost));
  await product.save();
  if (stock > 0 && unitCost > 0) {
    await writeOpening();
  }
};

const isTxnUnsupported = (error: any) =>
  /Transaction numbers are only allowed|replica set|IllegalOperation/i.test(String(error?.message || ''));

export const withOptionalTransaction = async <T>(
  connection: Connection,
  fn: (session?: ClientSession) => Promise<T>
): Promise<T> => {
  let session: ClientSession | undefined;
  try {
    session = await connection.startSession();
    session.startTransaction();
    const result = await fn(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    if (session) {
      try { await session.abortTransaction(); } catch { /* ignore */ }
    }
    if (isTxnUnsupported(error)) {
      return fn(undefined);
    }
    throw error;
  } finally {
    session?.endSession();
  }
};

export const stockSummaryRows = (products: any[]) => {
  const rows: any[] = [];
  for (const product of products) {
    const warehouseId = product.businessUnitId;
    if (product.variants?.length) {
      for (const variant of product.variants) {
        const layer = costingOf(product, variant);
        rows.push({
          productId: product._id,
          variantId: variant._id,
          name: product.name,
          variantName: variant.name,
          sku: variant.sku || product.sku,
          warehouseId,
          currentStock: layer.stock,
          averageCost: money6(layer.averageCost),
          lastPurchaseCost: money2(layer.lastPurchaseCost),
          lastPurchaseDate: variant.lastPurchaseDate || product.lastPurchaseDate,
          inventoryValue: money2(layer.inventoryValue || mulMoney(layer.stock, layer.averageCost)),
          sellingPrice: Number(variant.sellingPrice || product.sellingPrice || 0)
        });
      }
    } else {
      const layer = costingOf(product);
      rows.push({
        productId: product._id,
        variantId: null,
        name: product.name,
        variantName: null,
        sku: product.sku,
        warehouseId,
        currentStock: layer.stock,
        averageCost: money6(layer.averageCost),
        lastPurchaseCost: money2(layer.lastPurchaseCost),
        lastPurchaseDate: product.lastPurchaseDate,
        inventoryValue: money2(layer.inventoryValue || mulMoney(layer.stock, layer.averageCost)),
        sellingPrice: Number(product.sellingPrice || 0)
      });
    }
  }
  return rows;
};
