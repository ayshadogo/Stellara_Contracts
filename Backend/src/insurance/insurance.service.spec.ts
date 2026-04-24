import { getRepositoryToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { AuditService } from '../audit/audit.service';
import { NotificationService } from '../notifications/services/notification.service';
import { InsurancePolicy } from './entities/insurance-policy.entity';
import { InsurancePolicyHistory } from './entities/insurance-policy-history.entity';
import { PolicyStatus } from './enums/policy-status.enum';
import { InsuranceService } from './insurance.service';

describe('InsuranceService', () => {
  let service: InsuranceService;
  let policyRepository: jest.Mocked<Repository<InsurancePolicy>>;
  let historyRepository: jest.Mocked<Repository<InsurancePolicyHistory>>;
  let userRepository: jest.Mocked<Repository<User>>;
  const notificationService = {
    createNotification: jest.fn(),
  };
  const auditService = {
    logAction: jest.fn(),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        InsuranceService,
        {
          provide: getRepositoryToken(InsurancePolicy),
          useValue: {
            create: jest.fn((value) => value),
            save: jest.fn(async (value) => value),
            findOne: jest.fn(),
            find: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(InsurancePolicyHistory),
          useValue: {
            create: jest.fn((value) => value),
            save: jest.fn(async (value) => value),
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: NotificationService,
          useValue: notificationService,
        },
        {
          provide: AuditService,
          useValue: auditService,
        },
      ],
    }).compile();

    service = module.get(InsuranceService);
    policyRepository = module.get(getRepositoryToken(InsurancePolicy));
    historyRepository = module.get(getRepositoryToken(InsurancePolicyHistory));
    userRepository = module.get(getRepositoryToken(User));
    jest.clearAllMocks();
  });

  it('creates a policy and records the issuance history', async () => {
    const user = { id: 'user-1' } as User;
    const savedPolicy = {
      id: 'policy-1',
      holderId: user.id,
      holder: user,
      productName: 'Marine Cover',
      coverageType: 'cargo',
      coverageAmount: '12000.00',
      premiumAmount: '350.00',
      effectiveDate: new Date('2026-01-01T00:00:00.000Z'),
      expirationDate: new Date('2026-12-31T00:00:00.000Z'),
      policyNumber: 'MAR-1',
      status: PolicyStatus.ACTIVE,
      version: 1,
    } as InsurancePolicy;

    userRepository.findOne.mockResolvedValue(user);
    policyRepository.save.mockResolvedValue(savedPolicy);
    policyRepository.findOne.mockResolvedValue(savedPolicy);

    const result = await service.createPolicy({
      holderId: user.id,
      productName: 'Marine Cover',
      coverageType: 'cargo',
      coverageAmount: '12000.00',
      premiumAmount: '350.00',
      effectiveDate: '2026-01-01T00:00:00.000Z',
      expirationDate: '2026-12-31T00:00:00.000Z',
      modifiedBy: 'admin-1',
    });

    expect(result.id).toBe(savedPolicy.id);
    expect(historyRepository.save).toHaveBeenCalledTimes(1);
    expect(auditService.logAction).toHaveBeenCalledWith(
      'INSURANCE_POLICY_ISSUED',
      'admin-1',
      savedPolicy.id,
      expect.any(Object),
    );
  });

  it('renews a policy by creating a successor and marking the original as renewed', async () => {
    const currentPolicy = {
      id: 'policy-1',
      holderId: 'user-1',
      productName: 'Marine Cover',
      coverageType: 'cargo',
      coverageAmount: '12000.00',
      premiumAmount: '350.00',
      effectiveDate: new Date('2026-01-01T00:00:00.000Z'),
      expirationDate: new Date('2026-12-31T00:00:00.000Z'),
      policyNumber: 'MAR-1',
      status: PolicyStatus.ACTIVE,
      version: 1,
      metadata: {},
    } as InsurancePolicy;
    const renewedPolicy = {
      ...currentPolicy,
      id: 'policy-2',
      previousPolicyId: currentPolicy.id,
      policyNumber: 'MAR-1-R1',
      effectiveDate: new Date('2027-01-01T00:00:01.000Z'),
      expirationDate: new Date('2028-01-01T00:00:01.000Z'),
      status: PolicyStatus.ACTIVE,
    } as InsurancePolicy;

    policyRepository.findOne
      .mockResolvedValueOnce(currentPolicy)
      .mockResolvedValueOnce(renewedPolicy);
    policyRepository.save
      .mockResolvedValueOnce({
        ...currentPolicy,
        status: PolicyStatus.RENEWED,
        version: 2,
      } as InsurancePolicy)
      .mockResolvedValueOnce(renewedPolicy);

    const result = await service.renewPolicy(currentPolicy.id, {
      modifiedBy: 'admin-1',
      effectiveDate: '2027-01-01T00:00:01.000Z',
      expirationDate: '2028-01-01T00:00:01.000Z',
    });

    expect(result.id).toBe('policy-2');
    expect(policyRepository.save).toHaveBeenCalledTimes(2);
    expect(historyRepository.save).toHaveBeenCalledTimes(2);
    expect(auditService.logAction).toHaveBeenCalledWith(
      'INSURANCE_POLICY_RENEWED',
      'admin-1',
      'policy-2',
      expect.any(Object),
    );
  });
});
