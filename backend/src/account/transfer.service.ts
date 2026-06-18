import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { randomInt } from 'node:crypto';
import * as speakeasy from 'speakeasy';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../cache/redis.service';
import { EmailService } from '../email/email.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { InitiateTransferDto } from './dto/transfer.dto';
import { TransferStatus, TransferType } from '@prisma/client';

@Injectable()
export class TransferService implements OnModuleInit, OnModuleDestroy {
  private intervalId: any;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly emailService: EmailService,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  onModuleInit() {
    // Start interval to process scheduled transfers every 30 seconds
    this.intervalId = setInterval(() => {
      this.processScheduledTransfers().catch((err) => {
        console.error('Error processing scheduled transfers:', err);
      });
    }, 30000);
  }

  onModuleDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  // ==========================================
  // INITIATE TRANSFER
  // ==========================================

  async initiateTransfer(customerId: string, dto: InitiateTransferDto) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    if (customer.status !== 'APPROVED') {
      throw new ForbiddenException('Your profile onboarding is not approved');
    }

    // Verify source account ownership & status
    const sourceAccount = await this.prisma.account.findUnique({
      where: { id: dto.sourceAccountId },
    });

    if (!sourceAccount) {
      throw new NotFoundException('Source account not found');
    }

    if (sourceAccount.customerId !== customerId) {
      throw new ForbiddenException('You do not own the source account');
    }

    if (sourceAccount.status !== 'ACTIVE') {
      throw new BadRequestException('Source account is not active');
    }

    // Verify balance
    if (Number(sourceAccount.balance) < dto.amount) {
      throw new BadRequestException('Insufficient funds in source account');
    }

    // Verify target account for OWN_ACCOUNT or INTERNAL
    if (
      dto.type === TransferType.OWN_ACCOUNT ||
      dto.type === TransferType.INTERNAL
    ) {
      if (!dto.destinationAccountId) {
        throw new BadRequestException(
          'Destination account ID is required for internal transfers',
        );
      }

      const destAccount = await this.prisma.account.findUnique({
        where: { id: dto.destinationAccountId },
      });

      if (!destAccount) {
        throw new NotFoundException('Destination account not found');
      }

      if (destAccount.status !== 'ACTIVE') {
        throw new BadRequestException('Destination account is not active');
      }

      if (
        dto.type === TransferType.OWN_ACCOUNT &&
        destAccount.customerId !== customerId
      ) {
        throw new BadRequestException(
          'Destination account must be owned by you',
        );
      }
    }

    // Generate reference code
    const reference = 'TRF-' + randomInt(100000, 999999).toString();

    // Create DRAFT transfer in DB
    const transfer = await this.prisma.transfer.create({
      data: {
        reference,
        customerId,
        sourceAccountId: dto.sourceAccountId,
        destinationAccountId: dto.destinationAccountId || null,
        recipientDetails: dto.recipientDetails || null,
        type: dto.type,
        amount: dto.amount,
        scheduledFor: dto.scheduledFor ? new Date(dto.scheduledFor) : null,
        status: TransferStatus.DRAFT,
      },
    });

    // Generate 6-digit OTP code
    const otpCode = randomInt(100000, 999999).toString();

    // Store in Redis (valid for 5 mins)
    await this.redisService.setOtp(`transfer:${transfer.id}`, otpCode, 300);

    // Send OTP email
    try {
      await this.emailService.sendTemplateEmail(
        'otp',
        { email: customer.email },
        { code: otpCode },
      );
    } catch (err) {
      // In sandbox mode, log code to console
      console.log(
        `[SANDBOX TRANSFER OTP] Transfer Reference: ${reference} | Code: ${otpCode}`,
      );
    }

    const needs2fa = customer.twoFactorEnabled;

    // Update status to OTP_PENDING or 2FA_PENDING
    await this.prisma.transfer.update({
      where: { id: transfer.id },
      data: { status: TransferStatus.OTP_PENDING },
    });

    return {
      transferId: transfer.id,
      reference,
      needs2fa,
      // For developer testing ease in sandbox:
      sandboxOtpCode: otpCode,
    };
  }

  // ==========================================
  // VERIFY 2FA TOTP (Optional Step)
  // ==========================================

  async verifyTransfer2Fa(
    customerId: string,
    transferId: string,
    code: string,
  ) {
    const transfer = await this.prisma.transfer.findUnique({
      where: { id: transferId },
    });

    if (!transfer) {
      throw new NotFoundException('Transfer not found');
    }

    if (transfer.customerId !== customerId) {
      throw new ForbiddenException('Access denied');
    }

    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer?.twoFactorSecret) {
      throw new BadRequestException('2FA is not enabled on your profile');
    }

    const verified = speakeasy.totp.verify({
      secret: customer.twoFactorSecret,
      encoding: 'base32',
      token: code,
      window: 1,
    });

    if (!verified) {
      throw new BadRequestException('Invalid 2FA code');
    }

    return { status: '2fa_ok' };
  }

  // ==========================================
  // VERIFY OTP & EXECUTE
  // ==========================================

  async verifyTransferOtp(
    customerId: string,
    transferId: string,
    code: string,
  ) {
    const transfer = await this.prisma.transfer.findUnique({
      where: { id: transferId },
    });

    if (!transfer) {
      throw new NotFoundException('Transfer not found');
    }

    if (transfer.customerId !== customerId) {
      throw new ForbiddenException('Access denied');
    }

    // Verify OTP from Redis
    const cachedCode = await this.redisService.getOtp(`transfer:${transferId}`);
    if (!cachedCode || cachedCode !== code) {
      throw new BadRequestException('Invalid or expired verification code');
    }

    // Delete OTP from Redis
    await this.redisService.deleteOtp(`transfer:${transferId}`);

    // If it is a scheduled transfer, set status to SCHEDULED and return
    if (transfer.scheduledFor && transfer.scheduledFor > new Date()) {
      const updatedTransfer = await this.prisma.transfer.update({
        where: { id: transferId },
        data: { status: TransferStatus.SCHEDULED },
      });

      // Audit log
      await this.prisma.auditLog.create({
        data: {
          action: 'TRANSFER_SCHEDULED',
          entityType: 'Transfer',
          entityId: transferId,
        },
      });

      return {
        status: 'SCHEDULED',
        transfer: updatedTransfer,
      };
    }

    // Immediate Execution
    return this.executeTransfer(transferId);
  }

  // ==========================================
  // EXECUTE TRANSFER (Updates balances, creates audits & sends sockets)
  // ==========================================

  private async executeTransfer(transferId: string) {
    // Start transactional execution
    return this.prisma.$transaction(async (tx) => {
      const transfer = await tx.transfer.findUnique({
        where: { id: transferId },
        include: {
          customer: true,
        },
      });

      if (!transfer) {
        throw new NotFoundException('Transfer record not found');
      }

      if (transfer.status === TransferStatus.COMPLETED) {
        return { status: 'COMPLETED', transfer };
      }

      const sourceAccount = await tx.account.findUnique({
        where: { id: transfer.sourceAccountId || '' },
      });

      if (!sourceAccount) {
        throw new NotFoundException('Source account not found');
      }

      if (Number(sourceAccount.balance) < Number(transfer.amount)) {
        // Mark failed
        const failed = await tx.transfer.update({
          where: { id: transferId },
          data: { status: TransferStatus.FAILED },
        });
        return { status: 'FAILED', transfer: failed };
      }

      // ----------------- FRAUD & RISK RULES CHECK -----------------
      // Rule 1: Large Transaction Hold (> 1,000,000 INR)
      const isLargeTransaction = Number(transfer.amount) > 1000000;

      // Rule 2: Rapid Transfers / Velocity Limits (>= 3 completed/held transfers in last 2 minutes)
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
      const recentTransfersCount = await tx.transfer.count({
        where: {
          customerId: transfer.customerId,
          status: {
            in: [TransferStatus.COMPLETED, TransferStatus.RISK_REVIEW],
          },
          createdAt: { gte: twoMinutesAgo },
          id: { not: transferId },
        },
      });
      const isVelocityExceeded = recentTransfersCount >= 2; // Including current transaction makes it 3rd

      if (isLargeTransaction || isVelocityExceeded) {
        const updated = await tx.transfer.update({
          where: { id: transferId },
          data: { status: TransferStatus.RISK_REVIEW },
        });

        const alertAction = isLargeTransaction
          ? 'LARGE_TRANSACTION_TRIGGERED'
          : 'RAPID_TRANSFERS_TRIGGERED';

        await tx.auditLog.create({
          data: {
            customerId: transfer.customerId,
            action: alertAction,
            entityType: 'Transfer',
            entityId: transferId,
            ipAddress: 'system',
            userAgent: 'system',
          },
        });

        await tx.notification.create({
          data: {
            customerId: transfer.customerId,
            title: 'Transfer Held for Review',
            message: `Your transfer of INR ${Number(transfer.amount).toLocaleString()} is held for compliance and risk review.`,
            category: 'FRAUD',
            read: false,
          },
        });

        return {
          status: 'RISK_REVIEW',
          transfer: updated,
        };
      }
      // -------------------------------------------------------------

      // Deduct balance from source
      await tx.account.update({
        where: { id: transfer.sourceAccountId || '' },
        data: {
          balance: { decrement: transfer.amount },
        },
      });

      // Credit destination if internal or own account
      if (
        (transfer.type === TransferType.OWN_ACCOUNT ||
          transfer.type === TransferType.INTERNAL) &&
        transfer.destinationAccountId
      ) {
        await tx.account.update({
          where: { id: transfer.destinationAccountId },
          data: {
            balance: { increment: transfer.amount },
          },
        });
      }

      // Complete transfer
      const completed = await tx.transfer.update({
        where: { id: transferId },
        data: { status: TransferStatus.COMPLETED },
      });

      // Create system audit log
      await tx.auditLog.create({
        data: {
          customerId: transfer.customerId,
          action: `TRANSFER_COMPLETED_REF_${transfer.reference}`,
          entityType: 'Transfer',
          entityId: transferId,
        },
      });

      // Send websocket realtime alert
      try {
        this.realtimeGateway.server.emit('money-transfer', {
          reference: transfer.reference,
          amount: Number(transfer.amount),
          status: 'COMPLETED',
          type: transfer.type,
          message: `INR ${Number(transfer.amount).toLocaleString()} transfer completed.`,
        });
      } catch (err) {
        // Socket server not connected/booted
      }

      // Send alert email
      try {
        await this.emailService.sendTemplateEmail('transfer-alert', {
          email: transfer.customer.email,
        });
      } catch (err) {
        // Sandbox mode
      }

      return {
        status: 'COMPLETED',
        transfer: completed,
      };
    });
  }

  // ==========================================
  // SCHEDULED TRANSFERS PROCESSOR
  // ==========================================

  async processScheduledTransfers() {
    const pending = await this.prisma.transfer.findMany({
      where: {
        status: TransferStatus.SCHEDULED,
        scheduledFor: {
          lte: new Date(),
        },
      },
    });

    for (const t of pending) {
      try {
        await this.executeTransfer(t.id);
      } catch (err) {
        console.error(
          `Failed to process scheduled transfer ${t.reference}:`,
          err,
        );
      }
    }
  }

  // ==========================================
  // QUERY TRANSFERS
  // ==========================================

  async getTransferHistory(customerId: string) {
    return this.prisma.transfer.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      include: {
        sourceAccount: {
          select: { accountNumber: true, type: true },
        },
        destinationAccount: {
          select: { accountNumber: true, type: true },
        },
      },
    });
  }

  async getAllTransfers() {
    return this.prisma.transfer.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        customer: {
          select: { fullName: true, email: true },
        },
        sourceAccount: {
          select: { accountNumber: true },
        },
        destinationAccount: {
          select: { accountNumber: true },
        },
      },
    });
  }

  async getAuditLogs() {
    return this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        actor: {
          select: { fullName: true, email: true, role: true },
        },
        customer: {
          select: { fullName: true, email: true },
        },
      },
    });
  }

  async cancelScheduledTransfer(customerId: string, id: string) {
    const transfer = await this.prisma.transfer.findUnique({
      where: { id },
    });

    if (!transfer) {
      throw new NotFoundException('Transfer not found');
    }

    if (transfer.customerId !== customerId) {
      throw new ForbiddenException('Access denied');
    }

    if (transfer.status !== TransferStatus.SCHEDULED) {
      throw new BadRequestException(
        'Only scheduled transfers can be cancelled',
      );
    }

    return this.prisma.transfer.update({
      where: { id },
      data: { status: TransferStatus.CANCELLED },
    });
  }

  // ==========================================
  // RISK & COMPLIANCE ACTIONS
  // ==========================================

  async getPendingRiskReviews() {
    return this.prisma.transfer.findMany({
      where: { status: TransferStatus.RISK_REVIEW },
      orderBy: { createdAt: 'desc' },
      include: {
        customer: {
          select: { fullName: true, email: true },
        },
        sourceAccount: {
          select: { accountNumber: true },
        },
        destinationAccount: {
          select: { accountNumber: true },
        },
      },
    });
  }

  async reviewTransfer(
    id: string,
    approve: boolean,
    employeeId: string,
    comment?: string,
  ) {
    const transfer = await this.prisma.transfer.findUnique({
      where: { id },
      include: { customer: true },
    });

    if (!transfer) {
      throw new NotFoundException('Transfer not found');
    }

    if (transfer.status !== TransferStatus.RISK_REVIEW) {
      throw new BadRequestException('Transfer is not in RISK_REVIEW status');
    }

    if (!approve) {
      const updated = await this.prisma.transfer.update({
        where: { id },
        data: { status: TransferStatus.FAILED },
      });

      await this.prisma.auditLog.create({
        data: {
          actorId: employeeId,
          action: `TRANSFER_REJECTED_REF_${transfer.reference}`,
          entityType: 'Transfer',
          entityId: id,
          ipAddress: 'system',
          userAgent: 'system',
        },
      });

      await this.prisma.notification.create({
        data: {
          customerId: transfer.customerId,
          title: 'Transfer Rejected',
          message: `Your transfer of INR ${Number(transfer.amount).toLocaleString()} was rejected by Compliance/Risk Officers. ${comment ? `Reason: ${comment}` : ''}`,
          category: 'FRAUD',
          read: false,
        },
      });

      return { status: 'FAILED', transfer: updated };
    }

    return this.prisma.$transaction(async (tx) => {
      const sourceAccount = await tx.account.findUnique({
        where: { id: transfer.sourceAccountId || '' },
      });

      if (!sourceAccount) {
        throw new NotFoundException('Source account not found');
      }

      if (Number(sourceAccount.balance) < Number(transfer.amount)) {
        const failed = await tx.transfer.update({
          where: { id },
          data: { status: TransferStatus.FAILED },
        });
        return { status: 'FAILED', transfer: failed };
      }

      // Deduct balance from source
      await tx.account.update({
        where: { id: transfer.sourceAccountId || '' },
        data: {
          balance: { decrement: transfer.amount },
        },
      });

      // Credit destination if internal or own account
      if (
        (transfer.type === TransferType.OWN_ACCOUNT ||
          transfer.type === TransferType.INTERNAL) &&
        transfer.destinationAccountId
      ) {
        await tx.account.update({
          where: { id: transfer.destinationAccountId },
          data: {
            balance: { increment: transfer.amount },
          },
        });
      }

      // Complete transfer
      const completed = await tx.transfer.update({
        where: { id },
        data: { status: TransferStatus.COMPLETED },
      });

      // Create system audit log including the employee reviewer actorId
      await tx.auditLog.create({
        data: {
          actorId: employeeId,
          action: `TRANSFER_APPROVED_REF_${transfer.reference}`,
          entityType: 'Transfer',
          entityId: id,
          ipAddress: 'system',
          userAgent: 'system',
        },
      });

      // Send websocket realtime alert
      try {
        this.realtimeGateway.server.emit('money-transfer', {
          reference: transfer.reference,
          amount: Number(transfer.amount),
          status: 'COMPLETED',
          type: transfer.type,
          message: `INR ${Number(transfer.amount).toLocaleString()} transfer completed after Risk review.`,
        });
      } catch (err) {}

      // Send alert email
      try {
        await this.emailService.sendTemplateEmail('transfer-alert', {
          email: transfer.customer.email,
        });
      } catch (err) {}

      return {
        status: 'COMPLETED',
        transfer: completed,
      };
    });
  }
}
