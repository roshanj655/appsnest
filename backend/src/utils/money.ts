const SCALE = 10000;

export const toMinor = (value: number) => Math.round(Number(value || 0) * SCALE);

export const fromMinor = (minor: number) => Number(minor || 0) / SCALE;

export const roundMoney = (value: number, places = 2) => {
  const factor = 10 ** places;
  return Math.round((Number(value || 0) + Number.EPSILON) * factor) / factor;
};

export const money2 = (value: number) => roundMoney(value, 2);

export const money4 = (value: number) => roundMoney(value, 4);

export const money6 = (value: number) => roundMoney(value, 6);

export const mulMoney = (quantity: number, unitCost: number) =>
  fromMinor(Math.round(Number(quantity || 0) * toMinor(unitCost)));

export type CostLayer = {
  quantity: number;
  averageCost: number;
  inventoryValue: number;
};

export const layerValue = (quantity: number, averageCost: number) =>
  mulMoney(quantity, averageCost);

export const inboundAverage = (
  existingQty: number,
  existingAvg: number,
  inboundQty: number,
  inboundUnitCost: number
): CostLayer => {
  const qtyIn = Number(inboundQty || 0);
  const qtyNow = Number(existingQty || 0);
  const existingValue = layerValue(qtyNow, existingAvg);
  const inboundValue = mulMoney(qtyIn, inboundUnitCost);
  const newQty = qtyNow + qtyIn;
  if (newQty <= 0) {
    return { quantity: 0, averageCost: 0, inventoryValue: 0 };
  }
  const inventoryValue = existingValue + inboundValue;
  return {
    quantity: newQty,
    averageCost: money6(inventoryValue / newQty),
    inventoryValue: money2(inventoryValue)
  };
};

export const outboundAverage = (
  existingQty: number,
  existingAvg: number,
  outboundQty: number
): CostLayer => {
  const qtyOut = Number(outboundQty || 0);
  const qtyNow = Number(existingQty || 0);
  const newQty = qtyNow - qtyOut;
  if (newQty < 0) {
    throw Object.assign(new Error('Insufficient stock for this movement.'), { status: 400 });
  }
  if (newQty === 0) {
    return { quantity: 0, averageCost: 0, inventoryValue: 0 };
  }
  return {
    quantity: newQty,
    averageCost: money6(existingAvg),
    inventoryValue: money2(layerValue(newQty, existingAvg))
  };
};

export const outboundSpecific = (
  existingQty: number,
  existingAvg: number,
  outboundQty: number,
  unitCost: number
): CostLayer => {
  const qtyOut = Number(outboundQty || 0);
  const qtyNow = Number(existingQty || 0);
  const newQty = qtyNow - qtyOut;
  if (newQty < 0) {
    throw Object.assign(new Error('Insufficient stock for this movement.'), { status: 400 });
  }
  if (newQty === 0) {
    return { quantity: 0, averageCost: 0, inventoryValue: 0 };
  }
  const nextValue = Math.max(0, layerValue(qtyNow, existingAvg) - mulMoney(qtyOut, unitCost));
  return {
    quantity: newQty,
    averageCost: money6(nextValue / newQty),
    inventoryValue: money2(nextValue)
  };
};
