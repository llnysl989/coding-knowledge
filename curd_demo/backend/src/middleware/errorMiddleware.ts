import { Request, Response, NextFunction } from 'express';
import { fail } from '../utils/response';

export class AppError extends Error {
  code: number;
  status: number;

  constructor(code: number, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export function errorMiddleware(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof AppError) {
    res.status(err.status).json(fail(err.code, err.message));
    return;
  }

  console.error('[unhandled error]', err);
  res.status(500).json(fail(5000, 'internal server error'));
}
