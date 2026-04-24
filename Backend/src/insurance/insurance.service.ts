import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, LessThan, Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { AuditService } from '../audit/audit.service';
import { NotificationService } from '../notifications/services/notification.service';
import { NotificationChannel, NotificationPriority, NotificationType } from '../notifications/types/notification.types';
import { CreatePolicyDto } from './dto/create-policy.dto';
import { UpdatePolicyDto } from './dto/update-policy.dto';
import { RenewPolicyDto } from './dto/renew-policy.dto';
import { CancelPolicyDto } from './dto/cancel-policy.dto';
import { InsurancePolicy } from './entities/insurance-policy.entity';
import { InsurancePolicyHistory } from './entities/insurance-policy-history.entity';
import { PolicyStatus } from './enums/policy-status.enum';
import { PolicyHistoryAction } from './enums/policy-history-action.enum';

interface PolicyFilters {
  holderId?: string;
  status?: PolicyStatus;
}

@Injectable()
export class InsuranceService {
  private readonly logger = new Logger(InsuranceService.name);

  constructor(
    @InjectRepository(InsurancePolicy)
    private readonly policyRepository: Repository<InsurancePolicy>,
    @InjectRepository(InsurancePolicyHistory)
    private readonly historyRepository: Repository<InsurancePolicyHistory>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly notificationService: NotificationService,
    private readonly auditService: AuditService,
  ) {}

  async createPolicy(createDto: CreatePolicyDto): Promise<InsurancePolicy> {
    const holder = await this.userRepository.findOne({
      where: { id: createDto.holderId },
    });

    if (!holder) {
      throw new NotFoundException(`Policy holder ${createDto.holderId} not found`);
    }

    const effectiveDate = new Date(createDto.effectiveDate);
    const expirationDate = new Date(createDto.expirationDate);
    this.assertDateRange(effectiveDate, expirationDate);

    const policy = this.policyRepository.create({
      ...createDto,
      policyNumber: createDto.policyNumber ?? this.generatePolicyNumber(createDto.productName),
      effectiveDate,
      expirationDate,
      status: PolicyStatus.ACTIVE,
    });

    const savedPolicy = await this.policyRepository.save(policy);

    await this.recordHistory(savedPolicy, {
      action: PolicyHistoryAction.ISSUED,
      actorId: createDto.modifiedBy ?? createDto.holderId,
      nextState: this.snapshotPolicy(savedPolicy),
      changes: {
        lifecycle: 'issued',
      },
    });

    await this.auditService.logAction(
      'INSURANCE_POLICY_ISSUED',
      createDto.modifiedBy ?? createDto.holderId,
      savedPolicy.id,
      {
        policyNumber: savedPolicy.policyNumber,
        holderId: savedPolicy.holderId,
      },
    );

    return this.getPolicy(savedPolicy.id);
  }

  async listPolicies(filters: PolicyFilters = {}): Promise<InsurancePolicy[]> {
    const query = this.policyRepository
      .createQueryBuilder('policy')
      .leftJoinAndSelect('policy.holder', 'holder')
      .orderBy('policy.createdAt', 'DESC');

    if (filters.holderId) {
      query.andWhere('policy.holderId = :holderId', { holderId: filters.holderId });
    }

    if (filters.status) {
      query.andWhere('policy.status = :status', { status: filters.status });
    }

    return query.getMany();
  }

  async getPolicy(policyId: string): Promise<InsurancePolicy> {
    const policy = await this.policyRepository.findOne({
      where: { id: policyId },
      relations: ['holder', 'previousPolicy'],
    });

    if (!policy) {
      throw new NotFoundException(`Policy ${policyId} not found`);
    }

    return policy;
  }

  async getPolicyHistory(policyId: string): Promise<InsurancePolicyHistory[]> {
    await this.getPolicy(policyId);
    return this.historyRepository.find({
      where: { policyId },
      order: { createdAt: 'DESC' },
    });
  }

  async modifyPolicy(policyId: string, updateDto: UpdatePolicyDto): Promise<InsurancePolicy> {
    const policy = await this.getPolicy(policyId);
    this.ensureMutable(policy);

    const before = this.snapshotPolicy(policy);
    const nextState = {
      ...before,
      ...this.normalizePolicyUpdates(updateDto),
      metadata: updateDto.metadata ?? policy.metadata ?? null,
      version: policy.version + 1,
      modifiedBy: updateDto.modifiedBy ?? policy.modifiedBy ?? null,
    };

    Object.assign(policy, nextState);
    const savedPolicy = await this.policyRepository.save(policy);

    await this.recordHistory(savedPolicy, {
      action: PolicyHistoryAction.MODIFIED,
      actorId: updateDto.modifiedBy ?? policy.holderId,
      reason: updateDto.reason ?? 'policy modified',
      previousState: before,
      nextState: this.snapshotPolicy(savedPolicy),
      changes: this.diffSnapshots(before, this.snapshotPolicy(savedPolicy)),
    });

    await this.auditService.logAction(
      'INSURANCE_POLICY_MODIFIED',
      updateDto.modifiedBy ?? policy.holderId,
      savedPolicy.id,
      {
        reason: updateDto.reason ?? null,
      },
    );

    return this.getPolicy(savedPolicy.id);
  }

  async cancelPolicy(policyId: string, cancelDto: CancelPolicyDto): Promise<InsurancePolicy> {
    const policy = await this.getPolicy(policyId);

    if (policy.status === PolicyStatus.CANCELLED) {
      throw new BadRequestException('Policy is already cancelled');
    }

    const before = this.snapshotPolicy(policy);
    policy.status = PolicyStatus.CANCELLED;
    policy.cancelledAt = new Date();
    policy.cancellationReason = cancelDto.reason;
    policy.modifiedBy = cancelDto.modifiedBy ?? policy.holderId;
    policy.version += 1;

    const savedPolicy = await this.policyRepository.save(policy);

    await this.recordHistory(savedPolicy, {
      action: PolicyHistoryAction.CANCELLED,
      actorId: cancelDto.modifiedBy ?? policy.holderId,
      reason: cancelDto.reason,
      previousState: before,
      nextState: this.snapshotPolicy(savedPolicy),
      changes: {
        status: {
          before: before.status,
          after: savedPolicy.status,
        },
        cancellationReason: cancelDto.reason,
      },
    });

    await this.auditService.logAction(
      'INSURANCE_POLICY_CANCELLED',
      cancelDto.modifiedBy ?? policy.holderId,
      savedPolicy.id,
      {
        reason: cancelDto.reason,
      },
    );

    return this.getPolicy(savedPolicy.id);
  }

  async renewPolicy(policyId: string, renewDto: RenewPolicyDto): Promise<InsurancePolicy> {
    const currentPolicy = await this.getPolicy(policyId);

    if (currentPolicy.status === PolicyStatus.CANCELLED) {
      throw new BadRequestException('Cancelled policies cannot be renewed');
    }

    const nextEffectiveDate = renewDto.effectiveDate
      ? new Date(renewDto.effectiveDate)
      : new Date(currentPolicy.expirationDate.getTime() + 1000);
    const nextExpirationDate = renewDto.expirationDate
      ? new Date(renewDto.expirationDate)
      : this.addOneYear(nextEffectiveDate);

    this.assertDateRange(nextEffectiveDate, nextExpirationDate);

    const previousSnapshot = this.snapshotPolicy(currentPolicy);
    currentPolicy.status = PolicyStatus.RENEWED;
    currentPolicy.modifiedBy = renewDto.modifiedBy ?? currentPolicy.holderId;
    currentPolicy.version += 1;
    await this.policyRepository.save(currentPolicy);

    await this.recordHistory(currentPolicy, {
      action: PolicyHistoryAction.RENEWED,
      actorId: renewDto.modifiedBy ?? currentPolicy.holderId,
      previousState: previousSnapshot,
      nextState: this.snapshotPolicy(currentPolicy),
      changes: {
        status: {
          before: previousSnapshot.status,
          after: PolicyStatus.RENEWED,
        },
      },
    });

    const renewedPolicy = this.policyRepository.create({
      holderId: currentPolicy.holderId,
      productName: currentPolicy.productName,
      coverageType: currentPolicy.coverageType,
      coverageAmount: currentPolicy.coverageAmount,
      premiumAmount: renewDto.premiumAmount ?? currentPolicy.premiumAmount,
      effectiveDate: nextEffectiveDate,
      expirationDate: nextExpirationDate,
      status: PolicyStatus.ACTIVE,
      previousPolicyId: currentPolicy.id,
      modifiedBy: renewDto.modifiedBy ?? currentPolicy.holderId,
      metadata: {
        ...(currentPolicy.metadata ?? {}),
        ...(renewDto.metadata ?? {}),
        renewalOf: currentPolicy.policyNumber,
      },
      policyNumber: this.generateRenewalPolicyNumber(currentPolicy.policyNumber),
    });

    const savedRenewal = await this.policyRepository.save(renewedPolicy);

    await this.recordHistory(savedRenewal, {
      action: PolicyHistoryAction.ISSUED,
      actorId: renewDto.modifiedBy ?? currentPolicy.holderId,
      nextState: this.snapshotPolicy(savedRenewal),
      changes: {
        lifecycle: 'renewal-issued',
        previousPolicyId: currentPolicy.id,
      },
    });

    await this.auditService.logAction(
      'INSURANCE_POLICY_RENEWED',
      renewDto.modifiedBy ?? currentPolicy.holderId,
      savedRenewal.id,
      {
        renewedFrom: currentPolicy.id,
      },
    );

    return this.getPolicy(savedRenewal.id);
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async expirePolicies(): Promise<number> {
    const expiredPolicies = await this.policyRepository.find({
      where: {
        status: PolicyStatus.ACTIVE,
        expirationDate: LessThan(new Date()),
      },
    });

    for (const policy of expiredPolicies) {
      const before = this.snapshotPolicy(policy);
      policy.status = PolicyStatus.EXPIRED;
      policy.version += 1;
      await this.policyRepository.save(policy);

      await this.recordHistory(policy, {
        action: PolicyHistoryAction.EXPIRED,
        actorId: 'system',
        reason: 'policy auto-expired',
        previousState: before,
        nextState: this.snapshotPolicy(policy),
        changes: {
          status: {
            before: before.status,
            after: PolicyStatus.EXPIRED,
          },
        },
      });
    }

    if (expiredPolicies.length > 0) {
      await this.auditService.logAction(
        'INSURANCE_POLICY_EXPIRATION_SWEEP',
        'system',
        'insurance-expiration-job',
        {
          expiredPolicies: expiredPolicies.length,
        },
      );
    }

    return expiredPolicies.length;
  }

  @Cron('0 8 * * *')
  async sendRenewalNotifications(): Promise<number> {
    const policies = await this.findPoliciesNeedingRenewalNotification();

    for (const policy of policies) {
      await this.notificationService.createNotification({
        type: NotificationType.ALERT,
        priority: NotificationPriority.HIGH,
        channels: [NotificationChannel.IN_APP],
        userId: policy.holderId,
        title: 'Policy renewal due soon',
        content: `Policy ${policy.policyNumber} expires on ${policy.expirationDate.toISOString()}.`,
        relatedEntityId: policy.id,
        relatedEntityType: 'insurance_policy',
        data: {
          policyNumber: policy.policyNumber,
          expirationDate: policy.expirationDate,
        },
        sendImmediately: false,
      });

      policy.lastRenewalNotificationAt = new Date();
      await this.policyRepository.save(policy);

      await this.recordHistory(policy, {
        action: PolicyHistoryAction.RENEWAL_NOTIFIED,
        actorId: 'system',
        reason: 'renewal reminder sent',
        changes: {
          reminderWindowDays: 30,
        },
      });
    }

    if (policies.length > 0) {
      await this.auditService.logAction(
        'INSURANCE_POLICY_RENEWAL_NOTIFICATIONS_SENT',
        'system',
        'insurance-renewal-job',
        {
          notifications: policies.length,
        },
      );
    }

    return policies.length;
  }

  async getExpiringPolicies(lookaheadDays = 30): Promise<InsurancePolicy[]> {
    const start = new Date();
    const end = new Date();
    end.setDate(end.getDate() + lookaheadDays);

    return this.policyRepository.find({
      where: {
        status: PolicyStatus.ACTIVE,
        expirationDate: Between(start, end),
      },
      relations: ['holder'],
      order: {
        expirationDate: 'ASC',
      },
    });
  }

  private async findPoliciesNeedingRenewalNotification(): Promise<InsurancePolicy[]> {
    const policies = await this.getExpiringPolicies(30);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return policies.filter((policy) => {
      if (!policy.lastRenewalNotificationAt) {
        return true;
      }

      const lastNotification = new Date(policy.lastRenewalNotificationAt);
      lastNotification.setHours(0, 0, 0, 0);
      return lastNotification.getTime() < today.getTime();
    });
  }

  private async recordHistory(
    policy: InsurancePolicy,
    entry: Omit<InsurancePolicyHistory, 'id' | 'policy' | 'policyId' | 'createdAt'>,
  ): Promise<InsurancePolicyHistory> {
    const history = this.historyRepository.create({
      ...entry,
      policyId: policy.id,
    });

    return this.historyRepository.save(history);
  }

  private ensureMutable(policy: InsurancePolicy): void {
    if (policy.status === PolicyStatus.CANCELLED) {
      throw new BadRequestException('Cancelled policies cannot be modified');
    }
  }

  private normalizePolicyUpdates(updateDto: UpdatePolicyDto): Partial<InsurancePolicy> {
    const normalized: Partial<InsurancePolicy> = {};

    if (updateDto.productName !== undefined) normalized.productName = updateDto.productName;
    if (updateDto.coverageType !== undefined) normalized.coverageType = updateDto.coverageType;
    if (updateDto.coverageAmount !== undefined) normalized.coverageAmount = updateDto.coverageAmount;
    if (updateDto.premiumAmount !== undefined) normalized.premiumAmount = updateDto.premiumAmount;
    if (updateDto.effectiveDate !== undefined) normalized.effectiveDate = new Date(updateDto.effectiveDate);
    if (updateDto.expirationDate !== undefined) normalized.expirationDate = new Date(updateDto.expirationDate);
    if (updateDto.modifiedBy !== undefined) normalized.modifiedBy = updateDto.modifiedBy;

    if (normalized.effectiveDate || normalized.expirationDate) {
      const effectiveDate = normalized.effectiveDate ?? undefined;
      const expirationDate = normalized.expirationDate ?? undefined;
      if (effectiveDate && expirationDate) {
        this.assertDateRange(effectiveDate, expirationDate);
      }
    }

    return normalized;
  }

  private snapshotPolicy(policy: InsurancePolicy): Record<string, any> {
    return {
      id: policy.id,
      policyNumber: policy.policyNumber,
      holderId: policy.holderId,
      productName: policy.productName,
      coverageType: policy.coverageType,
      coverageAmount: policy.coverageAmount,
      premiumAmount: policy.premiumAmount,
      effectiveDate: policy.effectiveDate,
      expirationDate: policy.expirationDate,
      status: policy.status,
      metadata: policy.metadata ?? null,
      version: policy.version,
      previousPolicyId: policy.previousPolicyId ?? null,
    };
  }

  private diffSnapshots(
    before: Record<string, any>,
    after: Record<string, any>,
  ): Record<string, any> {
    const changes: Record<string, any> = {};

    for (const key of Object.keys(after)) {
      if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
        changes[key] = {
          before: before[key] ?? null,
          after: after[key] ?? null,
        };
      }
    }

    return changes;
  }

  private assertDateRange(effectiveDate: Date, expirationDate: Date): void {
    if (Number.isNaN(effectiveDate.getTime()) || Number.isNaN(expirationDate.getTime())) {
      throw new BadRequestException('Policy dates must be valid ISO timestamps');
    }

    if (expirationDate <= effectiveDate) {
      throw new BadRequestException('Expiration date must be later than effective date');
    }
  }

  private addOneYear(date: Date): Date {
    const result = new Date(date);
    result.setFullYear(result.getFullYear() + 1);
    return result;
  }

  private generatePolicyNumber(seed: string): string {
    const prefix = seed.replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase() || 'PLCY';
    const random = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `${prefix}-${Date.now()}-${random}`;
  }

  private generateRenewalPolicyNumber(previousPolicyNumber: string): string {
    const match = previousPolicyNumber.match(/-R(\d+)$/);
    if (!match) {
      return `${previousPolicyNumber}-R1`;
    }

    const version = Number(match[1]) + 1;
    return previousPolicyNumber.replace(/-R\d+$/, `-R${version}`);
  }
}
