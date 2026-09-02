import { Request } from 'express';
import mongoose from 'mongoose';

export const UNIT_HEADER = 'x-business-unit-id';

export const unitScope = (req: Request) => {
  const raw = String(req.query.businessUnitId || req.headers[UNIT_HEADER] || '').trim();
  if (!raw || raw === 'all' || !mongoose.Types.ObjectId.isValid(raw)) {
    return {};
  }
  return { businessUnitId: new mongoose.Types.ObjectId(raw) };
};

export const mergeFilters = (...parts: Array<Record<string, unknown>>) => {
  const nonempty = parts.filter((part) => part && Object.keys(part).length > 0);
  if (nonempty.length === 0) {
    return {};
  }
  if (nonempty.length === 1) {
    return nonempty[0];
  }
  return { $and: nonempty };
};

export const resolveBusinessUnitId = (req: Request, body?: Record<string, unknown>) => {
  const fromBody = String(body?.businessUnitId || '').trim();
  const fromReq = String(req.query.businessUnitId || req.headers[UNIT_HEADER] || '').trim();
  const value = fromBody || fromReq;
  if (!value || value === 'all' || !mongoose.Types.ObjectId.isValid(value)) {
    return undefined;
  }
  return new mongoose.Types.ObjectId(value);
};
