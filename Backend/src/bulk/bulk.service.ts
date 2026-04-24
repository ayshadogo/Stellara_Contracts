import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class BulkService {
  constructor(private readonly prisma: PrismaService) {}

  async bulkProjects(projects: any[]) {
    return this.prisma.$transaction(
      projects.map((project) => {
        if (project.id) {
          return this.prisma.project.update({
            where: { id: project.id },
            data: project,
          });
        }
        return this.prisma.project.create({
          data: project,
        });
      }),
    );
  }

  async bulkContributions(contributions: any[]) {
    // For contributions, we typically only create in bulk
    return this.prisma.$transaction(
      contributions.map((contribution) =>
        this.prisma.contribution.create({
          data: contribution,
        }),
      ),
    );
  }
}
