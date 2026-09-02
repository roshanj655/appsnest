import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

export const errorHandler = (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof ZodError) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }))
    });
  }

  const status = typeof error === 'object' && error && 'status' in error ? Number((error as { status?: number }).status) : 500;
  const message =
    error instanceof Error ? error.message : 'Internal server error';

  if (status >= 500) {
    console.error(error);
  }

  res.status(status || 500).json({ message: status >= 500 ? 'Internal server error' : message });
};
