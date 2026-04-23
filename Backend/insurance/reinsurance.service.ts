import { Injectable } from '@nestjs/common';
import { PrismaService } from '../src/prisma.service';

@Injectable()
export class ReinsuranceService {
  constructor(private readonly prisma: PrismaService) {}

  async createContract(poolId: string, coverageLimit: number, premiumRate: number) {
    return this.prisma.reinsuranceContract.create({
      data: {
        poolId,
        coverageLimit,
        premiumRate,
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // Default 1 year
      },
    });
  }
}
