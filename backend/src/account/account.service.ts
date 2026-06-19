import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { PrismaService } from '../database/prisma.service';
import { StorageService } from '../storage/storage.service';
import {
  CreateAccountDto,
  CreateBeneficiaryDto,
  UpdateAccountDto,
  UpdateBeneficiaryDto,
} from './dto/account.dto';
import { AccountStatus, AccountType, Prisma } from '@prisma/client';
import { RedisService } from '../cache/redis.service';

const CUSTOMER_LIST_LIMIT = 100;
const ADMIN_LIST_LIMIT = 200;
const READ_CACHE_TTL_SECONDS = 15;

@Injectable()
export class AccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly redis: RedisService,
  ) {}

  private async readCached<T>(
    key: string,
    producer: () => Promise<T>,
  ): Promise<T> {
    const cached = await this.redis.getJsonCache<T>(key);
    if (cached) {
      return cached;
    }

    const value = await producer();
    await this.redis.setJsonCache(key, value, READ_CACHE_TTL_SECONDS);
    return value;
  }

  private async invalidateAccountCaches(customerId?: string | null) {
    await this.redis.deleteCacheSilently('accounts:admin:v1');

    if (customerId) {
      await this.redis.deleteCacheSilently(
        `accounts:customer:${customerId}:v1`,
      );
    }
  }

  private async invalidateBeneficiaryCaches(customerId?: string | null) {
    if (customerId) {
      await this.redis.deleteCacheSilently(
        `beneficiaries:customer:${customerId}:v1`,
      );
    }
  }

  // ==========================================
  // ACCOUNTS LIFE CYCLE
  // ==========================================

  async createAccount(dto: CreateAccountDto) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: dto.customerId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    // Generate unique account number
    let accountNumber = '';
    let isUnique = false;
    while (!isUnique) {
      accountNumber = 'ACC-' + randomInt(10000000, 99999999).toString();
      const existing = await this.prisma.account.findUnique({
        where: { accountNumber },
      });
      if (!existing) {
        isUnique = true;
      }
    }

    // Map type safely
    const typeValue = dto.type.toUpperCase() as AccountType;
    if (!Object.values(AccountType).includes(typeValue)) {
      throw new BadRequestException(`Invalid account type: ${dto.type}`);
    }

    const account = await this.prisma.account.create({
      data: {
        accountNumber,
        type: typeValue,
        currency: dto.currency || 'INR',
        balance: dto.balance !== undefined ? dto.balance : 0.0,
        interestRate: dto.interestRate !== undefined ? dto.interestRate : 0.0,
        ifsc: dto.ifsc || 'NEXB0000001',
        branchCode: dto.branchCode || 'HQ001',
        customerId: dto.customerId,
        status: AccountStatus.ACTIVE,
      },
    });

    await this.invalidateAccountCaches(dto.customerId);
    return account;
  }

  async getAccountsForCustomer(customerId: string) {
    return this.readCached(`accounts:customer:${customerId}:v1`, () =>
      this.prisma.account.findMany({
        where: { customerId },
        orderBy: { createdAt: 'desc' },
        take: CUSTOMER_LIST_LIMIT,
      }),
    );
  }

  async getAllAccounts() {
    return this.readCached('accounts:admin:v1', () =>
      this.prisma.account.findMany({
        include: {
          customer: {
            select: {
              id: true,
              fullName: true,
              email: true,
              phone: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: ADMIN_LIST_LIMIT,
      }),
    );
  }

  async updateAccount(id: string, dto: UpdateAccountDto) {
    const account = await this.prisma.account.findUnique({
      where: { id },
    });

    if (!account) {
      throw new NotFoundException('Account not found');
    }

    const updateData: Prisma.AccountUpdateInput = {};
    if (dto.type) {
      const typeValue = dto.type.toUpperCase() as AccountType;
      if (!Object.values(AccountType).includes(typeValue)) {
        throw new BadRequestException(`Invalid account type: ${dto.type}`);
      }
      updateData.type = typeValue;
    }
    if (dto.interestRate !== undefined) {
      updateData.interestRate = dto.interestRate;
    }
    if (dto.ifsc) {
      updateData.ifsc = dto.ifsc;
    }
    if (dto.branchCode) {
      updateData.branchCode = dto.branchCode;
    }

    const updated = await this.prisma.account.update({
      where: { id },
      data: updateData,
    });

    await this.invalidateAccountCaches(account.customerId);
    return updated;
  }

  async deleteAccount(id: string) {
    const account = await this.prisma.account.findUnique({
      where: { id },
    });

    if (!account) {
      throw new NotFoundException('Account not found');
    }

    const deleted = await this.prisma.account.delete({
      where: { id },
    });

    await this.invalidateAccountCaches(account.customerId);
    return deleted;
  }

  async toggleAccountStatus(id: string, status: 'ACTIVE' | 'DEACTIVATED') {
    const account = await this.prisma.account.findUnique({
      where: { id },
    });

    if (!account) {
      throw new NotFoundException('Account not found');
    }

    const statusValue = status.toUpperCase() as AccountStatus;
    if (!Object.values(AccountStatus).includes(statusValue)) {
      throw new BadRequestException(`Invalid status value: ${status}`);
    }

    const updated = await this.prisma.account.update({
      where: { id },
      data: { status: statusValue },
    });

    await this.invalidateAccountCaches(account.customerId);
    return updated;
  }

  async customerOwnsAccount(customerId: string, accountId: string) {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, customerId },
      select: { id: true },
    });

    return Boolean(account);
  }

  // ==========================================
  // BENEFICIARIES LIFE CYCLE
  // ==========================================

  async createBeneficiary(customerId: string, dto: CreateBeneficiaryDto) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const beneficiary = await this.prisma.beneficiary.create({
      data: {
        customerId,
        nickname: dto.nickname,
        accountNumber: dto.accountNumber,
        bankName: dto.bankName,
        ifsc: dto.ifsc,
        active: true,
        verified: true, // Auto-verify in sandbox
      },
    });

    await this.invalidateBeneficiaryCaches(customerId);
    return beneficiary;
  }

  async getBeneficiariesForCustomer(customerId: string) {
    return this.readCached(`beneficiaries:customer:${customerId}:v1`, () =>
      this.prisma.beneficiary.findMany({
        where: { customerId },
        orderBy: { createdAt: 'desc' },
        take: CUSTOMER_LIST_LIMIT,
      }),
    );
  }

  async updateBeneficiary(id: string, dto: UpdateBeneficiaryDto) {
    const beneficiary = await this.prisma.beneficiary.findUnique({
      where: { id },
    });

    if (!beneficiary) {
      throw new NotFoundException('Beneficiary not found');
    }

    const updated = await this.prisma.beneficiary.update({
      where: { id },
      data: {
        nickname:
          dto.nickname !== undefined ? dto.nickname : beneficiary.nickname,
        accountNumber:
          dto.accountNumber !== undefined
            ? dto.accountNumber
            : beneficiary.accountNumber,
        bankName:
          dto.bankName !== undefined ? dto.bankName : beneficiary.bankName,
        ifsc: dto.ifsc !== undefined ? dto.ifsc : beneficiary.ifsc,
      },
    });

    await this.invalidateBeneficiaryCaches(beneficiary.customerId);
    return updated;
  }

  async deleteBeneficiary(id: string) {
    const beneficiary = await this.prisma.beneficiary.findUnique({
      where: { id },
    });

    if (!beneficiary) {
      throw new NotFoundException('Beneficiary not found');
    }

    const deleted = await this.prisma.beneficiary.delete({
      where: { id },
    });

    await this.invalidateBeneficiaryCaches(beneficiary.customerId);
    return deleted;
  }

  async toggleBeneficiaryStatus(id: string, active: boolean) {
    const beneficiary = await this.prisma.beneficiary.findUnique({
      where: { id },
    });

    if (!beneficiary) {
      throw new NotFoundException('Beneficiary not found');
    }

    const updated = await this.prisma.beneficiary.update({
      where: { id },
      data: { active },
    });

    await this.invalidateBeneficiaryCaches(beneficiary.customerId);
    return updated;
  }

  async customerOwnsBeneficiary(customerId: string, beneficiaryId: string) {
    const beneficiary = await this.prisma.beneficiary.findFirst({
      where: { id: beneficiaryId, customerId },
      select: { id: true },
    });

    return Boolean(beneficiary);
  }

  // ==========================================
  // STATEMENT GENERATOR
  // ==========================================

  async generateStatement(accountId: string): Promise<{ downloadUrl: string }> {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
      include: {
        customer: {
          select: {
            fullName: true,
            email: true,
          },
        },
      },
    });

    if (!account) {
      throw new NotFoundException('Account not found');
    }

    // Fetch related transaction/transfer history
    const transfers = await this.prisma.transfer.findMany({
      where: {
        OR: [
          { sourceAccountId: accountId },
          { destinationAccountId: accountId },
        ],
        status: 'COMPLETED',
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        reference: true,
        type: true,
        amount: true,
        sourceAccountId: true,
        destinationAccountId: true,
        createdAt: true,
      },
    });

    const dateStr = new Date().toISOString().split('T')[0];

    // Build plain text report
    let statement = `========================================================================\n`;
    statement += `                      NEXUS BANKING SERVICE REPORT                      \n`;
    statement += `                         ACCOUNT STATEMENT                              \n`;
    statement += `========================================================================\n\n`;
    statement += `Account Holder : ${account.customer.fullName}\n`;
    statement += `Account Email  : ${account.customer.email}\n`;
    statement += `Account Number : ${account.accountNumber}\n`;
    statement += `Account Type   : ${account.type}\n`;
    statement += `Interest Rate  : ${account.interestRate}% p.a.\n`;
    statement += `IFSC Code      : ${account.ifsc}\n`;
    statement += `Branch Code    : ${account.branchCode}\n`;
    statement += `Currency       : ${account.currency}\n`;
    statement += `Current Balance: ${account.currency} ${Number(account.balance).toLocaleString()}\n`;
    statement += `Status         : ${account.status}\n`;
    statement += `Statement Date : ${dateStr}\n\n`;
    statement += `------------------------------------------------------------------------\n`;
    statement += `DATE        REFERENCE     TYPE                AMOUNT          FLOW\n`;
    statement += `------------------------------------------------------------------------\n`;

    if (transfers.length === 0) {
      statement += `                 No completed transactions recorded.                    \n`;
    } else {
      for (const t of transfers) {
        const flow =
          t.sourceAccountId === accountId ? 'DEBIT (DR)' : 'CREDIT (CR)';
        const date = new Date(t.createdAt).toISOString().split('T')[0];
        const amt = `${account.currency} ${Number(t.amount).toLocaleString()}`;
        statement += `${date.padEnd(12)}${t.reference.padEnd(14)}${t.type.padEnd(20)}${amt.padEnd(16)}${flow}\n`;
      }
    }
    statement += `------------------------------------------------------------------------\n\n`;
    statement += `Thank you for banking with Nexus. This is an automatically generated\n`;
    statement += `statement in our sandbox demo mode.\n`;
    statement += `========================================================================\n`;

    const buffer = Buffer.from(statement, 'utf-8');
    const objectName = `${account.accountNumber}-statement-${dateStr}-${randomInt(1000, 9999)}.txt`;
    const bucketName = 'statements';

    // Upload to MinIO
    await this.storage.uploadFile(bucketName, objectName, buffer, 'text/plain');

    // Get 1 hour presigned download URL
    const downloadUrl = await this.storage.getPresignedUrl(
      bucketName,
      objectName,
      3600,
    );

    return { downloadUrl };
  }
}
