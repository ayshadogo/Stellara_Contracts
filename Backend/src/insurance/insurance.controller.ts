import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../decorators/roles.decorator';
import { Role } from '../auth/roles.enum';
import { CreatePolicyDto } from './dto/create-policy.dto';
import { UpdatePolicyDto } from './dto/update-policy.dto';
import { RenewPolicyDto } from './dto/renew-policy.dto';
import { CancelPolicyDto } from './dto/cancel-policy.dto';
import { InsuranceService } from './insurance.service';
import { PolicyStatus } from './enums/policy-status.enum';

@Controller('insurance/policies')
@UseGuards(JwtAuthGuard)
export class InsuranceController {
  constructor(private readonly insuranceService: InsuranceService) {}

  @Post()
  @Roles(Role.ADMIN, Role.SUPERADMIN, Role.TENANT_ADMIN)
  createPolicy(@Body() createDto: CreatePolicyDto) {
    return this.insuranceService.createPolicy(createDto);
  }

  @Get()
  @Roles(Role.ADMIN, Role.SUPERADMIN, Role.TENANT_ADMIN, Role.USER)
  listPolicies(
    @Query('holderId') holderId?: string,
    @Query('status') status?: PolicyStatus,
  ) {
    return this.insuranceService.listPolicies({ holderId, status });
  }

  @Get('expiring')
  @Roles(Role.ADMIN, Role.SUPERADMIN, Role.TENANT_ADMIN)
  getExpiringPolicies(@Query('days') days?: string) {
    return this.insuranceService.getExpiringPolicies(days ? Number(days) : 30);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.SUPERADMIN, Role.TENANT_ADMIN, Role.USER)
  getPolicy(@Param('id') id: string) {
    return this.insuranceService.getPolicy(id);
  }

  @Get(':id/history')
  @Roles(Role.ADMIN, Role.SUPERADMIN, Role.TENANT_ADMIN, Role.USER)
  getPolicyHistory(@Param('id') id: string) {
    return this.insuranceService.getPolicyHistory(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.SUPERADMIN, Role.TENANT_ADMIN)
  modifyPolicy(@Param('id') id: string, @Body() updateDto: UpdatePolicyDto) {
    return this.insuranceService.modifyPolicy(id, updateDto);
  }

  @Post(':id/renew')
  @Roles(Role.ADMIN, Role.SUPERADMIN, Role.TENANT_ADMIN)
  renewPolicy(@Param('id') id: string, @Body() renewDto: RenewPolicyDto) {
    return this.insuranceService.renewPolicy(id, renewDto);
  }

  @Post(':id/cancel')
  @Roles(Role.ADMIN, Role.SUPERADMIN, Role.TENANT_ADMIN)
  cancelPolicy(@Param('id') id: string, @Body() cancelDto: CancelPolicyDto) {
    return this.insuranceService.cancelPolicy(id, cancelDto);
  }

  @Post('jobs/expire')
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  expirePolicies() {
    return this.insuranceService.expirePolicies();
  }

  @Post('jobs/send-renewal-notifications')
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  sendRenewalNotifications() {
    return this.insuranceService.sendRenewalNotifications();
  }
}
