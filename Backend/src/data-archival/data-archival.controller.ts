import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Role } from '../auth/roles.enum';
import { Roles } from '../decorators/roles.decorator';
import { DataArchivalService } from './data-archival.service';

@Controller('data-archival')
@UseGuards(JwtAuthGuard)
@Roles(Role.ADMIN, Role.SUPERADMIN)
export class DataArchivalController {
  constructor(private readonly dataArchivalService: DataArchivalService) {}

  @Get('rules')
  getArchivalRules() {
    return this.dataArchivalService.getArchivalRules();
  }

  @Get('metrics')
  getArchiveMetrics() {
    return this.dataArchivalService.getArchiveMetrics();
  }

  @Get('records')
  listArchivedRecords(
    @Query('entityType') entityType?: string,
    @Query('sourceEntityId') sourceEntityId?: string,
  ) {
    return this.dataArchivalService.listArchivedRecords(entityType, sourceEntityId);
  }

  @Get('records/:id')
  getArchivedRecord(@Param('id') id: string) {
    return this.dataArchivalService.getArchivedRecord(id);
  }

  @Post('jobs/run')
  runArchivalJob(
    @Body('entityType') entityType?: 'audit_logs' | 'notifications' | 'policy_history',
  ) {
    return this.dataArchivalService.runArchivalJob(entityType);
  }
}
