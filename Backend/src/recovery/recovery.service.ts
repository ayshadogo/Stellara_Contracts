import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { HealthService } from '../health/health.service';
import { PrismaService } from '../prisma.service';
import { ConfigService } from '@nestjs/config';
import * as net from 'net';

export interface RecoveryAction {
  timestamp: string;
  target: string;
  action: string;
  success: boolean;
  error?: string;
}

@Injectable()
export class RecoveryService implements OnModuleInit {
  private readonly logger = new Logger(RecoveryService.name);
  private readonly history: RecoveryAction[] = [];
  private readonly MAX_HISTORY = 100;

  constructor(
    private readonly health: HealthService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    this.logger.log('Automated recovery service initialized');
  }

  /** Runs every minute — checks health and auto-remediates */
  @Cron(CronExpression.EVERY_MINUTE)
  async runHealthCheckRemediation() {
    const report = await this.health.getReadinessReport();

    for (const [dep, status] of Object.entries(report.dependencies)) {
      if ((status as any).status === 'down') {
        await this.remediate(dep);
      }
    }
  }

  async remediate(target: string): Promise<RecoveryAction> {
    this.logger.warn(`Attempting recovery for: ${target}`);
    let success = false;
    let error: string | undefined;

    try {
      switch (target) {
        case 'database':
          await this.recoverDatabase();
          break;
        case 'redis':
          await this.recoverRedis();
          break;
        default:
          this.logger.log(`No automated recovery defined for: ${target}`);
      }
      success = true;
    } catch (err: any) {
      error = err?.message ?? String(err);
      this.logger.error(`Recovery failed for ${target}: ${error}`);
    }

    const action: RecoveryAction = {
      timestamp: new Date().toISOString(),
      target,
      action: `auto-remediate:${target}`,
      success,
      error,
    };

    this.history.unshift(action);
    if (this.history.length > this.MAX_HISTORY) this.history.pop();

    return action;
  }

  getHistory(): RecoveryAction[] {
    return this.history;
  }

  private async recoverDatabase(): Promise<void> {
    this.logger.log('Reconnecting to database...');
    await this.prisma.$disconnect();
    await this.prisma.$connect();
    this.logger.log('Database reconnection successful');
  }

  private async recoverRedis(): Promise<void> {
    const host = this.config.get('REDIS_HOST', 'localhost');
    const port = this.config.get<number>('REDIS_PORT', 6379);
    this.logger.log(`Probing Redis at ${host}:${port}...`);

    await new Promise<void>((resolve, reject) => {
      const socket = net.createConnection({ host, port }, () => {
        socket.destroy();
        resolve();
      });
      socket.on('error', reject);
      socket.setTimeout(3000, () => {
        socket.destroy();
        reject(new Error('Redis probe timed out'));
      });
    });

    this.logger.log('Redis is reachable — cache will rebuild on next access');
  }
}
