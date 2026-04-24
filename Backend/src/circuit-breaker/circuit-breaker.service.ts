import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import CircuitBreaker from 'opossum';

export interface CircuitBreakerOptions {
  timeout?: number;
  errorThresholdPercentage?: number;
  resetTimeout?: number;
  volumeThreshold?: number;
}

@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private readonly breakers = new Map<string, CircuitBreaker>();

  private readonly defaults: CircuitBreakerOptions = {
    timeout: 5000,
    errorThresholdPercentage: 50,
    resetTimeout: 30000,
    volumeThreshold: 5,
  };

  getBreaker<T>(name: string, fn: (...args: any[]) => Promise<T>, options?: CircuitBreakerOptions): CircuitBreaker<(...args: any[]) => Promise<T>> {
    if (!this.breakers.has(name)) {
      const breaker = new CircuitBreaker(fn, { ...this.defaults, ...options });

      breaker.on('open', () => this.logger.warn(`Circuit breaker [${name}] opened`));
      breaker.on('halfOpen', () => this.logger.log(`Circuit breaker [${name}] half-open`));
      breaker.on('close', () => this.logger.log(`Circuit breaker [${name}] closed`));
      breaker.on('fallback', () => this.logger.warn(`Circuit breaker [${name}] fallback triggered`));

      this.breakers.set(name, breaker);
    }
    return this.breakers.get(name) as CircuitBreaker<(...args: any[]) => Promise<T>>;
  }

  async fire<T>(name: string, fn: (...args: any[]) => Promise<T>, args: any[] = [], options?: CircuitBreakerOptions, fallback?: () => T): Promise<T> {
    const breaker = this.getBreaker(name, fn, options);
    if (fallback) breaker.fallback(fallback);
    try {
      return await breaker.fire(...args) as T;
    } catch (err) {
      if ((err as any).code === 'EOPENBREAKER') {
        throw new ServiceUnavailableException(`Service [${name}] is temporarily unavailable`);
      }
      throw err;
    }
  }

  getStats(name: string) {
    const breaker = this.breakers.get(name);
    if (!breaker) return null;
    return {
      name,
      state: breaker.opened ? 'open' : breaker.halfOpen ? 'half-open' : 'closed',
      stats: breaker.stats,
    };
  }

  getAllStats() {
    return Array.from(this.breakers.keys()).map((name) => this.getStats(name));
  }
}
