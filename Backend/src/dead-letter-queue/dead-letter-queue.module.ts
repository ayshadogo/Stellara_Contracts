import { Module } from '@nestjs/common';
import { DeadLetterQueueService } from './dead-letter-queue.service';
import { PrismaModule } from '../prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [DeadLetterQueueService],
  exports: [DeadLetterQueueService],
})
export class DeadLetterQueueModule {}
