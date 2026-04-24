import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);

  constructor(private readonly prisma: PrismaService) {}

  async get(key: string) {
    return this.prisma.idempotencyKey.findUnique({ where: { key } });
  }

  async set(key: string, statusCode: number, response: object, ttlMs = DEFAULT_TTL_MS) {
    const expiresAt = new Date(Date.now() + ttlMs);
    return this.prisma.idempotencyKey.upsert({
      where: { key },
      create: { key, statusCode, response, expiresAt },
      update: { statusCode, response, expiresAt },
    });
  }

  async isExpired(key: string): Promise<boolean> {
    const entry = await this.get(key);
    if (!entry) return true;
    return entry.expiresAt < new Date();
  }

  /** Remove expired idempotency keys daily */
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async cleanup() {
    const { count } = await this.prisma.idempotencyKey.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    if (count > 0) this.logger.log(`Idempotency cleanup: removed ${count} expired keys`);
  }
}
