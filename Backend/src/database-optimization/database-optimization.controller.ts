import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Role } from '../auth/roles.enum';
import { Roles } from '../decorators/roles.decorator';
import { DatabaseOptimizationService } from './database-optimization.service';

@Controller('database/optimization')
@UseGuards(JwtAuthGuard)
@Roles(Role.ADMIN, Role.SUPERADMIN)
export class DatabaseOptimizationController {
  constructor(
    private readonly databaseOptimizationService: DatabaseOptimizationService,
  ) {}

  @Get('report')
  getOptimizationReport() {
    return this.databaseOptimizationService.getOptimizationReport();
  }

  @Post('benchmarks/run-defaults')
  runDefaultBenchmarks() {
    return this.databaseOptimizationService.runDefaultBenchmarks();
  }

  @Post('benchmarks/run')
  runQueryBenchmark(
    @Body()
    body: {
      label: string;
      query: string;
      parameters?: unknown[];
    },
  ) {
    return this.databaseOptimizationService.benchmarkQuery(
      body.label,
      body.query,
      body.parameters ?? [],
    );
  }
}
