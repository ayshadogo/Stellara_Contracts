import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { InsurancePolicy } from './insurance-policy.entity';
import { PolicyHistoryAction } from '../enums/policy-history-action.enum';

@Entity('insurance_policy_history')
@Index(['policyId', 'createdAt'])
export class InsurancePolicyHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  policyId: string;

  @ManyToOne(() => InsurancePolicy, (policy) => policy.history, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'policyId' })
  policy: InsurancePolicy;

  @Column({
    type: 'simple-enum',
    enum: PolicyHistoryAction,
  })
  action: PolicyHistoryAction;

  @Column({ nullable: true })
  actorId?: string | null;

  @Column({ type: 'text', nullable: true })
  reason?: string | null;

  @Column({ type: 'simple-json', nullable: true })
  previousState?: Record<string, any> | null;

  @Column({ type: 'simple-json', nullable: true })
  nextState?: Record<string, any> | null;

  @Column({ type: 'simple-json', nullable: true })
  changes?: Record<string, any> | null;

  @CreateDateColumn()
  createdAt: Date;
}
