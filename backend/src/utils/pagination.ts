import { Request } from 'express';

export const parsePagination = (query: Request['query']) => {
  const page = Math.max(1, parseInt(String(query.page ?? ''), 10) || 1);
  const limit = Math.min(500, Math.max(1, parseInt(String(query.limit ?? ''), 10) || 50));
  const search = String(query.search ?? query.q ?? '').trim();
  return { page, limit, skip: (page - 1) * limit, search };
};

export const textSearch = (search: string, fields: string[]) => {
  if (!search) {
    return {};
  }
  return {
    $or: fields.map((field) => ({ [field]: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } }))
  };
};

export const paginatedResult = <T>(items: T[], total: number, page: number, limit: number) => ({
  items,
  total,
  page,
  limit,
  pages: Math.max(1, Math.ceil(total / limit) || 1)
});
