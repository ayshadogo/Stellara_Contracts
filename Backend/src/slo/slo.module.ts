import { Module } from '@nestjs/common';
import { makeGaugeProvider } from '@willsoto/nestjs-prometheus';
import { SloService } from './slo.service';
import { SloController } from './slo.controller';

@Module({
  providers: [
    SloService,
    makeGaugeProvider({
      name: 'slo_error_budget_remaining',
      help: 'Remaining error budget ratio per SLO (0-1)',
      labelNames: ['slo'],
    }),
  ],
  controllers: [SloController],
  exports: [SloService],
})
export class SloModule {}
