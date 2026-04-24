import { Controller, Post, Body, UseInterceptors } from '@nestjs/common';
import { BulkService } from './bulk.service';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';

@ApiTags('Bulk Operations')
@Controller('bulk')
export class BulkController {
  constructor(private readonly bulkService: BulkService) {}

  @Post('projects')
  @ApiOperation({ summary: 'Batch create or update projects' })
  @ApiBody({ schema: { type: 'array', items: { type: 'object' } } })
  async bulkProjects(@Body() projects: any[]) {
    return this.bulkService.bulkProjects(projects);
  }

  @Post('contributions')
  @ApiOperation({ summary: 'Batch create contributions' })
  @ApiBody({ schema: { type: 'array', items: { type: 'object' } } })
  async bulkContributions(@Body() contributions: any[]) {
    return this.bulkService.bulkContributions(contributions);
  }
}
