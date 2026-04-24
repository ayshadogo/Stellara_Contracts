import { getRepositoryToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { AuditLog } from '../audit/audit.entity';
import { InsurancePolicyHistory } from '../insurance/entities/insurance-policy-history.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { DataArchivalService } from './data-archival.service';
import { ArchivedRecord } from './entities/archived-record.entity';
import { ArchiveRun } from './entities/archive-run.entity';

describe('DataArchivalService', () => {
  let service: DataArchivalService;
  let notificationRepository: jest.Mocked<Repository<Notification>>;
  let archivedRecordRepository: jest.Mocked<Repository<ArchivedRecord>>;
  let archiveRunRepository: jest.Mocked<Repository<ArchiveRun>>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        DataArchivalService,
        {
          provide: getRepositoryToken(AuditLog),
          useValue: {
            find: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Notification),
          useValue: {
            find: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(InsurancePolicyHistory),
          useValue: {
            find: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(ArchivedRecord),
          useValue: {
            create: jest.fn((value) => value),
            save: jest.fn(async (value) => value),
            find: jest.fn(),
            createQueryBuilder: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(ArchiveRun),
          useValue: {
            create: jest.fn((value) => value),
            save: jest.fn(async (value) => value),
            find: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(DataArchivalService);
    notificationRepository = module.get(getRepositoryToken(Notification));
    archivedRecordRepository = module.get(getRepositoryToken(ArchivedRecord));
    archiveRunRepository = module.get(getRepositoryToken(ArchiveRun));
    jest.clearAllMocks();
  });

  it('archives read notifications older than the retention window', async () => {
    notificationRepository.find.mockResolvedValue([
      {
        id: 'notification-1',
        userId: 'user-1',
        status: 'read',
        isRead: true,
        createdAt: new Date('2025-01-01T00:00:00.000Z'),
      } as unknown as Notification,
    ]);
    notificationRepository.delete.mockResolvedValue({ affected: 1, raw: {} } as any);

    const runs = await service.runArchivalJob('notifications');

    expect(runs[0].status).toBe('completed');
    expect(archivedRecordRepository.save).toHaveBeenCalledTimes(1);
    expect(notificationRepository.delete).toHaveBeenCalledTimes(1);
    expect(archiveRunRepository.save).toHaveBeenCalledTimes(1);
  });
});
