import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('archived_records')
@Index(['entityType', 'archivedAt'])
@Index(['sourceEntityId', 'entityType'])
export class ArchivedRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  entityType: string;

  @Column({ length: 100 })
  sourceTable: string;

  @Column({ length: 100 })
  sourceEntityId: string;

  @Column({ length: 50, default: 'cold-db' })
  storageProvider: string;

  @Column({ length: 255, nullable: true })
  storageReference?: string | null;

  @Column({ type: 'simple-json' })
  payload: Record<string, any>;

  @Column({ type: 'simple-json', nullable: true })
  metadata?: Record<string, any> | null;

  @Column({ type: 'timestamp', nullable: true })
  sourceCreatedAt?: Date | null;

  @CreateDateColumn()
  archivedAt: Date;
}
