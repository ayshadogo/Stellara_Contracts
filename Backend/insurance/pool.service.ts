import { Injectable } from '@nestjs/common';
import { PrismaService } from '../src/prisma.service';

@Injectable()
export class PoolService {
  constructor(private readonly prisma: PrismaService) {}

  async addCapital(poolId: string, amount: number) {
    return this.prisma.pool.update({
      where: { id: poolId },
      data: {
        totalCapacity: { increment: amount },
        availableLiquidity: { increment: amount },
      },
    });
  }

  async lockCapital(poolId: string, amount: number) {
    return this.prisma.pool.update({
      where: { id: poolId },
      data: {
        lockedAmount: { increment: amount },
        availableLiquidity: { decrement: amount },
      },
    });
  }
}
