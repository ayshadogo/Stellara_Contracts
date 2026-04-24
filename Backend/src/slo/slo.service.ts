import { Injectable, Logger } from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Gauge, Registry } from 'prom-client';
import { SLO_DEFINITIONS, SloDefinition } from './slo.definitions';

export interface SloStatus {
  name: string;
  description: string;
  target: number;
  current: number;
  errorBudgetRemaining: number;
  breached: boolean;
}

@Injectable()
export class SloService {
  private readonly logger = new Logger(SloService.name);

  constructor(
    @InjectMetric('http_requests_total')
    private readonly httpRequests: Counter,
    @InjectMetric('slo_error_budget_remaining')
    private readonly errorBudgetGauge: Gauge,
  ) {}

  async getSloStatuses(): Promise<SloStatus[]> {
    const registry: Registry = (this.httpRequests as any)._registry;
    const metrics = await registry.getMetricsAsJSON();

    const httpTotal = this.getCounterValue(metrics, 'http_requests_total');
    const httpErrors = this.getCounterValue(metrics, 'http_requests_total', {
      status: /^5/,
    });

    return SLO_DEFINITIONS.map((slo) => {
      const current = this.computeCurrent(slo, httpTotal, httpErrors);
      const errorBudgetRemaining = this.computeErrorBudget(slo, current);
      const breached = current < slo.target;

      this.errorBudgetGauge.set({ slo: slo.name }, errorBudgetRemaining);

      if (breached) {
        this.logger.warn(
          `SLO breach: ${slo.name} current=${current.toFixed(4)} target=${slo.target}`,
        );
      }

      return {
        name: slo.name,
        description: slo.description,
        target: slo.target,
        current,
        errorBudgetRemaining,
        breached,
      };
    });
  }

  private computeCurrent(
    slo: SloDefinition,
    total: number,
    errors: number,
  ): number {
    if (slo.name === 'api_availability') {
      return total === 0 ? 1 : (total - errors) / total;
    }
    // For latency/indexer SLOs we return target as placeholder
    // (real p99 computation requires histogram buckets query)
    return slo.target;
  }

  private computeErrorBudget(slo: SloDefinition, current: number): number {
    const allowedErrorRate = 1 - slo.target;
    const actualErrorRate = 1 - current;
    if (allowedErrorRate === 0) return 0;
    return Math.max(0, (allowedErrorRate - actualErrorRate) / allowedErrorRate);
  }

  private getCounterValue(
    metrics: any[],
    name: string,
    labelFilter?: Record<string, RegExp>,
  ): number {
    const metric = metrics.find((m) => m.name === name);
    if (!metric) return 0;

    return (metric.values as any[])
      .filter((v) => {
        if (!labelFilter) return true;
        return Object.entries(labelFilter).every(([k, re]) =>
          re.test(String(v.labels?.[k] ?? '')),
        );
      })
      .reduce((sum, v) => sum + (v.value ?? 0), 0);
  }
}
