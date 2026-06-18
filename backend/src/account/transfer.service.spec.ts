import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import * as speakeasy from 'speakeasy';

import { TransferService } from './transfer.service';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../cache/redis.service';
import { EmailService } from '../email/email.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { TransferStatus, TransferType } from '@prisma/client';

jest.mock('speakeasy', () => ({
  totp: {
    verify: jest.fn(),
  },
}));

describe('TransferService', () => {
  let service: TransferService;
  let prisma: PrismaService;
  let redis: RedisService;
  let email: EmailService;
  let realtime: RealtimeGateway;

  const mockPrisma = {
    $transaction: jest
      .fn()
      .mockImplementation((callback) => callback(mockPrisma)),
    customer: {
      findUnique: jest.fn(),
    },
    account: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    transfer: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    },
    auditLog: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    notification: {
      create: jest.fn(),
    },
  };

  const mockRedis = {
    setOtp: jest.fn(),
    getOtp: jest.fn(),
    deleteOtp: jest.fn(),
  };

  const mockEmail = {
    sendTemplateEmail: jest.fn(),
  };

  const mockRealtimeGateway = {
    server: {
      emit: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransferService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
        { provide: EmailService, useValue: mockEmail },
        { provide: RealtimeGateway, useValue: mockRealtimeGateway },
      ],
    }).compile();

    service = module.get<TransferService>(TransferService);
    prisma = module.get<PrismaService>(PrismaService);
    redis = module.get<RedisService>(RedisService);
    email = module.get<EmailService>(EmailService);
    realtime = module.get<RealtimeGateway>(RealtimeGateway);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initiateTransfer', () => {
    const customerId = 'cust-123';
    const dto = {
      sourceAccountId: 'acc-src',
      destinationAccountId: 'acc-dest',
      amount: 500,
      type: TransferType.OWN_ACCOUNT,
    };

    it('should throw NotFoundException if customer not found', async () => {
      mockPrisma.customer.findUnique.mockResolvedValueOnce(null);

      await expect(service.initiateTransfer(customerId, dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if customer onboarding is not approved', async () => {
      mockPrisma.customer.findUnique.mockResolvedValueOnce({
        id: customerId,
        status: 'PENDING',
      });

      await expect(service.initiateTransfer(customerId, dto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw NotFoundException if source account is not found', async () => {
      mockPrisma.customer.findUnique.mockResolvedValueOnce({
        id: customerId,
        status: 'APPROVED',
      });
      mockPrisma.account.findUnique.mockResolvedValueOnce(null);

      await expect(service.initiateTransfer(customerId, dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if customer does not own source account', async () => {
      mockPrisma.customer.findUnique.mockResolvedValueOnce({
        id: customerId,
        status: 'APPROVED',
      });
      mockPrisma.account.findUnique.mockResolvedValueOnce({
        id: 'acc-src',
        customerId: 'other-cust',
        status: 'ACTIVE',
      });

      await expect(service.initiateTransfer(customerId, dto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw BadRequestException if source account is not active', async () => {
      mockPrisma.customer.findUnique.mockResolvedValueOnce({
        id: customerId,
        status: 'APPROVED',
      });
      mockPrisma.account.findUnique.mockResolvedValueOnce({
        id: 'acc-src',
        customerId,
        status: 'DEACTIVATED',
      });

      await expect(service.initiateTransfer(customerId, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if insufficient funds', async () => {
      mockPrisma.customer.findUnique.mockResolvedValueOnce({
        id: customerId,
        status: 'APPROVED',
      });
      mockPrisma.account.findUnique.mockResolvedValueOnce({
        id: 'acc-src',
        customerId,
        status: 'ACTIVE',
        balance: 100,
      });

      await expect(service.initiateTransfer(customerId, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if destination account is missing for internal/own transfers', async () => {
      mockPrisma.customer.findUnique.mockResolvedValueOnce({
        id: customerId,
        status: 'APPROVED',
      });
      mockPrisma.account.findUnique.mockResolvedValueOnce({
        id: 'acc-src',
        customerId,
        status: 'ACTIVE',
        balance: 1000,
      });

      const invalidDto = { ...dto, destinationAccountId: undefined };
      await expect(
        service.initiateTransfer(customerId, invalidDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if destination account is not found', async () => {
      mockPrisma.customer.findUnique.mockResolvedValueOnce({
        id: customerId,
        status: 'APPROVED',
      });
      mockPrisma.account.findUnique.mockImplementation((args: any) => {
        if (args.where.id === 'acc-src') {
          return Promise.resolve({
            id: 'acc-src',
            customerId,
            status: 'ACTIVE',
            balance: 1000,
          });
        }
        return Promise.resolve(null);
      });

      await expect(service.initiateTransfer(customerId, dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if destination account is not active', async () => {
      mockPrisma.customer.findUnique.mockResolvedValueOnce({
        id: customerId,
        status: 'APPROVED',
      });
      mockPrisma.account.findUnique.mockImplementation((args: any) => {
        if (args.where.id === 'acc-src') {
          return Promise.resolve({
            id: 'acc-src',
            customerId,
            status: 'ACTIVE',
            balance: 1000,
          });
        }
        return Promise.resolve({
          id: 'acc-dest',
          customerId,
          status: 'DEACTIVATED',
        });
      });

      await expect(service.initiateTransfer(customerId, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for OWN_ACCOUNT if destination account is not owned by the customer', async () => {
      mockPrisma.customer.findUnique.mockResolvedValueOnce({
        id: customerId,
        status: 'APPROVED',
      });
      mockPrisma.account.findUnique.mockImplementation((args: any) => {
        if (args.where.id === 'acc-src') {
          return Promise.resolve({
            id: 'acc-src',
            customerId,
            status: 'ACTIVE',
            balance: 1000,
          });
        }
        return Promise.resolve({
          id: 'acc-dest',
          customerId: 'other-cust',
          status: 'ACTIVE',
        });
      });

      await expect(service.initiateTransfer(customerId, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should create transfer, set OTP, send email, and update status', async () => {
      const mockCustomer = {
        id: customerId,
        status: 'APPROVED',
        email: 'customer@nexus.com',
        twoFactorEnabled: false,
      };
      mockPrisma.customer.findUnique.mockResolvedValueOnce(mockCustomer);
      mockPrisma.account.findUnique.mockImplementation((args: any) => {
        if (args.where.id === 'acc-src') {
          return Promise.resolve({
            id: 'acc-src',
            customerId,
            status: 'ACTIVE',
            balance: 1000,
          });
        }
        return Promise.resolve({
          id: 'acc-dest',
          customerId,
          status: 'ACTIVE',
        });
      });

      const mockCreatedTransfer = {
        id: 'trf-999',
        reference: 'TRF-123456',
      };
      mockPrisma.transfer.create.mockResolvedValueOnce(mockCreatedTransfer);
      mockRedis.setOtp.mockResolvedValueOnce('OK');
      mockEmail.sendTemplateEmail.mockResolvedValueOnce(true);
      mockPrisma.transfer.update.mockResolvedValueOnce({
        id: 'trf-999',
        status: TransferStatus.OTP_PENDING,
      });

      const result = await service.initiateTransfer(customerId, dto);

      expect(mockPrisma.transfer.create).toHaveBeenCalled();
      expect(mockRedis.setOtp).toHaveBeenCalledWith(
        'transfer:trf-999',
        expect.any(String),
        300,
      );
      expect(mockEmail.sendTemplateEmail).toHaveBeenCalledWith(
        'otp',
        { email: mockCustomer.email },
        { code: expect.any(String) },
      );
      expect(mockPrisma.transfer.update).toHaveBeenCalledWith({
        where: { id: 'trf-999' },
        data: { status: TransferStatus.OTP_PENDING },
      });
      expect(result).toEqual({
        transferId: 'trf-999',
        reference: expect.stringMatching(/^TRF-\d{6}$/),
        needs2fa: false,
        sandboxOtpCode: expect.any(String),
      });
    });
  });

  describe('verifyTransfer2Fa', () => {
    const customerId = 'cust-123';
    const transferId = 'trf-123';

    it('should throw NotFoundException if transfer not found', async () => {
      mockPrisma.transfer.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.verifyTransfer2Fa(customerId, transferId, '123456'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if transfer belongs to another customer', async () => {
      mockPrisma.transfer.findUnique.mockResolvedValueOnce({
        id: transferId,
        customerId: 'other-cust',
      });

      await expect(
        service.verifyTransfer2Fa(customerId, transferId, '123456'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if customer does not have 2FA enabled', async () => {
      mockPrisma.transfer.findUnique.mockResolvedValueOnce({
        id: transferId,
        customerId,
      });
      mockPrisma.customer.findUnique.mockResolvedValueOnce({
        id: customerId,
        twoFactorSecret: null,
      });

      await expect(
        service.verifyTransfer2Fa(customerId, transferId, '123456'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if 2FA code is invalid', async () => {
      mockPrisma.transfer.findUnique.mockResolvedValueOnce({
        id: transferId,
        customerId,
      });
      mockPrisma.customer.findUnique.mockResolvedValueOnce({
        id: customerId,
        twoFactorSecret: 'supersecret',
      });

      (speakeasy.totp.verify as jest.Mock).mockReturnValueOnce(false);

      await expect(
        service.verifyTransfer2Fa(customerId, transferId, 'invalid'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return 2fa_ok if code is correct', async () => {
      mockPrisma.transfer.findUnique.mockResolvedValueOnce({
        id: transferId,
        customerId,
      });
      mockPrisma.customer.findUnique.mockResolvedValueOnce({
        id: customerId,
        twoFactorSecret: 'supersecret',
      });

      (speakeasy.totp.verify as jest.Mock).mockReturnValueOnce(true);

      const result = await service.verifyTransfer2Fa(
        customerId,
        transferId,
        '123456',
      );
      expect(result).toEqual({ status: '2fa_ok' });
    });
  });

  describe('verifyTransferOtp', () => {
    const customerId = 'cust-123';
    const transferId = 'trf-123';

    it('should throw NotFoundException if transfer not found', async () => {
      mockPrisma.transfer.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.verifyTransferOtp(customerId, transferId, '123456'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if transfer belongs to another customer', async () => {
      mockPrisma.transfer.findUnique.mockResolvedValueOnce({
        id: transferId,
        customerId: 'other-cust',
      });

      await expect(
        service.verifyTransferOtp(customerId, transferId, '123456'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if OTP code in redis is invalid or expired', async () => {
      mockPrisma.transfer.findUnique.mockResolvedValueOnce({
        id: transferId,
        customerId,
      });
      mockRedis.getOtp.mockResolvedValueOnce(null);

      await expect(
        service.verifyTransferOtp(customerId, transferId, '123456'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should delete OTP from redis and execute transfer immediately if not scheduled in future', async () => {
      const mockTransfer = {
        id: transferId,
        customerId,
        sourceAccountId: 'acc-src',
        destinationAccountId: 'acc-dest',
        amount: 500,
        type: TransferType.OWN_ACCOUNT,
        reference: 'TRF-111111',
        scheduledFor: null,
        status: TransferStatus.OTP_PENDING,
        customer: { email: 'customer@nexus.com' },
      };

      mockPrisma.transfer.findUnique.mockImplementation((args: any) => {
        if (args.include?.customer) {
          return Promise.resolve(mockTransfer);
        }
        return Promise.resolve({ ...mockTransfer, customer: undefined });
      });

      mockRedis.getOtp.mockResolvedValueOnce('123456');
      mockRedis.deleteOtp.mockResolvedValueOnce('OK');

      mockPrisma.account.findUnique.mockResolvedValueOnce({
        id: 'acc-src',
        balance: 1000,
      });

      mockPrisma.account.update.mockResolvedValue({ id: 'acc-src' });
      mockPrisma.transfer.update.mockResolvedValueOnce({
        ...mockTransfer,
        status: TransferStatus.COMPLETED,
      });

      const result = await service.verifyTransferOtp(
        customerId,
        transferId,
        '123456',
      );

      expect(mockRedis.deleteOtp).toHaveBeenCalledWith(
        `transfer:${transferId}`,
      );
      expect(mockPrisma.account.update).toHaveBeenCalledTimes(2); // decrement source, increment dest
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          customerId,
          action: 'TRANSFER_COMPLETED_REF_TRF-111111',
          entityType: 'Transfer',
          entityId: transferId,
        },
      });
      expect(mockRealtimeGateway.server.emit).toHaveBeenCalledWith(
        'money-transfer',
        expect.objectContaining({
          reference: 'TRF-111111',
          status: 'COMPLETED',
        }),
      );
      expect(mockEmail.sendTemplateEmail).toHaveBeenCalledWith(
        'transfer-alert',
        { email: 'customer@nexus.com' },
      );
      expect(result).toEqual({
        status: 'COMPLETED',
        transfer: expect.objectContaining({ status: TransferStatus.COMPLETED }),
      });
    });

    it('should mark transfer as FAILED if source account has insufficient funds during execution', async () => {
      const mockTransfer = {
        id: transferId,
        customerId,
        sourceAccountId: 'acc-src',
        destinationAccountId: 'acc-dest',
        amount: 2500,
        type: TransferType.OWN_ACCOUNT,
        reference: 'TRF-111111',
        scheduledFor: null,
        status: TransferStatus.OTP_PENDING,
        customer: { email: 'customer@nexus.com' },
      };

      mockPrisma.transfer.findUnique.mockImplementation((args: any) => {
        if (args.include?.customer) {
          return Promise.resolve(mockTransfer);
        }
        return Promise.resolve({ ...mockTransfer, customer: undefined });
      });

      mockRedis.getOtp.mockResolvedValueOnce('123456');
      mockRedis.deleteOtp.mockResolvedValueOnce('OK');

      mockPrisma.account.findUnique.mockResolvedValueOnce({
        id: 'acc-src',
        balance: 1000,
      });

      mockPrisma.transfer.update.mockResolvedValueOnce({
        ...mockTransfer,
        status: TransferStatus.FAILED,
      });

      const result = await service.verifyTransferOtp(
        customerId,
        transferId,
        '123456',
      );

      expect(mockPrisma.transfer.update).toHaveBeenCalledWith({
        where: { id: transferId },
        data: { status: TransferStatus.FAILED },
      });
      expect(result).toEqual({
        status: 'FAILED',
        transfer: expect.objectContaining({ status: TransferStatus.FAILED }),
      });
    });

    it('should schedule transfer if scheduledFor is in the future', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 2);

      const mockTransfer = {
        id: transferId,
        customerId,
        scheduledFor: futureDate,
      };

      mockPrisma.transfer.findUnique.mockResolvedValueOnce(mockTransfer);
      mockRedis.getOtp.mockResolvedValueOnce('123456');
      mockRedis.deleteOtp.mockResolvedValueOnce('OK');
      mockPrisma.transfer.update.mockResolvedValueOnce({
        ...mockTransfer,
        status: TransferStatus.SCHEDULED,
      });

      const result = await service.verifyTransferOtp(
        customerId,
        transferId,
        '123456',
      );

      expect(mockPrisma.transfer.update).toHaveBeenCalledWith({
        where: { id: transferId },
        data: { status: TransferStatus.SCHEDULED },
      });
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          action: 'TRANSFER_SCHEDULED',
          entityType: 'Transfer',
          entityId: transferId,
        },
      });
      expect(result).toEqual({
        status: 'SCHEDULED',
        transfer: expect.objectContaining({ status: TransferStatus.SCHEDULED }),
      });
    });
  });

  describe('processScheduledTransfers', () => {
    it('should select pending scheduled transfers and execute them', async () => {
      const mockPending = [
        { id: 'trf-1', reference: 'TRF-S1', amount: 100 },
        { id: 'trf-2', reference: 'TRF-S2', amount: 200 },
      ];

      mockPrisma.transfer.findMany.mockResolvedValueOnce(mockPending);

      // We need executeTransfer to succeed/mock for each.
      // executeTransfer is private but it calls prisma.$transaction which we mock.
      mockPrisma.transfer.findUnique.mockImplementation((args: any) => {
        if (args.where.id === 'trf-1') {
          return Promise.resolve({
            id: 'trf-1',
            reference: 'TRF-S1',
            amount: 100,
            sourceAccountId: 'acc-src',
            destinationAccountId: 'acc-dest',
            type: TransferType.OWN_ACCOUNT,
            customer: { email: 'test@nexus.com' },
          });
        }
        if (args.where.id === 'trf-2') {
          return Promise.resolve({
            id: 'trf-2',
            reference: 'TRF-S2',
            amount: 200,
            sourceAccountId: 'acc-src',
            destinationAccountId: 'acc-dest',
            type: TransferType.OWN_ACCOUNT,
            customer: { email: 'test@nexus.com' },
          });
        }
        return Promise.resolve(null);
      });

      mockPrisma.account.findUnique.mockResolvedValue({
        id: 'acc-src',
        balance: 1000,
      });

      await service.processScheduledTransfers();

      expect(mockPrisma.transfer.findMany).toHaveBeenCalledWith({
        where: {
          status: TransferStatus.SCHEDULED,
          scheduledFor: {
            lte: expect.any(Date),
          },
        },
      });
      // Verification of executions
      expect(mockPrisma.account.update).toHaveBeenCalled();
    });
  });

  describe('Queries', () => {
    it('getTransferHistory', async () => {
      mockPrisma.transfer.findMany.mockResolvedValueOnce([{ id: '1' }]);
      const res = await service.getTransferHistory('cust-1');
      expect(res).toEqual([{ id: '1' }]);
      expect(mockPrisma.transfer.findMany).toHaveBeenCalledWith({
        where: { customerId: 'cust-1' },
        orderBy: { createdAt: 'desc' },
        include: expect.any(Object),
      });
    });

    it('getAllTransfers', async () => {
      mockPrisma.transfer.findMany.mockResolvedValueOnce([{ id: '1' }]);
      const res = await service.getAllTransfers();
      expect(res).toEqual([{ id: '1' }]);
      expect(mockPrisma.transfer.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
        include: expect.any(Object),
      });
    });

    it('getAuditLogs', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValueOnce([{ id: '1' }]);
      const res = await service.getAuditLogs();
      expect(res).toEqual([{ id: '1' }]);
      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
        include: expect.any(Object),
      });
    });
  });

  describe('cancelScheduledTransfer', () => {
    const customerId = 'cust-123';
    const transferId = 'trf-123';

    it('should throw NotFoundException if transfer not found', async () => {
      mockPrisma.transfer.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.cancelScheduledTransfer(customerId, transferId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if transfer belongs to another customer', async () => {
      mockPrisma.transfer.findUnique.mockResolvedValueOnce({
        id: transferId,
        customerId: 'other-cust',
      });

      await expect(
        service.cancelScheduledTransfer(customerId, transferId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if transfer is not scheduled', async () => {
      mockPrisma.transfer.findUnique.mockResolvedValueOnce({
        id: transferId,
        customerId,
        status: TransferStatus.COMPLETED,
      });

      await expect(
        service.cancelScheduledTransfer(customerId, transferId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should cancel transfer and return updated record', async () => {
      mockPrisma.transfer.findUnique.mockResolvedValueOnce({
        id: transferId,
        customerId,
        status: TransferStatus.SCHEDULED,
      });
      mockPrisma.transfer.update.mockResolvedValueOnce({
        id: transferId,
        status: TransferStatus.CANCELLED,
      });

      const result = await service.cancelScheduledTransfer(
        customerId,
        transferId,
      );

      expect(mockPrisma.transfer.update).toHaveBeenCalledWith({
        where: { id: transferId },
        data: { status: TransferStatus.CANCELLED },
      });
      expect(result).toEqual(
        expect.objectContaining({ status: TransferStatus.CANCELLED }),
      );
    });
  });

  describe('Risk review and holds', () => {
    const customerId = 'cust-123';
    const transferId = 'trf-999';

    it('should hold transfer in RISK_REVIEW status if amount is large (> 1,000,000)', async () => {
      const mockTransfer = {
        id: transferId,
        customerId,
        sourceAccountId: 'acc-src',
        destinationAccountId: 'acc-dest',
        amount: 2500000, // 2.5 million
        type: TransferType.INTERNAL,
        reference: 'TRF-LARGE',
        scheduledFor: null,
        status: TransferStatus.OTP_PENDING,
        customer: { email: 'customer@nexus.com' },
      };

      mockPrisma.transfer.findUnique.mockImplementation((args: any) => {
        if (args.include?.customer) return Promise.resolve(mockTransfer);
        return Promise.resolve({ ...mockTransfer, customer: undefined });
      });

      mockRedis.getOtp.mockResolvedValueOnce('123456');
      mockRedis.deleteOtp.mockResolvedValueOnce('OK');
      mockPrisma.transfer.count.mockResolvedValueOnce(0); // no other recent transfers

      mockPrisma.account.findUnique.mockResolvedValueOnce({
        id: 'acc-src',
        balance: 5000000,
      });

      mockPrisma.transfer.update.mockResolvedValueOnce({
        ...mockTransfer,
        status: TransferStatus.RISK_REVIEW,
      });

      const result = await service.verifyTransferOtp(
        customerId,
        transferId,
        '123456',
      );

      expect(mockPrisma.transfer.update).toHaveBeenCalledWith({
        where: { id: transferId },
        data: { status: TransferStatus.RISK_REVIEW },
      });
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'LARGE_TRANSACTION_TRIGGERED',
          entityType: 'Transfer',
        }),
      });
      expect(mockPrisma.notification.create).toHaveBeenCalled();
      expect(result.status).toEqual('RISK_REVIEW');
    });

    it('should hold transfer in RISK_REVIEW status if velocity threshold is exceeded (3 transfers in 2 mins)', async () => {
      const mockTransfer = {
        id: transferId,
        customerId,
        sourceAccountId: 'acc-src',
        destinationAccountId: 'acc-dest',
        amount: 500, // small amount
        type: TransferType.OWN_ACCOUNT,
        reference: 'TRF-VELOCITY',
        scheduledFor: null,
        status: TransferStatus.OTP_PENDING,
        customer: { email: 'customer@nexus.com' },
      };

      mockPrisma.transfer.findUnique.mockImplementation((args: any) => {
        if (args.include?.customer) return Promise.resolve(mockTransfer);
        return Promise.resolve({ ...mockTransfer, customer: undefined });
      });

      mockRedis.getOtp.mockResolvedValueOnce('123456');
      mockPrisma.transfer.count.mockResolvedValueOnce(2); // 2 previous transfers in last 2 mins (+ current = 3)

      mockPrisma.account.findUnique.mockResolvedValueOnce({
        id: 'acc-src',
        balance: 5000,
      });

      mockPrisma.transfer.update.mockResolvedValueOnce({
        ...mockTransfer,
        status: TransferStatus.RISK_REVIEW,
      });

      const result = await service.verifyTransferOtp(
        customerId,
        transferId,
        '123456',
      );

      expect(mockPrisma.transfer.update).toHaveBeenCalledWith({
        where: { id: transferId },
        data: { status: TransferStatus.RISK_REVIEW },
      });
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'RAPID_TRANSFERS_TRIGGERED',
        }),
      });
      expect(result.status).toEqual('RISK_REVIEW');
    });

    it('getPendingRiskReviews should return pending transfers', async () => {
      mockPrisma.transfer.findMany.mockResolvedValueOnce([
        { id: 'trf-review' },
      ]);
      const res = await service.getPendingRiskReviews();
      expect(res).toEqual([{ id: 'trf-review' }]);
      expect(mockPrisma.transfer.findMany).toHaveBeenCalledWith({
        where: { status: TransferStatus.RISK_REVIEW },
        orderBy: { createdAt: 'desc' },
        include: expect.any(Object),
      });
    });

    it('reviewTransfer should reject transfer and fail it', async () => {
      const mockTransfer = {
        id: transferId,
        customerId,
        amount: 500,
        status: TransferStatus.RISK_REVIEW,
        reference: 'TRF-999',
        customer: { id: customerId, email: 'customer@nexus.com' },
      };
      mockPrisma.transfer.findUnique.mockResolvedValueOnce(mockTransfer);
      mockPrisma.transfer.update.mockResolvedValueOnce({
        ...mockTransfer,
        status: TransferStatus.FAILED,
      });

      const result = await service.reviewTransfer(
        transferId,
        false,
        'emp-789',
        'Violates policy',
      );
      expect(result.status).toEqual('FAILED');
      expect(mockPrisma.transfer.update).toHaveBeenCalledWith({
        where: { id: transferId },
        data: { status: TransferStatus.FAILED },
      });
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorId: 'emp-789',
          action: 'TRANSFER_REJECTED_REF_TRF-999',
        }),
      });
    });

    it('reviewTransfer should approve transfer and execute it', async () => {
      const mockTransfer = {
        id: transferId,
        customerId,
        sourceAccountId: 'acc-src',
        destinationAccountId: 'acc-dest',
        amount: 500,
        type: TransferType.OWN_ACCOUNT,
        status: TransferStatus.RISK_REVIEW,
        reference: 'TRF-999',
        customer: { id: customerId, email: 'customer@nexus.com' },
      };
      mockPrisma.transfer.findUnique.mockResolvedValueOnce(mockTransfer);
      mockPrisma.account.findUnique.mockResolvedValueOnce({
        id: 'acc-src',
        balance: 2000,
      });
      mockPrisma.account.update.mockResolvedValue({ id: 'acc-src' });
      mockPrisma.transfer.update.mockResolvedValueOnce({
        ...mockTransfer,
        status: TransferStatus.COMPLETED,
      });

      const result = await service.reviewTransfer(
        transferId,
        true,
        'emp-789',
        'Looks fine',
      );
      expect(result.status).toEqual('COMPLETED');
      expect(mockPrisma.account.update).toHaveBeenCalledTimes(2); // src and dest
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorId: 'emp-789',
          action: 'TRANSFER_APPROVED_REF_TRF-999',
        }),
      });
    });
  });
});
