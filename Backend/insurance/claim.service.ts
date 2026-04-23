import { Injectable } from '@nestjs/common';
import { PrismaService } from '../src/prisma.service';
import { ClaimStatus } from '@prisma/client';

@Injectable()
export class ClaimService {
  constructor(private readonly prisma: PrismaService) {}

  async assessClaim(claimId: string) {
    const claim = await this.prisma.claim.findUnique({ where: { id: claimId } });
    if (!claim) throw new Error('Claim not found');

    // Simplified automated assessment
    return this.prisma.claim.update({
      where: { id: claimId },
      data: {
        status: 'APPROVED',
        payoutAmount: claim.amount,
      },
    });
  }

  async payClaim(claimId: string) {
    return this.prisma.claim.update({
      where: { id: claimId },
      data: {
        status: 'APPROVED', // Assuming PAID is mapped to something or just keeping status logic
      },
    });
  }
}
