import { createHash } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { RedisService } from '../redis/redis.service';
import { QueryBenchmark } from './entities/query-benchmark.entity';

export interface QueryBenchmarkResult {
  label: string;
  executionTimeMs: number;
  explainPlan: any;
  driver: string;
  fromCache: boolean;
}

@Injectable()
export class DatabaseOptimizationService {
  private readonly logger = new Logger(DatabaseOptimizationService.name);
  private readonly reportCacheKey = 'db-optimization:report';

  constructor(
    private readonly dataSource: DataSource,
    private readonly redisService: RedisService,
    @InjectRepository(QueryBenchmark)
    private readonly benchmarkRepository: Repository<QueryBenchmark>,
  ) {}

  async benchmarkQuery(
    label: string,
    query: string,
    parameters: unknown[] = [],
  ): Promise<QueryBenchmarkResult> {
    const normalizedQuery = query.trim().replace(/;$/, '');
    const cacheKey = `db-optimization:benchmark:${this.hash(`${label}:${normalizedQuery}:${JSON.stringify(parameters)}`)}`;

    if (this.redisService.isRedisAvailable()) {
      const cached = await this.redisService.client.get(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as QueryBenchmarkResult;
        return {
          ...parsed,
          fromCache: true,
        };
      }
    }

    const driver = String(this.dataSource.options.type);
    const start = Date.now();
    await this.dataSource.query(normalizedQuery, parameters);
    const executionTimeMs = Date.now() - start;
    const explainPlan = await this.explainQuery(normalizedQuery, parameters);

    const result: QueryBenchmarkResult = {
      label,
      executionTimeMs,
      explainPlan,
      driver,
      fromCache: false,
    };

    await this.benchmarkRepository.save(
      this.benchmarkRepository.create({
        label,
        queryHash: this.hash(normalizedQuery),
        queryText: normalizedQuery,
        executionTimeMs,
        databaseDriver: driver,
        explainPlan,
        fromCache: false,
      }),
    );

    if (this.redisService.isRedisAvailable()) {
      await this.redisService.client.set(cacheKey, JSON.stringify(result), {
        expiration: {
          type: 'EX',
          value: 300,
        },
      });
      await this.redisService.client.del(this.reportCacheKey);
    }

    return result;
  }

  async runDefaultBenchmarks(): Promise<QueryBenchmarkResult[]> {
    const driver = String(this.dataSource.options.type);
    const activeStatusLiteral = driver === 'postgres' ? `'active'` : `'active'`;

    return Promise.all([
      this.benchmarkQuery(
        'recent_audit_logs',
        'SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 50',
      ),
      this.benchmarkQuery(
        'read_notifications_cleanup_window',
        'SELECT * FROM notifications WHERE "isRead" = true ORDER BY "createdAt" DESC LIMIT 50',
      ),
      this.benchmarkQuery(
        'active_policy_expiration_window',
        `SELECT * FROM insurance_policies WHERE status = ${activeStatusLiteral} ORDER BY "expirationDate" ASC LIMIT 50`,
      ),
    ]);
  }

  async getOptimizationReport() {
    if (this.redisService.isRedisAvailable()) {
      const cached = await this.redisService.client.get(this.reportCacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    }

    const recentBenchmarks = await this.benchmarkRepository.find({
      order: { createdAt: 'DESC' },
      take: 20,
    });

    const report = {
      loggingEnabled: this.dataSource.options.logging,
      slowQueryThresholdMs: this.dataSource.options.maxQueryExecutionTime ?? null,
      benchmarkCount: recentBenchmarks.length,
      slowestQueries: [...recentBenchmarks]
        .sort((left, right) => right.executionTimeMs - left.executionTimeMs)
        .slice(0, 5),
      nPlusOneFindings: [
        {
          area: 'notifications',
          status: 'resolved',
          change: 'Disabled automatic eager user hydration and kept relation loading explicit for read paths.',
        },
        {
          area: 'insurance policies',
          status: 'resolved',
          change: 'Policy listing and history retrieval use targeted joins instead of per-record follow-up fetches.',
        },
      ],
      caching: [
        'Benchmark results are cached in Redis for 5 minutes when Redis is available.',
      ],
    };

    if (this.redisService.isRedisAvailable()) {
      await this.redisService.client.set(this.reportCacheKey, JSON.stringify(report), {
        expiration: {
          type: 'EX',
          value: 300,
        },
      });
    }

    return report;
  }

  private async explainQuery(query: string, parameters: unknown[]): Promise<any> {
    const driver = String(this.dataSource.options.type);

    try {
      if (driver === 'postgres') {
        const rows = await this.dataSource.query(
          `EXPLAIN (ANALYZE, FORMAT JSON) ${query}`,
          parameters,
        );
        return rows[0]?.['QUERY PLAN'] ?? rows;
      }

      if (driver === 'sqlite' || driver === 'better-sqlite3') {
        return this.dataSource.query(`EXPLAIN QUERY PLAN ${query}`, parameters);
      }

      return [];
    } catch (error) {
      this.logger.warn(
        `Failed to explain query "${query}": ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }

  private hash(value: string): string {
    return createHash('sha256').update(value).digest('hex').slice(0, 32);
  }
}
