import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class FeatureFlagsService {
  constructor(private readonly prisma: PrismaService) {}

  async createFlag(data: { name: string; description?: string; isEnabled?: boolean; rules?: any }) {
    return this.prisma.featureFlag.create({
      data,
    });
  }

  async updateFlag(id: string, data: { isEnabled?: boolean; rules?: any }) {
    return this.prisma.featureFlag.update({
      where: { id },
      data,
    });
  }

  async getFlag(name: string) {
    const flag = await this.prisma.featureFlag.findUnique({
      where: { name },
    });
    if (!flag) throw new NotFoundException(`Feature flag ${name} not found`);
    return flag;
  }

  async getAllFlags() {
    return this.prisma.featureFlag.findMany();
  }

  async isEnabled(name: string, userId?: string) {
    const flag = await this.prisma.featureFlag.findUnique({
      where: { name },
    });

    if (!flag || !flag.isEnabled) return false;

    if (flag.rules && userId) {
      // Basic targeting rule example: { "userIds": ["user1", "user2"] }
      const rules = flag.rules as any;
      if (rules.userIds && Array.isArray(rules.userIds)) {
        return rules.userIds.includes(userId);
      }
      if (rules.percent) {
        // Simple hash-based rollout
        const hash = this.hashCode(userId);
        return (hash % 100) < rules.percent;
      }
    }

    return flag.isEnabled;
  }

  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }
}
