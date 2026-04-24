import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { AuditLog } from '../audit/audit.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { InsurancePolicyHistory } from '../insurance/entities/insurance-policy-history.entity';
import { DataArchivalController } from './data-archival.controller';
import { DataArchivalService } from './data-archival.service';
import { ArchivedRecord } from './entities/archived-record.entity';
import { ArchiveRun } from './entities/archive-run.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AuditLog,
      Notification,
      InsurancePolicyHistory,
      ArchivedRecord,
      ArchiveRun,
    ]),
    AuthModule,
  ],
  controllers: [DataArchivalController],
  providers: [DataArchivalService],
  exports: [DataArchivalService, TypeOrmModule],
})
export class DataArchivalModule {}
