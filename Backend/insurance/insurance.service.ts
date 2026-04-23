import { Injectable } from '@nestjs/common';
import { PricingService } from './pricing.service';
import { PoolService } from './pool.service';
import { PrismaService } from '../src/prisma.service';
import { RiskType } from '@prisma/client';
import { OracleService } from './oracle.service';

@Injectable()
export class InsuranceService {
  constructor(
    private readonly pricing: PricingService,
    private readonly pools: PoolService,
    private readonly prisma: PrismaService,
    private readonly oracle: OracleService,
  ) {}

  async purchasePolicy(userId: string, poolId: string, riskType: RiskType, coverageAmount: number) {
    const premium = this.pricing.calculatePremium(riskType, coverageAmount);
    await this.pools.lockCapital(poolId, coverageAmount);

    return this.prisma.insurancePolicy.create({
      data: {
        userId,
        poolId,
        riskType: riskType.toUpperCase() as any, // Align with Prisma enum
        coverageAmount,
        premium,
      },
    });
  }

  async checkParametricTrigger(policyId: string) {
    const isTriggered = await this.oracle.verifyTriggerCondition(policyId);
    
    if (isTriggered) {
      const policy = await this.prisma.insurancePolicy.findUnique({
        where: { id: policyId },
      });

      if (policy && policy.status === 'ACTIVE') {
        // Create an automated claim
        return this.prisma.claim.create({
          data: {
            policyId,
            tenantId: 'system', // Default tenant or from policy
            userAddress: 'system', // or from user wallet
            amount: policy.coverageAmount,
            status: 'APPROVED', // Automated approval for parametric
          },
        });
      }
    }
    
    return null;
  }
}
