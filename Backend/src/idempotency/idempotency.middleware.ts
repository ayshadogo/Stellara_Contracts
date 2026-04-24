import { Injectable, NestMiddleware, BadRequestException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { IdempotencyService } from './idempotency.service';

const IDEMPOTENCY_HEADER = 'idempotency-key';
const KEY_MAX_LENGTH = 255;

@Injectable()
export class IdempotencyMiddleware implements NestMiddleware {
  constructor(private readonly idempotency: IdempotencyService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // Only apply to mutating methods
    if (!['POST', 'PUT', 'PATCH'].includes(req.method)) return next();

    const key = req.headers[IDEMPOTENCY_HEADER] as string | undefined;
    if (!key) return next();

    if (key.length > KEY_MAX_LENGTH) {
      throw new BadRequestException(`Idempotency-Key must be ≤ ${KEY_MAX_LENGTH} characters`);
    }

    const existing = await this.idempotency.get(key);
    if (existing && existing.expiresAt > new Date()) {
      res.status(existing.statusCode).json(existing.response);
      return;
    }

    // Capture response to store
    const originalJson = res.json.bind(res);
    res.json = (body: any) => {
      this.idempotency
        .set(key, res.statusCode, body)
        .catch(() => {/* non-blocking */});
      return originalJson(body);
    };

    next();
  }
}
