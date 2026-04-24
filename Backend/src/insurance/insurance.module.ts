import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationModule } from '../notifications/notification.module';
import { InsuranceController } from './insurance.controller';
import { InsuranceService } from './insurance.service';
import { InsurancePolicy } from './entities/insurance-policy.entity';
import { InsurancePolicyHistory } from './entities/insurance-policy-history.entity';
import { User } from '../auth/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([InsurancePolicy, InsurancePolicyHistory, User]),
    AuthModule,
    AuditModule,
    NotificationModule,
  ],
  controllers: [InsuranceController],
  providers: [InsuranceService],
  exports: [InsuranceService, TypeOrmModule],
})
export class InsuranceModule {}
