import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { UserController } from './user.controller';
import { AppService } from './app.service';
import { validateEnv } from './config/env.validation';
import { ReputationModule } from './reputation/reputation.module';
import { DatabaseModule } from './database.module';
import { IndexerModule } from './indexer/indexer.module';
import { NotificationModule } from './notification/notification.module';
import { AuthModule } from './auth/auth.module';
import { WebsocketModule } from './websocket/websocket.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nestjs/throttler-storage-redis';
import { LoggingModule } from './logging/logging.module';
import { ErrorHandlingModule } from './common/error-handling.module';
import { BackupModule } from './backup/backup.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate: validateEnv,
    }),
    // Structured logging with correlation IDs and performance tracing
    LoggingModule.forRoot({
      enableRequestLogging: true,
      enablePerformanceTracing: true,
      defaultContext: 'Application',
    }),
    // Global rate limiting with Redis storage
    ThrottlerModule.forRootAsync({
      useFactory: () => ({
        ttl: 60, // time window in seconds
        limit: 100, // default requests per window
        storage: new ThrottlerStorageRedisService({
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379', 10),
          password: process.env.REDIS_PASSWORD || undefined,
        }),
      }),
    }),
    // Error handling with global filters
    ErrorHandlingModule,
    ReputationModule,
    DatabaseModule,
    IndexerModule,
    NotificationModule,
    AuthModule,
    WebsocketModule,
    // Backup and disaster recovery module
    BackupModule,
  ],
  controllers: [AppController, UserController],
  providers: [AppService],
})
export class AppModule {}
