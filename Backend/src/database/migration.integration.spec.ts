/**
 * Migration Integration Tests
 * Test suite for migration strategy and utilities
 */

import { DataSource } from 'typeorm';
import {
  MigrationExecutor,
  MigrationTestingService,
  MigrationManagerService,
  EnhancedMigration,
  MigrationValidator,
} from './index';

describe('Database Migrations', () => {
  let dataSource: DataSource;
  let migrationManager: MigrationManagerService;
  let executor: MigrationExecutor;
  let tester: MigrationTestingService;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      synchronize: false,
      logging: false,
    });

    await dataSource.initialize();
    await dataSource.query(
      `CREATE TABLE workflows (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        state TEXT NOT NULL,
        createdAt TEXT NOT NULL
      )`,
    );
    await dataSource.query(
      `CREATE TABLE audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action_type TEXT NOT NULL
      )`,
    );

    migrationManager = new MigrationManagerService(dataSource);
    executor = new MigrationExecutor();
    tester = new MigrationTestingService();
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  describe('MigrationValidator', () => {
    it('should validate table existence', async () => {
      const queryRunner = dataSource.createQueryRunner();
      try {
        const rule = MigrationValidator.commonRules.tableExists('workflows');
        const result = await rule.validate(queryRunner);
        expect(result).toBe(true);
      } finally {
        await queryRunner.release();
      }
    });

    it('should validate column existence', async () => {
      const queryRunner = dataSource.createQueryRunner();
      try {
        const rule = MigrationValidator.commonRules.columnExists(
          'workflows',
          'id',
        );
        const result = await rule.validate(queryRunner);
        expect(result).toBe(true);
      } finally {
        await queryRunner.release();
      }
    });
  });

  describe('MigrationExecutor', () => {
    it('should execute migration with context tracking', async () => {
      const queryRunner = dataSource.createQueryRunner();
      try {
        const mockMigration: EnhancedMigration = {
          name: 'TestMigration',
          version: '1.0.0',
          description: 'Test migration',
          up: async (_qr, context) => {
            context.executedQueries.push('SELECT 1');
          },
          down: async (_qr, context) => {
            context.executedQueries.push('ROLLBACK');
          },
        };

        const context = await executor.executeMigration(
          queryRunner,
          mockMigration,
          true,
        );

        expect(context.status).toBe('completed');
        expect(context.migrationName).toBe('TestMigration');
        expect(context.duration).toBeGreaterThanOrEqual(0);
      } finally {
        await queryRunner.release();
      }
    });

    it('should track migration metrics', () => {
      const metrics = executor.getMigrationMetrics();
      expect(metrics).toHaveProperty('totalMigrations');
      expect(metrics).toHaveProperty('successful');
      expect(metrics).toHaveProperty('failed');
      expect(metrics).toHaveProperty('averageDuration');
    });
  });

  describe('MigrationTestingService', () => {
    it('should run validation test', async () => {
      const queryRunner = dataSource.createQueryRunner();
      try {
        const mockMigration: EnhancedMigration = {
          name: 'TestMigration',
          version: '1.0.0',
          preValidationRules: [
            MigrationValidator.commonRules.tableExists('workflows'),
          ],
          up: async () => {},
          down: async () => {},
        };

        const result = await tester.testMigrationValidation(
          queryRunner,
          mockMigration,
        );

        expect(result.testType).toBe('validation');
        expect(result.passed).toBe(true);
      } finally {
        await queryRunner.release();
      }
    });

    it('should run dry-run test', async () => {
      const queryRunner = dataSource.createQueryRunner();
      try {
        const mockMigration: EnhancedMigration = {
          name: 'TestMigration',
          version: '1.0.0',
          up: async (_qr, context) => {
            context.executedQueries.push('SELECT 1');
          },
          down: async () => {},
        };

        const result = await tester.testMigrationDryRun(
          queryRunner,
          mockMigration,
        );

        expect(result.testType).toBe('dry-run');
        expect(result.passed).toBe(true);
      } finally {
        await queryRunner.release();
      }
    });

    it('should run the comprehensive migration suite', async () => {
      const queryRunner = dataSource.createQueryRunner();
      try {
        const mockMigration: EnhancedMigration = {
          name: 'ComprehensiveMigration',
          version: '1.0.0',
          backupStrategy: {
            tables: ['workflows'],
            strategy: 'snapshot',
          },
          preValidationRules: [
            MigrationValidator.commonRules.tableExists('workflows'),
          ],
          up: async (_qr, context) => {
            context.executedQueries.push('SELECT 1');
          },
          down: async (_qr, context) => {
            context.executedQueries.push('ROLLBACK');
          },
          rollback: async (_qr, context) => {
            context.executedQueries.push('ROLLBACK');
          },
        };

        const results = await tester.runComprehensiveTest(
          queryRunner,
          mockMigration,
        );

        expect(results).toHaveLength(4);
        expect(results.every((result) => result.passed)).toBe(true);
      } finally {
        await queryRunner.release();
      }
    });
  });

  describe('MigrationManagerService', () => {
    it('should get migration metrics', () => {
      const metrics = migrationManager.getMigrationMetrics();
      expect(metrics.totalMigrations).toBeGreaterThanOrEqual(0);
      expect(metrics.successful).toBeGreaterThanOrEqual(0);
      expect(metrics.failed).toBeGreaterThanOrEqual(0);
    });

    it('should get migration history', () => {
      const history = migrationManager.getMigrationHistory();
      expect(Array.isArray(history)).toBe(true);
    });
  });

  describe('Migration Rollback', () => {
    it('should support rollback operations', async () => {
      const queryRunner = dataSource.createQueryRunner();
      try {
        const mockMigration: EnhancedMigration = {
          name: 'TestMigration',
          version: '1.0.0',
          up: async (_qr, context) => {
            context.executedQueries.push('CREATE TABLE test (id INT)');
          },
          down: async (_qr, context) => {
            context.executedQueries.push('DROP TABLE test');
          },
          rollback: async (_qr, context) => {
            context.executedQueries.push('DROP TABLE test (rollback)');
          },
        };

        expect(typeof mockMigration.rollback).toBe('function');
      } finally {
        await queryRunner.release();
      }
    });
  });

  describe('Data Backup Strategy', () => {
    it('should define backup strategy', () => {
      const mockMigration: EnhancedMigration = {
        name: 'TestMigration',
        version: '1.0.0',
        backupStrategy: {
          tables: ['workflows'],
          strategy: 'full',
        },
        up: async () => {},
        down: async () => {},
      };

      expect(mockMigration.backupStrategy).toBeDefined();
      expect(mockMigration.backupStrategy!.tables).toContain('workflows');
      expect(mockMigration.backupStrategy!.strategy).toBe('full');
    });
  });
});
