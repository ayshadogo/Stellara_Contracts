import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SloService } from './slo.service';

@ApiTags('SLO')
@Controller('api/v2/slo')
export class SloController {
  constructor(private readonly sloService: SloService) {}

  @Get()
  @ApiOperation({ summary: 'Get current SLO statuses and error budgets' })
  @ApiResponse({ status: 200, description: 'SLO statuses returned' })
  async getSlos() {
    return this.sloService.getSloStatuses();
  }
}
