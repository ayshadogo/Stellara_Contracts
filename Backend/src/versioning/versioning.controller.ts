import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Versioning')
@Controller('api/v1')
export class V1Controller {
  @Get('status')
  @ApiOperation({ summary: 'v1 API status (deprecated)' })
  getStatus() {
    return { version: 'v1', status: 'ok' };
  }
}

@ApiTags('Versioning')
@Controller('api/v2')
export class V2Controller {
  @Get('status')
  @ApiOperation({ summary: 'v2 API status (current)' })
  getStatus() {
    return { version: 'v2', status: 'ok' };
  }
}
