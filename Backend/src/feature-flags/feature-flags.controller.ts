import { Controller, Get, Post, Put, Body, Param, Query } from '@nestjs/common';
import { FeatureFlagsService } from './feature-flags.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Feature Flags')
@Controller('feature-flags')
export class FeatureFlagsController {
  constructor(private readonly featureFlagsService: FeatureFlagsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new feature flag' })
  async createFlag(@Body() data: any) {
    return this.featureFlagsService.createFlag(data);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a feature flag' })
  async updateFlag(@Param('id') id: string, @Body() data: any) {
    return this.featureFlagsService.updateFlag(id, data);
  }

  @Get()
  @ApiOperation({ summary: 'Get all feature flags' })
  async getAllFlags() {
    return this.featureFlagsService.getAllFlags();
  }

  @Get(':name/enabled')
  @ApiOperation({ summary: 'Check if a feature flag is enabled' })
  async isEnabled(@Param('name') name: string, @Query('userId') userId?: string) {
    const enabled = await this.featureFlagsService.isEnabled(name, userId);
    return { name, enabled };
  }
}
