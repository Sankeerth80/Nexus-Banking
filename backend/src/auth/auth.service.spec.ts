import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ConflictException, UnauthorizedException } from '@nestjs/common';

import { AuthService } from './auth.service';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../cache/redis.service';
import { EmailService } from '../email/email.service';
import { RiskService } from '../common/risk/risk.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let redis: RedisService;
  let email: EmailService;

  const mockPrisma = {
    customer: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
    },
    employee: {
      findUnique: jest.fn(),
      count: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  };

  const mockRedis = {
    setOtp: jest.fn(),
    getOtp: jest.fn(),
    deleteOtp: jest.fn(),
    setSession: jest.fn(),
    getSession: jest.fn(),
  };

  const mockEmail = {
    sendTemplateEmail: jest.fn(),
  };

  const mockJwt = {
    sign: jest.fn().mockReturnValue('mock-jwt-token'),
  };

  const mockConfig = {
    get: jest.fn().mockImplementation((key: string) => {
      if (key === 'BCRYPT_SALT_ROUNDS') return '10';
      if (key === 'JWT_ACCESS_TTL') return '15m';
      if (key === 'JWT_REFRESH_TTL') return '7d';
      return null;
    }),
  };

  const mockRiskService = {
    isLockedOut: jest.fn().mockResolvedValue(false),
    trackFailedLogin: jest
      .fn()
      .mockResolvedValue({ isLocked: false, attemptsLeft: 4 }),
    resetFailedLogins: jest.fn().mockResolvedValue(undefined),
    checkNewDevice: jest.fn().mockResolvedValue(false),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
        { provide: EmailService, useValue: mockEmail },
        { provide: JwtService, useValue: mockJwt },
        { provide: ConfigService, useValue: mockConfig },
        { provide: RiskService, useValue: mockRiskService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    redis = module.get<RedisService>(RedisService);
    email = module.get<EmailService>(EmailService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('registerCustomer', () => {
    it('should throw ConflictException if user already exists', async () => {
      mockPrisma.customer.findFirst.mockResolvedValueOnce({ id: '1' });
      await expect(
        service.registerCustomer({
          fullName: 'Test',
          email: 'test@test.com',
          phone: '1234567890',
          password: 'Password@123',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException if password policy fails', async () => {
      mockPrisma.customer.findFirst.mockResolvedValueOnce(null);
      await expect(
        service.registerCustomer({
          fullName: 'Test',
          email: 'test@test.com',
          phone: '1234567890',
          password: 'pass',
        }),
      ).rejects.toThrow();
    });
  });

  describe('initiateLogin', () => {
    it('should throw UnauthorizedException if user not found', async () => {
      mockPrisma.customer.findUnique.mockResolvedValueOnce(null);
      mockPrisma.employee.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.initiateLogin({
          email: 'fake@test.com',
          password: 'Password@123',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
