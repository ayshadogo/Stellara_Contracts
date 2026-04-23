import { Module } from '@nestjs/common';
import { NotificationController } from './notification.controller';
import { NotificationService } from './services/notification.service';
import { EmailService } from './services/email.service';
import { WebPushService } from './services/web-push.service';
import { DeadlineAlertTask } from './tasks/deadline-alert.task';
import { EmailRetryTask } from './tasks/email-retry.task';
import { DatabaseModule } from '../database.module';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [DatabaseModule, MetricsModule],
  controllers: [NotificationController],
  providers: [
    NotificationService,
    EmailService,
    WebPushService,
    DeadlineAlertTask,
    EmailRetryTask,
  ],
  exports: [NotificationService],
})
export class NotificationModule { }
