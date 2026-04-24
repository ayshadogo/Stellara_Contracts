import { Module } from '@nestjs/common';
import { TracingService } from './tracing.service';
import { TracingInterceptor } from './tracing.interceptor';

@Module({
  providers: [TracingService, TracingInterceptor],
  exports: [TracingService, TracingInterceptor],
})
export class TracingModule {}
