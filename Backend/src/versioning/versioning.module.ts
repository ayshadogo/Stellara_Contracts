import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { VersioningMiddleware } from './versioning.middleware';
import { V1Controller, V2Controller } from './versioning.controller';

@Module({
  controllers: [V1Controller, V2Controller],
})
export class VersioningModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(VersioningMiddleware).forRoutes('*');
  }
}
