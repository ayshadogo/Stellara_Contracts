import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('query_benchmarks')
@Index(['label', 'createdAt'])
export class QueryBenchmark {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 120 })
  label: string;

  @Column({ length: 64 })
  queryHash: string;

  @Column({ type: 'text' })
  queryText: string;

  @Column({ type: 'float' })
  executionTimeMs: number;

  @Column({ length: 50 })
  databaseDriver: string;

  @Column({ type: 'simple-json', nullable: true })
  explainPlan?: any;

  @Column({ default: false })
  fromCache: boolean;

  @Column({ type: 'simple-json', nullable: true })
  metadata?: Record<string, any> | null;

  @CreateDateColumn()
  createdAt: Date;
}
