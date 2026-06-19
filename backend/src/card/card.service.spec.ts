import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { CardService } from './card.service';
import { PrismaService } from '../database/prisma.service';
import { CardStatus, CardType } from '@prisma/client';

type MockFindArgs = {
  include?: Record<string, unknown>;
};

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('mocked-hash'),
}));

describe('CardService', () => {
  let service: CardService;
  let prisma: PrismaService;

  const mockPrisma = {
    $transaction: jest
      .fn()
      .mockImplementation((callback) => callback(mockPrisma)),
    customer: {
      findUnique: jest.fn(),
    },
    account: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    card: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    cardTransaction: {
      create: jest.fn(),
      createMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CardService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<CardService>(CardService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getCards', () => {
    it('should query cards for customer including transactions', async () => {
      mockPrisma.card.findMany.mockResolvedValueOnce([{ id: 'card-1' }]);
      const res = await service.getCards('cust-123');
      expect(res).toEqual([{ id: 'card-1' }]);
      expect(mockPrisma.card.findMany).toHaveBeenCalledWith({
        where: { customerId: 'cust-123' },
        include: {
          transactions: {
            orderBy: { createdAt: 'desc' },
            take: 25,
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('createDebitCard', () => {
    const customerId = 'cust-123';
    const dto = { accountId: 'acc-123' };

    it('should throw NotFoundException if account not found', async () => {
      mockPrisma.account.findUnique.mockResolvedValueOnce(null);
      await expect(service.createDebitCard(customerId, dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if account not owned by customer', async () => {
      mockPrisma.account.findUnique.mockResolvedValueOnce({
        id: 'acc-123',
        customerId: 'other-cust',
        status: 'ACTIVE',
      });
      await expect(service.createDebitCard(customerId, dto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw BadRequestException if account is inactive', async () => {
      mockPrisma.account.findUnique.mockResolvedValueOnce({
        id: 'acc-123',
        customerId,
        status: 'DEACTIVATED',
      });
      await expect(service.createDebitCard(customerId, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should successfully create debit card and write audit log', async () => {
      mockPrisma.account.findUnique.mockResolvedValueOnce({
        id: 'acc-123',
        customerId,
        status: 'ACTIVE',
      });
      mockPrisma.card.create.mockResolvedValueOnce({ id: 'card-debit' });

      const res = await service.createDebitCard(customerId, dto);
      expect(res).toEqual({ id: 'card-debit' });
      expect(mockPrisma.card.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          customerId,
          type: CardType.DEBIT,
          status: CardStatus.ACTIVE,
          accountId: 'acc-123',
          cardNumber: expect.stringMatching(/^4\d{3} \d{4} \d{4} \d{4}$/),
          maskedNumber: expect.stringMatching(
            /^4\d{3} \d{2}\*\* \*\*\*\* \d{4}$/,
          ),
          expiryDate: expect.any(String),
          cvv: expect.any(String),
        }),
      });
      expect(mockPrisma.auditLog.create).toHaveBeenCalled();
    });
  });

  describe('applyCreditCard', () => {
    const customerId = 'cust-123';
    const dto = { tier: 'GOLD', requestedLimit: 100000 };

    it('should throw NotFoundException if customer not found', async () => {
      mockPrisma.customer.findUnique.mockResolvedValueOnce(null);
      await expect(service.applyCreditCard(customerId, dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if customer onboarding is not approved', async () => {
      mockPrisma.customer.findUnique.mockResolvedValueOnce({
        id: customerId,
        status: 'PENDING',
      });
      await expect(service.applyCreditCard(customerId, dto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should successfully create credit card in INACTIVE status and log audits', async () => {
      mockPrisma.customer.findUnique.mockResolvedValueOnce({
        id: customerId,
        status: 'APPROVED',
      });
      mockPrisma.card.create.mockResolvedValueOnce({ id: 'card-credit' });

      const res = await service.applyCreditCard(customerId, dto);
      expect(res).toEqual({ id: 'card-credit' });
      expect(mockPrisma.card.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          customerId,
          type: CardType.CREDIT,
          status: CardStatus.INACTIVE,
          creditLimit: 100000,
          availableCredit: 100000,
          cardNumber: expect.stringMatching(/^5\d{3} \d{4} \d{4} \d{4}$/),
        }),
      });
      expect(mockPrisma.auditLog.create).toHaveBeenCalled();
    });
  });

  describe('activateCard', () => {
    const customerId = 'cust-123';
    const cardId = 'card-123';

    it('should throw NotFoundException if card not found', async () => {
      mockPrisma.card.findUnique.mockResolvedValueOnce(null);
      await expect(service.activateCard(customerId, cardId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if card belongs to other customer', async () => {
      mockPrisma.card.findUnique.mockResolvedValueOnce({
        id: cardId,
        customerId: 'other-cust',
      });
      await expect(service.activateCard(customerId, cardId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw BadRequestException if card is already active', async () => {
      mockPrisma.card.findUnique.mockResolvedValueOnce({
        id: cardId,
        customerId,
        status: CardStatus.ACTIVE,
      });
      await expect(service.activateCard(customerId, cardId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should activate card, seed mock transactions and recalculate outstanding balances', async () => {
      const mockCard = {
        id: cardId,
        customerId,
        type: CardType.CREDIT,
        status: CardStatus.INACTIVE,
        creditLimit: 100000,
      };
      mockPrisma.card.findUnique.mockImplementation((args: MockFindArgs) => {
        if (args.include?.transactions) {
          return Promise.resolve({
            ...mockCard,
            status: CardStatus.ACTIVE,
            transactions: [],
          });
        }
        return Promise.resolve(mockCard);
      });
      mockPrisma.card.update.mockResolvedValueOnce({
        ...mockCard,
        status: CardStatus.ACTIVE,
      });
      mockPrisma.cardTransaction.createMany.mockResolvedValueOnce({ count: 3 });

      const res = await service.activateCard(customerId, cardId);
      expect(res?.status).toEqual(CardStatus.ACTIVE);
      expect(mockPrisma.cardTransaction.createMany).toHaveBeenCalled();
      expect(mockPrisma.card.update).toHaveBeenCalledWith({
        where: { id: cardId },
        data: {
          balance: 15400 + 5200 + 799,
          availableCredit: 100000 - (15400 + 5200 + 799),
          rewardsPoints: Math.floor((15400 + 5200 + 799) * 0.05),
        },
      });
      expect(mockPrisma.auditLog.create).toHaveBeenCalled();
    });
  });

  describe('updateCardStatus', () => {
    it('should update card status successfully', async () => {
      mockPrisma.card.findUnique.mockResolvedValueOnce({
        id: 'c-1',
        customerId: 'cust-1',
      });
      mockPrisma.card.update.mockResolvedValueOnce({
        id: 'c-1',
        status: CardStatus.FROZEN,
      });

      const res = await service.updateCardStatus(
        'cust-1',
        'c-1',
        CardStatus.FROZEN,
      );
      expect(res.status).toEqual(CardStatus.FROZEN);
      expect(mockPrisma.card.update).toHaveBeenCalledWith({
        where: { id: 'c-1' },
        data: { status: CardStatus.FROZEN },
      });
    });
  });

  describe('updateLimits', () => {
    it('should update limits toggles and spend caps', async () => {
      mockPrisma.card.findUnique.mockResolvedValueOnce({
        id: 'c-1',
        customerId: 'cust-1',
      });
      mockPrisma.card.update.mockResolvedValueOnce({ id: 'c-1' });

      const dto = { atmEnabled: false, onlineEnabled: true, dailyLimit: 50000 };
      await service.updateLimits('cust-1', 'c-1', dto);

      expect(mockPrisma.card.update).toHaveBeenCalledWith({
        where: { id: 'c-1' },
        data: expect.objectContaining({
          atmEnabled: false,
          onlineEnabled: true,
          dailyLimit: 50000,
        }),
      });
    });
  });

  describe('updatePin', () => {
    it('should hash PIN and store in database', async () => {
      mockPrisma.card.findUnique.mockResolvedValueOnce({
        id: 'c-1',
        customerId: 'cust-1',
      });
      mockPrisma.card.update.mockResolvedValueOnce({ id: 'c-1' });

      (bcrypt.hash as jest.Mock).mockResolvedValueOnce('hashed-pin-1234');

      const res = await service.updatePin('cust-1', 'c-1', '1234');
      expect(res).toEqual({
        status: 'success',
        message: 'Card PIN updated successfully',
      });
      expect(bcrypt.hash).toHaveBeenCalledWith('1234', 10);
      expect(mockPrisma.card.update).toHaveBeenCalledWith({
        where: { id: 'c-1' },
        data: { pinHash: 'hashed-pin-1234' },
      });
    });
  });

  describe('payCreditCardBill', () => {
    const customerId = 'cust-123';
    const cardId = 'card-credit';
    const dto = { accountId: 'acc-123', amount: 5000 };

    it('should throw exception if card is not active or not credit', async () => {
      mockPrisma.card.findUnique.mockResolvedValueOnce({
        id: cardId,
        customerId,
        type: CardType.DEBIT,
      });
      await expect(
        service.payCreditCardBill(customerId, cardId, dto),
      ).rejects.toThrow();
    });

    it('should throw exception if account has insufficient funds', async () => {
      mockPrisma.card.findUnique.mockResolvedValueOnce({
        id: cardId,
        customerId,
        type: CardType.CREDIT,
        status: CardStatus.ACTIVE,
      });
      mockPrisma.account.findUnique.mockResolvedValueOnce({
        id: 'acc-123',
        customerId,
        status: 'ACTIVE',
        balance: 1000,
      });

      await expect(
        service.payCreditCardBill(customerId, cardId, dto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should decrement account, decrement card outstanding, and log card transaction', async () => {
      mockPrisma.card.findUnique.mockResolvedValueOnce({
        id: cardId,
        customerId,
        type: CardType.CREDIT,
        status: CardStatus.ACTIVE,
      });
      mockPrisma.account.findUnique.mockResolvedValueOnce({
        id: 'acc-123',
        accountNumber: '99991234',
        customerId,
        status: 'ACTIVE',
        balance: 10000,
      });

      mockPrisma.account.update.mockResolvedValueOnce({ id: 'acc-123' });
      mockPrisma.card.update.mockResolvedValueOnce({ id: cardId });
      mockPrisma.cardTransaction.create.mockResolvedValueOnce({
        id: 'trans-pay',
      });

      const res = await service.payCreditCardBill(customerId, cardId, dto);
      expect(res.status).toEqual('success');
      expect(mockPrisma.account.update).toHaveBeenCalledWith({
        where: { id: 'acc-123' },
        data: { balance: { decrement: 5000 } },
      });
      expect(mockPrisma.card.update).toHaveBeenCalledWith({
        where: { id: cardId },
        data: {
          balance: { decrement: 5000 },
          availableCredit: { increment: 5000 },
        },
      });
      expect(mockPrisma.cardTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          cardId,
          amount: -5000,
          description: 'Bill Payment - Ref Account 1234',
        }),
      });
    });
  });

  describe('convertToEmi', () => {
    const customerId = 'cust-123';
    const transactionId = 'trans-123';

    it('should throw exception if transaction is already an EMI', async () => {
      mockPrisma.cardTransaction.findUnique.mockResolvedValueOnce({
        id: transactionId,
        isEmi: true,
        card: { customerId },
      });
      await expect(
        service.convertToEmi(customerId, transactionId, 6),
      ).rejects.toThrow(BadRequestException);
    });

    it('should successfully flag transaction as EMI', async () => {
      mockPrisma.cardTransaction.findUnique.mockResolvedValueOnce({
        id: transactionId,
        isEmi: false,
        amount: 12000,
        card: { customerId },
      });
      mockPrisma.cardTransaction.update.mockResolvedValueOnce({
        id: transactionId,
        isEmi: true,
      });

      const res = await service.convertToEmi(customerId, transactionId, 12);
      expect(res.isEmi).toBe(true);
      expect(mockPrisma.cardTransaction.update).toHaveBeenCalledWith({
        where: { id: transactionId },
        data: {
          isEmi: true,
          emiMonths: 12,
          emiInterestRate: 14.5,
        },
      });
    });
  });

  describe('redeemRewards', () => {
    const customerId = 'cust-123';
    const cardId = 'card-123';

    it('should credit cashback rewards to active account and reset points', async () => {
      mockPrisma.card.findUnique.mockResolvedValueOnce({
        id: cardId,
        customerId,
        type: CardType.CREDIT,
        rewardsPoints: 1000,
      });

      mockPrisma.account.findFirst.mockResolvedValueOnce({
        id: 'acc-primary',
        customerId,
        status: 'ACTIVE',
      });

      mockPrisma.card.update.mockResolvedValueOnce({ id: cardId });
      mockPrisma.account.update.mockResolvedValueOnce({ id: 'acc-primary' });

      const res = await service.redeemRewards(customerId, cardId);
      expect(res).toEqual({
        status: 'success',
        cashbackCredited: 250, // 1000 * 0.25
        creditedAccountId: 'acc-primary',
      });
      expect(mockPrisma.card.update).toHaveBeenCalledWith({
        where: { id: cardId },
        data: { rewardsPoints: 0 },
      });
      expect(mockPrisma.account.update).toHaveBeenCalledWith({
        where: { id: 'acc-primary' },
        data: { balance: { increment: 250 } },
      });
    });
  });

  describe('toggleAutoPay', () => {
    it('should set autoPayEnabled boolean value', async () => {
      mockPrisma.card.findUnique.mockResolvedValueOnce({
        id: 'c-1',
        customerId: 'cust-1',
        type: CardType.CREDIT,
      });
      mockPrisma.card.update.mockResolvedValueOnce({
        id: 'c-1',
        autoPayEnabled: true,
      });

      const res = await service.toggleAutoPay('cust-1', 'c-1', true);
      expect(res.autoPayEnabled).toBe(true);
      expect(mockPrisma.card.update).toHaveBeenCalledWith({
        where: { id: 'c-1' },
        data: { autoPayEnabled: true },
      });
    });
  });
});
