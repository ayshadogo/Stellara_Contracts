import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { DatabaseOptimizationController } from './database-optimization.controller';
import { DatabaseOptimizationService } from './database-optimization.service';
import { QueryBenchmark } from './entities/query-benchmark.entity';

@Module({
  imports: [TypeOrmModule.forFeature([QueryBenchmark]), AuthModule],
  controllers: [DatabaseOptimizationController],
  providers: [DatabaseOptimizationService],
  exports: [DatabaseOptimizationService, TypeOrmModule],
})
export class DatabaseOptimizationModule {}
