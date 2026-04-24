import { Controller, Get, Post, Param } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RecoveryService } from './recovery.service';

@ApiTags('Recovery')
@Controller('api/v2/recovery')
export class RecoveryController {
  constructor(private readonly recoveryService: RecoveryService) {}

  @Get('history')
  @ApiOperation({ summary: 'Get automated recovery action history' })
  @ApiResponse({ status: 200, description: 'Recovery history returned' })
  getHistory() {
    return this.recoveryService.getHistory();
  }

  @Post('trigger/:target')
  @ApiOperation({ summary: 'Manually trigger recovery for a target' })
  @ApiParam({ name: 'target', example: 'database' })
  @ApiResponse({ status: 201, description: 'Recovery action result' })
  async trigger(@Param('target') target: string) {
    return this.recoveryService.remediate(target);
  }
}
