import { Resolver, Query, ResolveField, Parent, Args, ID } from '@nestjs/graphql';
import { Contribution } from '../types/contribution.type';
import { User } from '../types/user.type';
import { Project } from '../types/project.type';
import { PrismaService } from '../../prisma.service';

@Resolver(() => Contribution)
export class ContributionResolver {
  constructor(private readonly prisma: PrismaService) {}

  @Query(() => [Contribution])
  async contributions() {
    const contributions = await this.prisma.contribution.findMany();
    return contributions.map(c => ({
      ...c,
      amount: c.amount.toString(),
    }));
  }

  @ResolveField(() => User)
  async investor(@Parent() contribution: Contribution) {
    return this.prisma.user.findUnique({ where: { id: (contribution as any).investorId } });
  }

  @ResolveField(() => Project)
  async project(@Parent() contribution: Contribution) {
    const project = await this.prisma.project.findUnique({ where: { id: (contribution as any).projectId } });
    if (!project) return null;
    return {
      ...project,
      goal: project.goal.toString(),
      currentFunds: project.currentFunds.toString(),
    };
  }
}
