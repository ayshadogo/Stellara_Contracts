import { Resolver, Query, ResolveField, Parent, Args, ID } from '@nestjs/graphql';
import { Project } from '../types/project.type';
import { User } from '../types/user.type';
import { PrismaService } from '../../prisma.service';

@Resolver(() => Project)
export class ProjectResolver {
  constructor(private readonly prisma: PrismaService) {}

  @Query(() => [Project])
  async projects() {
    const projects = await this.prisma.project.findMany();
    // Convert BigInt to string for GraphQL
    return projects.map(p => ({
      ...p,
      goal: p.goal.toString(),
      currentFunds: p.currentFunds.toString(),
    }));
  }

  @Query(() => Project, { nullable: true })
  async project(@Args('id', { type: () => ID }) id: string) {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) return null;
    return {
      ...project,
      goal: project.goal.toString(),
      currentFunds: project.currentFunds.toString(),
    };
  }

  @ResolveField(() => User)
  async creator(@Parent() project: Project) {
    return this.prisma.user.findUnique({ where: { id: (project as any).creatorId } });
  }
}
