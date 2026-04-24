import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { DlqStatus } from '@prisma/client';

@Injectable()
export class DeadLetterQueueService {
  private readonly logger = new Logger(DeadLetterQueueService.name);

  constructor(private readonly prisma: PrismaService) {}

  async enqueue(eventType: string, payload: object, error: string, source: string) {
    return this.prisma.deadLetterQueue.create({
      data: { eventType, payload, lastError: error, source },
    });
  }

  async moveFailedEvent(eventId: string, eventType: string, payload: object, error: string, source: string) {
    this.logger.warn(`Moving failed event [${eventType}] from ${source} to DLQ`);
    return this.enqueue(eventType, payload, error, source);
  }

  async replay(id: string, handler: (payload: object) => Promise<void>) {
    const entry = await this.prisma.deadLetterQueue.findUniqueOrThrow({ where: { id } });
    try {
      await handler(entry.payload as object);
      await this.prisma.deadLetterQueue.update({
        where: { id },
        data: { status: DlqStatus.RESOLVED, resolvedAt: new Date() },
      });
      this.logger.log(`DLQ entry [${id}] replayed successfully`);
    } catch (err) {
      await this.prisma.deadLetterQueue.update({
        where: { id },
        data: {
          attempts: { increment: 1 },
          lastError: (err as Error).message,
          status: DlqStatus.FAILED,
        },
      });
      throw err;
    }
  }

  async getStats() {
    const [total, pending, failed, resolved] = await Promise.all([
      this.prisma.deadLetterQueue.count(),
      this.prisma.deadLetterQueue.count({ where: { status: DlqStatus.PENDING } }),
      this.prisma.deadLetterQueue.count({ where: { status: DlqStatus.FAILED } }),
      this.prisma.deadLetterQueue.count({ where: { status: DlqStatus.RESOLVED } }),
    ]);
    return { total, pending, failed, resolved };
  }

  async list(status?: DlqStatus, limit = 50) {
    return this.prisma.deadLetterQueue.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /** Cleanup resolved entries older than 7 days */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanup() {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const { count } = await this.prisma.deadLetterQueue.deleteMany({
      where: { status: DlqStatus.RESOLVED, resolvedAt: { lt: cutoff } },
    });
    if (count > 0) this.logger.log(`DLQ cleanup: removed ${count} resolved entries`);
  }
}
