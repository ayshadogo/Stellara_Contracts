import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('archive_runs')
export class ArchiveRun {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100, nullable: true })
  entityType?: string | null;

  @Column({ length: 20 })
  status: 'completed' | 'failed';

  @Column({ default: 0 })
  processed: number;

  @Column({ default: 0 })
  archived: number;

  @Column({ default: 0 })
  deletedFromPrimary: number;

  @Column({ type: 'simple-json', nullable: true })
  details?: Record<string, any> | null;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
