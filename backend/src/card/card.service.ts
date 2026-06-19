import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomInt } from 'node:crypto';
import { PrismaService } from '../database/prisma.service';
import { CardStatus, CardType } from '@prisma/client';
import {
  CreateCreditCardDto,
  CreateDebitCardDto,
  UpdateLimitsDto,
  PayBillDto,
} from './dto/card.dto';

const CARD_TRANSACTION_LIMIT = 25;
const ADMIN_CARD_LIMIT = 200;

@Injectable()
export class CardService {
  constructor(private readonly prisma: PrismaService) {}

  // Helper generators
  private generateCardNumber(prefix: string): string {
    let num = prefix;
    while (num.length < 16) {
      num += randomInt(0, 10).toString();
    }
    return num.replace(/(\d{4})/g, '$1 ').trim();
  }

  private generateCvv(): string {
    return randomInt(100, 1000).toString();
  }

  private generateExpiryDate(): string {
    const d = new Date();
    const year = (d.getFullYear() + 5).toString().slice(-2);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${month}/${year}`;
  }

  private maskCardNumber(cardNum: string): string {
    const parts = cardNum.split(' ');
    if (parts.length === 4) {
      return `${parts[0]} ${parts[1].slice(0, 2)}** **** ${parts[3]}`;
    }
    return cardNum;
  }

  // ==========================================
  // GET CARDS
  // ==========================================
  async getCards(customerId: string) {
    return this.prisma.card.findMany({
      where: { customerId },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: CARD_TRANSACTION_LIMIT,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ==========================================
  // CREATE DEBIT CARD
  // ==========================================
  async createDebitCard(customerId: string, dto: CreateDebitCardDto) {
    const account = await this.prisma.account.findUnique({
      where: { id: dto.accountId },
    });

    if (!account) {
      throw new NotFoundException('Account not found');
    }

    if (account.customerId !== customerId) {
      throw new ForbiddenException('You do not own this account');
    }

    if (account.status !== 'ACTIVE') {
      throw new BadRequestException('Account is not active');
    }

    const cardNum = this.generateCardNumber('4'); // Visa Debit
    const maskedNumber = this.maskCardNumber(cardNum);
    const expiryDate = this.generateExpiryDate();
    const cvv = this.generateCvv();

    const card = await this.prisma.card.create({
      data: {
        customerId,
        type: CardType.DEBIT,
        cardNumber: cardNum,
        maskedNumber,
        expiryDate,
        cvv,
        status: CardStatus.ACTIVE,
        accountId: dto.accountId,
        dailyLimit: 100000,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        action: `DEBIT_CARD_CREATED_REF_${card.id.slice(0, 8)}`,
        entityType: 'Card',
        entityId: card.id,
      },
    });

    return card;
  }

  // ==========================================
  // APPLY CREDIT CARD
  // ==========================================
  async applyCreditCard(customerId: string, dto: CreateCreditCardDto) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    if (customer.status !== 'APPROVED') {
      throw new ForbiddenException('Profile onboarding must be approved first');
    }

    // Assign limit based on tier
    let creditLimit = 50000;
    if (dto.tier === 'GOLD') creditLimit = 150000;
    if (dto.tier === 'PLATINUM') creditLimit = 500000;

    if (dto.requestedLimit && dto.requestedLimit < creditLimit) {
      creditLimit = dto.requestedLimit;
    }

    const cardNum = this.generateCardNumber('5'); // Mastercard Credit
    const maskedNumber = this.maskCardNumber(cardNum);
    const expiryDate = this.generateExpiryDate();
    const cvv = this.generateCvv();

    const card = await this.prisma.card.create({
      data: {
        customerId,
        type: CardType.CREDIT,
        cardNumber: cardNum,
        maskedNumber,
        expiryDate,
        cvv,
        status: CardStatus.INACTIVE, // Apply -> INACTIVE (requires customer activation)
        creditLimit,
        availableCredit: creditLimit,
        dailyLimit: creditLimit,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        action: `CREDIT_CARD_APPLIED_REF_${card.id.slice(0, 8)}`,
        entityType: 'Card',
        entityId: card.id,
      },
    });

    return card;
  }

  // ==========================================
  // ACTIVATE CARD (Customer self-service activation)
  // ==========================================
  async activateCard(customerId: string, cardId: string) {
    const card = await this.prisma.card.findUnique({
      where: { id: cardId },
    });

    if (!card) {
      throw new NotFoundException('Card not found');
    }

    if (card.customerId !== customerId) {
      throw new ForbiddenException('Access denied');
    }

    if (card.status !== CardStatus.INACTIVE) {
      throw new BadRequestException('Card is already activated or blocked');
    }

    const updatedCard = await this.prisma.card.update({
      where: { id: cardId },
      data: { status: CardStatus.ACTIVE },
    });

    // Seed some mock transactions so they can try out EMIs
    if (card.type === CardType.CREDIT) {
      await this.prisma.cardTransaction.createMany({
        data: [
          {
            cardId,
            amount: 15400,
            description: 'Amazon Electronics Bangalore',
          },
          {
            cardId,
            amount: 5200,
            description: 'Nike Store Terminal 2',
          },
          {
            cardId,
            amount: 799,
            description: 'Netflix Entertainment Monthly',
          },
        ],
      });

      // Update balance & available credit to match the seed transactions
      const totalSpent = 15400 + 5200 + 799;
      const limit = Number(card.creditLimit || 0);
      await this.prisma.card.update({
        where: { id: cardId },
        data: {
          balance: totalSpent,
          availableCredit: limit - totalSpent,
          rewardsPoints: Math.floor(totalSpent * 0.05), // 5% points rewards
        },
      });
    }

    await this.prisma.auditLog.create({
      data: {
        action: `CARD_ACTIVATED_ID_${cardId.slice(0, 8)}`,
        entityType: 'Card',
        entityId: cardId,
      },
    });

    return this.prisma.card.findUnique({
      where: { id: cardId },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: CARD_TRANSACTION_LIMIT,
        },
      },
    });
  }

  // ==========================================
  // SET / CHANGE CARD STATUS
  // ==========================================
  async updateCardStatus(
    customerId: string,
    cardId: string,
    status: CardStatus,
  ) {
    const card = await this.prisma.card.findUnique({
      where: { id: cardId },
    });

    if (!card) {
      throw new NotFoundException('Card not found');
    }

    if (card.customerId !== customerId) {
      throw new ForbiddenException('Access denied');
    }

    const updated = await this.prisma.card.update({
      where: { id: cardId },
      data: { status },
    });

    await this.prisma.auditLog.create({
      data: {
        action: `CARD_STATUS_UPDATE_${status}_ID_${cardId.slice(0, 8)}`,
        entityType: 'Card',
        entityId: cardId,
      },
    });

    return updated;
  }

  // ==========================================
  // UPDATE LIMITS
  // ==========================================
  async updateLimits(customerId: string, cardId: string, dto: UpdateLimitsDto) {
    const card = await this.prisma.card.findUnique({
      where: { id: cardId },
    });

    if (!card) {
      throw new NotFoundException('Card not found');
    }

    if (card.customerId !== customerId) {
      throw new ForbiddenException('Access denied');
    }

    const updated = await this.prisma.card.update({
      where: { id: cardId },
      data: {
        atmEnabled: dto.atmEnabled !== undefined ? dto.atmEnabled : undefined,
        onlineEnabled:
          dto.onlineEnabled !== undefined ? dto.onlineEnabled : undefined,
        contactlessEnabled:
          dto.contactlessEnabled !== undefined
            ? dto.contactlessEnabled
            : undefined,
        internationalEnabled:
          dto.internationalEnabled !== undefined
            ? dto.internationalEnabled
            : undefined,
        dailyLimit: dto.dailyLimit !== undefined ? dto.dailyLimit : undefined,
        atmLimit: dto.atmLimit !== undefined ? dto.atmLimit : undefined,
        onlineLimit:
          dto.onlineLimit !== undefined ? dto.onlineLimit : undefined,
        contactlessLimit:
          dto.contactlessLimit !== undefined ? dto.contactlessLimit : undefined,
        internationalLimit:
          dto.internationalLimit !== undefined
            ? dto.internationalLimit
            : undefined,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        action: `CARD_LIMITS_UPDATED_ID_${cardId.slice(0, 8)}`,
        entityType: 'Card',
        entityId: cardId,
      },
    });

    return updated;
  }

  // ==========================================
  // UPDATE PIN
  // ==========================================
  async updatePin(customerId: string, cardId: string, pin: string) {
    const card = await this.prisma.card.findUnique({
      where: { id: cardId },
    });

    if (!card) {
      throw new NotFoundException('Card not found');
    }

    if (card.customerId !== customerId) {
      throw new ForbiddenException('Access denied');
    }

    const pinHash = await bcrypt.hash(pin, 10);

    const updated = await this.prisma.card.update({
      where: { id: cardId },
      data: { pinHash },
    });

    await this.prisma.auditLog.create({
      data: {
        action: `CARD_PIN_UPDATED_ID_${cardId.slice(0, 8)}`,
        entityType: 'Card',
        entityId: cardId,
      },
    });

    return { status: 'success', message: 'Card PIN updated successfully' };
  }

  // ==========================================
  // PAY CREDIT CARD BILL
  // ==========================================
  async payCreditCardBill(customerId: string, cardId: string, dto: PayBillDto) {
    const card = await this.prisma.card.findUnique({
      where: { id: cardId },
    });

    if (!card || card.type !== CardType.CREDIT) {
      throw new NotFoundException('Credit card not found');
    }

    if (card.customerId !== customerId) {
      throw new ForbiddenException('Access denied');
    }

    if (card.status !== CardStatus.ACTIVE) {
      throw new BadRequestException('Credit card is not active');
    }

    const account = await this.prisma.account.findUnique({
      where: { id: dto.accountId },
    });

    if (!account) {
      throw new NotFoundException('Billing source account not found');
    }

    if (account.customerId !== customerId) {
      throw new ForbiddenException('You do not own this billing account');
    }

    if (account.status !== 'ACTIVE') {
      throw new BadRequestException('Source account is not active');
    }

    if (Number(account.balance) < dto.amount) {
      throw new BadRequestException('Insufficient funds in source account');
    }

    // Execute atomic transaction
    return this.prisma.$transaction(async (tx) => {
      // Deduct account balance
      await tx.account.update({
        where: { id: dto.accountId },
        data: {
          balance: { decrement: dto.amount },
        },
      });

      // Reduce credit card outstanding balance, increase available credit
      const updatedCard = await tx.card.update({
        where: { id: cardId },
        data: {
          balance: { decrement: dto.amount },
          availableCredit: { increment: dto.amount },
        },
      });

      // Log transaction
      const trans = await tx.cardTransaction.create({
        data: {
          cardId,
          amount: -dto.amount, // negative implies bill payment
          description: `Bill Payment - Ref Account ${account.accountNumber.slice(-4)}`,
        },
      });

      // Log system audit
      await tx.auditLog.create({
        data: {
          action: `CREDIT_CARD_BILL_PAID_AMT_${dto.amount}_REF_${cardId.slice(0, 8)}`,
          entityType: 'Card',
          entityId: cardId,
        },
      });

      return {
        status: 'success',
        transaction: trans,
        card: updatedCard,
      };
    });
  }

  // ==========================================
  // CONVERT TO EMI
  // ==========================================
  async convertToEmi(
    customerId: string,
    transactionId: string,
    months: number,
  ) {
    const transaction = await this.prisma.cardTransaction.findUnique({
      where: { id: transactionId },
      include: { card: true },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    if (transaction.card.customerId !== customerId) {
      throw new ForbiddenException('Access denied');
    }

    if (transaction.isEmi) {
      throw new BadRequestException('Transaction is already converted to EMI');
    }

    if (Number(transaction.amount) <= 0) {
      throw new BadRequestException(
        'Only purchases (debit charges) can be converted to EMI',
      );
    }

    // Standard interest rate e.g. 14.5%
    const updatedTrans = await this.prisma.cardTransaction.update({
      where: { id: transactionId },
      data: {
        isEmi: true,
        emiMonths: months,
        emiInterestRate: 14.5,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        action: `TRANSACTION_CONVERTED_EMI_MONTHS_${months}_ID_${transactionId.slice(0, 8)}`,
        entityType: 'CardTransaction',
        entityId: transactionId,
      },
    });

    return updatedTrans;
  }

  // ==========================================
  // REDEEM REWARDS
  // ==========================================
  async redeemRewards(customerId: string, cardId: string) {
    const card = await this.prisma.card.findUnique({
      where: { id: cardId },
    });

    if (!card || card.type !== CardType.CREDIT) {
      throw new NotFoundException('Credit card not found');
    }

    if (card.customerId !== customerId) {
      throw new ForbiddenException('Access denied');
    }

    if (card.rewardsPoints <= 0) {
      throw new BadRequestException('No rewards points to redeem');
    }

    // Find first active savings/current account to credit cash back (1 point = 0.25 INR)
    const cashbackAmount = card.rewardsPoints * 0.25;

    const account = await this.prisma.account.findFirst({
      where: {
        customerId,
        status: 'ACTIVE',
        type: { in: ['SAVINGS', 'CURRENT', 'SALARY'] },
      },
    });

    if (!account) {
      throw new BadRequestException(
        'No active savings or current account found to credit rewards',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // Zero out points
      await tx.card.update({
        where: { id: cardId },
        data: {
          rewardsPoints: 0,
        },
      });

      // Increment account balance
      await tx.account.update({
        where: { id: account.id },
        data: {
          balance: { increment: cashbackAmount },
        },
      });

      await tx.auditLog.create({
        data: {
          action: `REWARDS_REDEEMED_CASHBACK_${cashbackAmount}_POINTS_${card.rewardsPoints}`,
          entityType: 'Card',
          entityId: cardId,
        },
      });

      return {
        status: 'success',
        cashbackCredited: cashbackAmount,
        creditedAccountId: account.id,
      };
    });
  }

  // ==========================================
  // TOGGLE AUTOPAY
  // ==========================================
  async toggleAutoPay(customerId: string, cardId: string, enabled: boolean) {
    const card = await this.prisma.card.findUnique({
      where: { id: cardId },
    });

    if (!card || card.type !== CardType.CREDIT) {
      throw new NotFoundException('Credit card not found');
    }

    if (card.customerId !== customerId) {
      throw new ForbiddenException('Access denied');
    }

    const updated = await this.prisma.card.update({
      where: { id: cardId },
      data: {
        autoPayEnabled: enabled,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        action: `AUTOPAY_TOGGLED_${enabled ? 'ON' : 'OFF'}_ID_${cardId.slice(0, 8)}`,
        entityType: 'Card',
        entityId: cardId,
      },
    });

    return updated;
  }

  // ==========================================
  // ADMIN FUNCTIONS
  // ==========================================
  async getAllCardsAdmin() {
    return this.prisma.card.findMany({
      orderBy: { createdAt: 'desc' },
      take: ADMIN_CARD_LIMIT,
      include: {
        customer: {
          select: { fullName: true, email: true },
        },
      },
    });
  }

  async adminApproveCard(cardId: string) {
    const card = await this.prisma.card.findUnique({
      where: { id: cardId },
    });

    if (!card) {
      throw new NotFoundException('Card not found');
    }

    // Move applied credit cards from INACTIVE to ACTIVE (or customer can activate)
    // Here we let admin activate/approve it directly
    const updated = await this.prisma.card.update({
      where: { id: cardId },
      data: { status: CardStatus.ACTIVE },
    });

    await this.prisma.auditLog.create({
      data: {
        action: `ADMIN_APPROVED_CARD_ID_${cardId.slice(0, 8)}`,
        entityType: 'Card',
        entityId: cardId,
      },
    });

    return updated;
  }
}
