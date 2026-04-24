import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { PolicyStatus } from '../enums/policy-status.enum';
import { InsurancePolicyHistory } from './insurance-policy-history.entity';

@Entity('insurance_policies')
@Index(['holderId', 'status'])
@Index(['status', 'expirationDate'])
export class InsurancePolicy {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 64 })
  @Index()
  policyNumber: string;

  @Column({ type: 'uuid' })
  @Index()
  holderId: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'holderId' })
  holder: User;

  @Column({ length: 100 })
  productName: string;

  @Column({ length: 100 })
  coverageType: string;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  coverageAmount: string;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  premiumAmount: string;

  @Column({ type: 'timestamp' })
  effectiveDate: Date;

  @Column({ type: 'timestamp' })
  expirationDate: Date;

  @Column({
    type: 'simple-enum',
    enum: PolicyStatus,
    default: PolicyStatus.ACTIVE,
  })
  status: PolicyStatus;

  @Column({ nullable: true })
  previousPolicyId?: string | null;

  @ManyToOne(() => InsurancePolicy, { nullable: true })
  @JoinColumn({ name: 'previousPolicyId' })
  previousPolicy?: InsurancePolicy | null;

  @OneToMany(() => InsurancePolicyHistory, (history) => history.policy)
  history: InsurancePolicyHistory[];

  @Column({ type: 'simple-json', nullable: true })
  metadata?: Record<string, any> | null;

  @Column({ type: 'timestamp', nullable: true })
  lastRenewalNotificationAt?: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  cancelledAt?: Date | null;

  @Column({ nullable: true })
  cancellationReason?: string | null;

  @Column({ nullable: true })
  modifiedBy?: string | null;

  @Column({ default: 1 })
  version: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
