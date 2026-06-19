import { Test, TestingModule } from '@nestjs/testing';
import { RiskService } from './risk.service';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../cache/redis.service';

type RedisClientMock = {
  incr: jest.Mock;
  expire: jest.Mock;
  get: jest.Mock;
  del: jest.Mock;
};

type PrismaMock = {
  auditLog: {
    count: jest.Mock;
    findFirst: jest.Mock;
  };
};

describe('RiskService', () => {
  let service: RiskService;
  let redisClientMock: RedisClientMock;
  let prismaMock: PrismaMock;

  beforeEach(async () => {
    redisClientMock = {
      incr: jest.fn(),
      expire: jest.fn(),
      get: jest.fn(),
      del: jest.fn(),
    };

    const redisServiceMock = {
      getClient: jest.fn().mockReturnValue(redisClientMock),
    };

    prismaMock = {
      auditLog: {
        count: jest.fn(),
        findFirst: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RiskService,
        { provide: RedisService, useValue: redisServiceMock },
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<RiskService>(RiskService);
  });

  describe('trackFailedLogin', () => {
    it('should increment failed attempts and set expiration for new key', async () => {
      redisClientMock.incr.mockResolvedValueOnce(1);

      const result = await service.trackFailedLogin('test@gmail.com');
      expect(result).toEqual({ isLocked: false, attemptsLeft: 4 });
      expect(redisClientMock.incr).toHaveBeenCalledWith(
        'failed-logins:test@gmail.com',
      );
      expect(redisClientMock.expire).toHaveBeenCalledWith(
        'failed-logins:test@gmail.com',
        900,
      );
    });

    it('should report lockout when threshold is reached', async () => {
      redisClientMock.incr.mockResolvedValueOnce(5);

      const result = await service.trackFailedLogin('test@gmail.com');
      expect(result).toEqual({ isLocked: true, attemptsLeft: 0 });
      expect(redisClientMock.expire).not.toHaveBeenCalled();
    });
  });

  describe('isLockedOut', () => {
    it('should return false if no counter key is found', async () => {
      redisClientMock.get.mockResolvedValueOnce(null);

      const locked = await service.isLockedOut('test@gmail.com');
      expect(locked).toBe(false);
    });

    it('should return true if counter is 5 or more', async () => {
      redisClientMock.get.mockResolvedValueOnce('5');

      const locked = await service.isLockedOut('test@gmail.com');
      expect(locked).toBe(true);
    });
  });

  describe('resetFailedLogins', () => {
    it('should delete counter key', async () => {
      await service.resetFailedLogins('test@gmail.com');
      expect(redisClientMock.del).toHaveBeenCalledWith(
        'failed-logins:test@gmail.com',
      );
    });
  });

  describe('checkNewDevice', () => {
    const userId = 'user-123';
    const ua = 'Mozilla/5.0';

    it('should return false if user has never logged in before', async () => {
      prismaMock.auditLog.count.mockResolvedValueOnce(0);

      const result = await service.checkNewDevice(userId, ua);
      expect(result).toBe(false);
      expect(prismaMock.auditLog.count).toHaveBeenCalled();
    });

    it('should return false if user agent has been used successfully before', async () => {
      prismaMock.auditLog.count.mockResolvedValueOnce(5);
      prismaMock.auditLog.findFirst.mockResolvedValueOnce({ id: 'log-1' });

      const result = await service.checkNewDevice(userId, ua);
      expect(result).toBe(false);
    });

    it('should return true if user agent is unseen for this user', async () => {
      prismaMock.auditLog.count.mockResolvedValueOnce(5);
      prismaMock.auditLog.findFirst.mockResolvedValueOnce(null);

      const result = await service.checkNewDevice(userId, ua);
      expect(result).toBe(true);
    });
  });
});
