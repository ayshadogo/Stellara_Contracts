import { Module, Logger } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';

import { AppController } from './app.controller';
import { AppService } from './app.service';

// logging and error handling
import { LoggingModule } from './logging/logging.module';
import { StructuredLogger } from './logging/structured-logger.service';

import { RedisModule } from './redis/redis.module';
import { VoiceModule } from './voice/voice.module';
// DatabaseModule removed - using PostgreSQL config in this module instead
import { StellarMonitorModule } from './stellar-monitor/stellar-monitor.module';
import { WorkflowModule } from './workflow/workflow.module';
import { QueueModule } from './queue/queue.module';
import { AuthModule } from './auth/auth.module';
import { MarketDataModule } from './market-data/market-data.module';
import { NotificationModule } from './notifications/notification.module';
import { InsuranceModule } from './insurance/insurance.module';
import { DataArchivalModule } from './data-archival/data-archival.module';
import { DatabaseOptimizationModule } from './database-optimization/database-optimization.module';

import { RolesGuard } from './guards/roles.guard';

import { AuditModule } from './audit/audit.module';
import { GdprModule } from './gdpr/gdpr.module';
import { ThrottleModule } from './throttle/throttle.module';
import { TenantModule } from './tenancy/tenant.module';


@Module({
  imports: [
    // logging comes first so correlation middleware wraps every request
    LoggingModule,

    ConfigModule.forRoot({
      isGlobal: true,
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const dbType = configService.get('DB_TYPE') || 'sqlite';
        
        const baseConfig: any = {
          type: dbType,
          synchronize: configService.get('NODE_ENV') === 'development',
          autoLoadEntities: true,
          logging:
            configService.get('NODE_ENV') === 'development'
              ? ['query', 'error', 'warn']
              : ['error'],
          maxQueryExecutionTime: 200,
        };

        if (dbType === 'sqlite') {
          baseConfig.database = configService.get('DB_DATABASE') || './stellar-events.db';
        } else {
          baseConfig.host = configService.get('DB_HOST') || 'localhost';
          baseConfig.port = configService.get('DB_PORT') || 5432;
          baseConfig.username = configService.get('DB_USERNAME') || 'postgres';
          baseConfig.password = configService.get('DB_PASSWORD') || 'password';
          baseConfig.database = configService.get('DB_DATABASE') || 'stellara_workflows';
        }

        return baseConfig;
      },
    }),

    RedisModule,
    AuthModule,
    VoiceModule,
    StellarMonitorModule,
    WorkflowModule,
    QueueModule,
    MarketDataModule,
    NotificationModule,
    InsuranceModule,
    DataArchivalModule,
    DatabaseOptimizationModule,
    AuditModule,
    GdprModule,
    ThrottleModule,
    TenantModule,
  ],

  controllers: [AppController],

  providers: [
    AppService,

    /**
     * Global RBAC enforcement
     * Applies @Roles() checks across all controllers
     */
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    // replace the default Nest logger with our structured implementation
    {
      provide: Logger,
      useClass: StructuredLogger,
    },
  ],
})
export class AppModule {}
