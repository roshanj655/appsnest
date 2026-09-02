import { NextFunction, Request, Response } from 'express';
import { ZodError, ZodType } from 'zod';

export const validate =
  (schema: ZodType, source: 'body' | 'query' = 'body') =>
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = schema.safeParse(source === 'query' ? req.query : req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: 'Validation failed',
          errors: parsed.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message
          }))
        });
      }
      if (source === 'body') {
        req.body = parsed.data;
      }
      next();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Validation failed';
      return res.status(400).json({ message: 'Validation failed', errors: message });
    }
  };

export const isZodError = (error: unknown): error is ZodError => error instanceof ZodError;
