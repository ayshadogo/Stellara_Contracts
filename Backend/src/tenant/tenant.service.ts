import {
  Injectable,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { NotificationService } from '../notification/services/notification.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantSettingsDto } from './dto/update-tenant-settings.dto';
import { TenantPlan, NotificationType } from '@prisma/client';

const PLAN_DEFAULTS: Record<TenantPlan, { maxUsers: number; maxProjects: number }> = {
  FREE:         { maxUsers: 10,  maxProjects: 5   },
  STARTER:      { maxUsers: 50,  maxProjects: 20  },
  PROFESSIONAL: { maxUsers: 200, maxProjects: 100 },
  ENTERPRISE:   { maxUsers: 500, maxProjects: 500 },
};

@Injectable()
export class TenantService {
  private readonly logger = new Logger(TenantService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  async provision(dto: CreateTenantDto, actorId?: string) {
    const slug = this.toSlug(dto.name);
    const plan = dto.plan ?? TenantPlan.FREE;
    const planDefaults = PLAN_DEFAULTS[plan];

    // Uniqueness guard
    const existing = await this.prisma.tenant.findFirst({
      where: { OR: [{ name: dto.name }, { slug }] },
    });
    if (existing) {
      throw new ConflictException(
        `A tenant with name "${dto.name}" already exists`,
      );
    }

    const existingAdmin = await this.prisma.user.findUnique({
      where: { walletAddress: dto.adminWalletAddress },
    });
    if (existingAdmin) {
      throw new ConflictException(
        `Wallet address "${dto.adminWalletAddress}" is already registered`,
      );
    }

    // Atomic provisioning inside a transaction
    const { tenant, adminUser } = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: dto.name,
          slug,
          plan,
          status: 'ACTIVE',
        },
      });

      await tx.tenantSettings.create({
        data: {
          tenantId: tenant.id,
          maxUsers:            dto.settings?.maxUsers            ?? planDefaults.maxUsers,
          maxProjects:         dto.settings?.maxProjects         ?? planDefaults.maxProjects,
          allowPublicProjects: dto.settings?.allowPublicProjects ?? true,
          notificationsEnabled: dto.settings?.notificationsEnabled ?? true,
        },
      });

      const adminUser = await tx.user.create({
        data: {
          walletAddress: dto.adminWalletAddress,
          email:         dto.adminEmail,
          roles:         ['TENANT_ADMIN'],
          tenantId:      tenant.id,
        },
      });

      await tx.tenantAuditLog.create({
        data: {
          tenantId: tenant.id,
          action:   'TENANT_PROVISIONED',
          actorId:  actorId ?? null,
          metadata: {
            plan,
            adminWalletAddress: dto.adminWalletAddress,
            slug,
          },
        },
      });

      return { tenant, adminUser };
    });

    // Dispatch welcome notification — non-blocking
    if (dto.adminEmail) {
      this.dispatchWelcomeNotification(adminUser.id, dto.name).catch((err) =>
        this.logger.error(`Welcome notification failed for tenant ${tenant.id}: ${err.message}`),
      );
    }

    this.logger.log(`Tenant provisioned: ${tenant.id} (${tenant.slug})`);

    return {
      tenant: {
        id:        tenant.id,
        name:      tenant.name,
        slug:      tenant.slug,
        plan:      tenant.plan,
        status:    tenant.status,
        createdAt: tenant.createdAt,
      },
      adminUser: {
        id:            adminUser.id,
        walletAddress: adminUser.walletAddress,
        roles:         adminUser.roles,
      },
    };
  }

  async findAll() {
    return this.prisma.tenant.findMany({
      where: { status: { not: 'DELETED' } },
      include: { settings: true, _count: { select: { users: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: { settings: true, _count: { select: { users: true, auditLogs: true } } },
    });
    if (!tenant) throw new NotFoundException(`Tenant ${id} not found`);
    return tenant;
  }

  async getSettings(tenantId: string) {
    const settings = await this.prisma.tenantSettings.findUnique({
      where: { tenantId },
    });
    if (!settings) throw new NotFoundException(`Settings for tenant ${tenantId} not found`);
    return settings;
  }

  async updateSettings(tenantId: string, dto: UpdateTenantSettingsDto, actorId?: string) {
    await this.findOne(tenantId);

    const updated = await this.prisma.tenantSettings.update({
      where: { tenantId },
      data: dto,
    });

    await this.prisma.tenantAuditLog.create({
      data: {
        tenantId,
        action:  'SETTINGS_UPDATED',
        actorId: actorId ?? null,
        metadata: dto as object,
      },
    });

    return updated;
  }

  async getAuditLogs(tenantId: string) {
    await this.findOne(tenantId);
    return this.prisma.tenantAuditLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  private toSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private async dispatchWelcomeNotification(userId: string, tenantName: string) {
    await this.notificationService.notify(
      userId,
      NotificationType.SYSTEM,
      'Welcome to Stellara',
      `Your tenant "${tenantName}" has been successfully provisioned. You can now log in using your wallet address.`,
      { event: 'TENANT_PROVISIONED', tenantName },
    );
  }
}
