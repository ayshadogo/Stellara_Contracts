import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { AuditLog } from '../audit/audit.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { InsurancePolicyHistory } from '../insurance/entities/insurance-policy-history.entity';
import { ArchivedRecord } from './entities/archived-record.entity';
import { ArchiveRun } from './entities/archive-run.entity';

export interface ArchivalRule {
  entityType: 'audit_logs' | 'notifications' | 'policy_history';
  sourceTable: string;
  retentionDays: number;
  batchSize: number;
  deleteFromPrimary: boolean;
}

interface RunSummary {
  processed: number;
  archived: number;
  deletedFromPrimary: number;
}

@Injectable()
export class DataArchivalService {
  private readonly logger = new Logger(DataArchivalService.name);

  private readonly rules: ArchivalRule[] = [
    {
      entityType: 'audit_logs',
      sourceTable: 'audit_logs',
      retentionDays: 180,
      batchSize: 250,
      deleteFromPrimary: true,
    },
    {
      entityType: 'notifications',
      sourceTable: 'notifications',
      retentionDays: 90,
      batchSize: 250,
      deleteFromPrimary: true,
    },
    {
      entityType: 'policy_history',
      sourceTable: 'insurance_policy_history',
      retentionDays: 365,
      batchSize: 250,
      deleteFromPrimary: true,
    },
  ];

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(InsurancePolicyHistory)
    private readonly policyHistoryRepository: Repository<InsurancePolicyHistory>,
    @InjectRepository(ArchivedRecord)
    private readonly archivedRecordRepository: Repository<ArchivedRecord>,
    @InjectRepository(ArchiveRun)
    private readonly archiveRunRepository: Repository<ArchiveRun>,
  ) {}

  @Cron('0 2 * * *')
  async runScheduledArchival(): Promise<ArchiveRun[]> {
    return this.runArchivalJob();
  }

  async runArchivalJob(entityType?: ArchivalRule['entityType']): Promise<ArchiveRun[]> {
    const rules = entityType
      ? this.rules.filter((rule) => rule.entityType === entityType)
      : this.rules;

    const runs: ArchiveRun[] = [];

    for (const rule of rules) {
      const run = this.archiveRunRepository.create({
        entityType: rule.entityType,
        status: 'completed',
        processed: 0,
        archived: 0,
        deletedFromPrimary: 0,
      });

      try {
        const summary = await this.applyRule(rule);
        run.processed = summary.processed;
        run.archived = summary.archived;
        run.deletedFromPrimary = summary.deletedFromPrimary;
        run.details = {
          retentionDays: rule.retentionDays,
          batchSize: rule.batchSize,
        };
      } catch (error) {
        run.status = 'failed';
        run.errorMessage = error instanceof Error ? error.message : String(error);
      }

      runs.push(await this.archiveRunRepository.save(run));
    }

    return runs;
  }

  async getArchivalRules(): Promise<ArchivalRule[]> {
    return [...this.rules];
  }

  async getArchiveMetrics() {
    const [records, runs] = await Promise.all([
      this.archivedRecordRepository.find(),
      this.archiveRunRepository.find({
        order: { createdAt: 'DESC' },
        take: 10,
      }),
    ]);

    const byEntity = records.reduce<Record<string, number>>((acc, record) => {
      acc[record.entityType] = (acc[record.entityType] ?? 0) + 1;
      return acc;
    }, {});

    return {
      totalArchivedRecords: records.length,
      byEntity,
      recentRuns: runs,
    };
  }

  async listArchivedRecords(entityType?: string, sourceEntityId?: string): Promise<ArchivedRecord[]> {
    const query = this.archivedRecordRepository
      .createQueryBuilder('archive')
      .orderBy('archive.archivedAt', 'DESC');

    if (entityType) {
      query.andWhere('archive.entityType = :entityType', { entityType });
    }

    if (sourceEntityId) {
      query.andWhere('archive.sourceEntityId = :sourceEntityId', {
        sourceEntityId,
      });
    }

    return query.getMany();
  }

  async getArchivedRecord(id: string): Promise<ArchivedRecord | null> {
    return this.archivedRecordRepository.findOne({ where: { id } });
  }

  private async applyRule(rule: ArchivalRule): Promise<RunSummary> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - rule.retentionDays);

    switch (rule.entityType) {
      case 'audit_logs':
        return this.archiveAuditLogs(rule, cutoff);
      case 'notifications':
        return this.archiveNotifications(rule, cutoff);
      case 'policy_history':
        return this.archivePolicyHistory(rule, cutoff);
      default:
        return {
          processed: 0,
          archived: 0,
          deletedFromPrimary: 0,
        };
    }
  }

  private async archiveAuditLogs(rule: ArchivalRule, cutoff: Date): Promise<RunSummary> {
    const records = await this.auditLogRepository.find({
      where: {
        timestamp: LessThan(cutoff),
      },
      order: { timestamp: 'ASC' },
      take: rule.batchSize,
    });

    if (records.length === 0) {
      return { processed: 0, archived: 0, deletedFromPrimary: 0 };
    }

    await this.persistArchiveBatch(
      records.map((record) =>
        this.archivedRecordRepository.create({
          entityType: rule.entityType,
          sourceTable: rule.sourceTable,
          sourceEntityId: record.id,
          payload: record as unknown as Record<string, any>,
          sourceCreatedAt: record.timestamp,
        }),
      ),
    );

    let deletedFromPrimary = 0;
    if (rule.deleteFromPrimary) {
      const result = await this.auditLogRepository.delete(records.map((record) => record.id));
      deletedFromPrimary = result.affected ?? 0;
    }

    return {
      processed: records.length,
      archived: records.length,
      deletedFromPrimary,
    };
  }

  private async archiveNotifications(rule: ArchivalRule, cutoff: Date): Promise<RunSummary> {
    const records = await this.notificationRepository.find({
      where: {
        createdAt: LessThan(cutoff),
        isRead: true,
      },
      order: { createdAt: 'ASC' },
      take: rule.batchSize,
    });

    if (records.length === 0) {
      return { processed: 0, archived: 0, deletedFromPrimary: 0 };
    }

    await this.persistArchiveBatch(
      records.map((record) =>
        this.archivedRecordRepository.create({
          entityType: rule.entityType,
          sourceTable: rule.sourceTable,
          sourceEntityId: record.id,
          payload: record as unknown as Record<string, any>,
          sourceCreatedAt: record.createdAt,
          metadata: {
            userId: record.userId,
            status: record.status,
          },
        }),
      ),
    );

    let deletedFromPrimary = 0;
    if (rule.deleteFromPrimary) {
      const result = await this.notificationRepository.delete(records.map((record) => record.id));
      deletedFromPrimary = result.affected ?? 0;
    }

    return {
      processed: records.length,
      archived: records.length,
      deletedFromPrimary,
    };
  }

  private async archivePolicyHistory(rule: ArchivalRule, cutoff: Date): Promise<RunSummary> {
    const records = await this.policyHistoryRepository.find({
      where: {
        createdAt: LessThan(cutoff),
      },
      order: { createdAt: 'ASC' },
      take: rule.batchSize,
    });

    if (records.length === 0) {
      return { processed: 0, archived: 0, deletedFromPrimary: 0 };
    }

    await this.persistArchiveBatch(
      records.map((record) =>
        this.archivedRecordRepository.create({
          entityType: rule.entityType,
          sourceTable: rule.sourceTable,
          sourceEntityId: record.id,
          payload: record as unknown as Record<string, any>,
          sourceCreatedAt: record.createdAt,
          metadata: {
            policyId: record.policyId,
            action: record.action,
          },
        }),
      ),
    );

    let deletedFromPrimary = 0;
    if (rule.deleteFromPrimary) {
      const result = await this.policyHistoryRepository.delete(records.map((record) => record.id));
      deletedFromPrimary = result.affected ?? 0;
    }

    return {
      processed: records.length,
      archived: records.length,
      deletedFromPrimary,
    };
  }

  private async persistArchiveBatch(records: ArchivedRecord[]): Promise<void> {
    if (records.length === 0) {
      return;
    }

    await this.archivedRecordRepository.save(records);
    this.logger.log(`Archived ${records.length} record(s) into cold storage table`);
  }
}
