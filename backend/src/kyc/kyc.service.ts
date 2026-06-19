import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Account,
  EmployeeRole,
  CustomerStatus,
  AccountType,
  KycRequest,
  Prisma,
} from '@prisma/client';
import { randomInt, randomUUID } from 'node:crypto';
import { PrismaService } from '../database/prisma.service';
import { StorageService } from '../storage/storage.service';
import {
  ReviewKycDto,
  ReviewStatus,
  ReviewStep,
  SubmitKycDto,
  UpdateStatusDto,
} from './dto/kyc.dto';

type KycRequestWithCustomer = Prisma.KycRequestGetPayload<{
  include: {
    customer: {
      select: {
        id: true;
        fullName: true;
        email: true;
        phone: true;
        status: true;
      };
    };
  };
}>;

type KycStatusResponse = {
  status: CustomerStatus;
  emailVerified: boolean;
  kycRequest: KycRequest | null;
  accounts: Account[];
};

type ReviewKycResponse = {
  request: KycRequest;
  customerStatus: CustomerStatus;
  accountCreated?: Account;
};

const CUSTOMER_ACCOUNT_LIMIT = 100;
const PENDING_KYC_LIMIT = 100;

@Injectable()
export class KycService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  // 1. Upload file to MinIO
  async uploadKycFile(
    file: { buffer: Buffer; originalname: string; mimetype: string },
    type: 'PHOTO' | 'SIGNATURE' | 'ID_PROOF',
  ): Promise<{ key: string; url: string }> {
    let bucketName = 'kyc';
    if (type === 'PHOTO') {
      bucketName = 'photos';
    } else if (type === 'SIGNATURE') {
      bucketName = 'signatures';
    }

    const fileExtension = file.originalname.split('.').pop() ?? 'bin';
    const objectName = `${randomUUID()}.${fileExtension}`;

    // Upload to MinIO
    const key = await this.storage.uploadFile(
      bucketName,
      objectName,
      file.buffer,
      file.mimetype,
    );

    // Get a temporary presigned URL for confirmation/preview
    const url = await this.storage.getPresignedUrl(
      bucketName,
      objectName,
      3600,
    );

    return { key, url };
  }

  // 2. Submit KYC (Customer)
  async submitKyc(customerId: string, dto: SubmitKycDto): Promise<KycRequest> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    if (
      customer.status !== 'DRAFT' &&
      customer.status !== 'REJECTED' &&
      customer.status !== 'KYC_REVIEW'
    ) {
      throw new BadRequestException(
        `Cannot submit KYC in the current status: ${customer.status}`,
      );
    }

    // Upsert KycRequest
    const kycRequest = await this.prisma.kycRequest.upsert({
      where: { customerId },
      create: {
        customerId,
        idType: dto.idType,
        idNumber: dto.idNumber,
        idDocUrl: dto.idDocKey,
        photoUrl: dto.photoKey,
        signatureUrl: dto.signatureKey,
        documentStatus: 'PENDING',
        riskStatus: 'PENDING',
        complianceStatus: 'PENDING',
        branchStatus: 'PENDING',
      },
      update: {
        idType: dto.idType,
        idNumber: dto.idNumber,
        idDocUrl: dto.idDocKey,
        photoUrl: dto.photoKey,
        signatureUrl: dto.signatureKey,
        documentStatus: 'PENDING',
        documentComment: null,
        documentReviewedBy: null,
        riskStatus: 'PENDING',
        riskComment: null,
        riskReviewedBy: null,
        complianceStatus: 'PENDING',
        complianceComment: null,
        complianceReviewedBy: null,
        branchStatus: 'PENDING',
        branchComment: null,
        branchApprovedBy: null,
      },
    });

    // Update Customer Status to PENDING
    await this.prisma.customer.update({
      where: { id: customerId },
      data: { status: 'PENDING' },
    });

    return kycRequest;
  }

  // 3. Get KYC status (Customer)
  async getKycStatus(customerId: string): Promise<KycStatusResponse> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        kycRequest: true,
        accounts: {
          orderBy: { createdAt: 'desc' },
          take: CUSTOMER_ACCOUNT_LIMIT,
        },
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return {
      status: customer.status,
      emailVerified: customer.emailVerified,
      kycRequest: customer.kycRequest,
      accounts: customer.accounts,
    };
  }

  // 4. List pending KYC requests (Employee)
  async getPendingKycRequests(): Promise<KycRequestWithCustomer[]> {
    const requests = await this.prisma.kycRequest.findMany({
      where: {
        customer: {
          status: 'PENDING',
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: PENDING_KYC_LIMIT,
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
    });

    return requests;
  }

  // 5. Get detailed KYC request with presigned URLs (Employee)
  async getKycRequestDetails(customerId: string): Promise<
    KycRequestWithCustomer & {
      idDocUrl: string | null;
      photoUrl: string | null;
      signatureUrl: string | null;
    }
  > {
    const request = await this.prisma.kycRequest.findUnique({
      where: { customerId },
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
    });

    if (!request) {
      throw new NotFoundException('KYC request not found');
    }

    // Resolve keys to presigned URLs
    const [idDocUrl, photoUrl, signatureUrl] = await Promise.all([
      request.idDocUrl ? this.getResolvedUrl(request.idDocUrl) : null,
      request.photoUrl ? this.getResolvedUrl(request.photoUrl) : null,
      request.signatureUrl ? this.getResolvedUrl(request.signatureUrl) : null,
    ]);

    return {
      ...request,
      idDocUrl,
      photoUrl,
      signatureUrl,
    };
  }

  // Helper to parse "bucket/key" or just "key" and get presigned URL
  private async getResolvedUrl(fileKey: string): Promise<string> {
    const parts = fileKey.split('/');
    if (parts.length >= 2) {
      const bucket = parts[0];
      const key = parts.slice(1).join('/');
      return this.storage.getPresignedUrl(bucket, key, 3600);
    }
    // Fallback/legacy: check kyc bucket
    return this.storage.getPresignedUrl('kyc', fileKey, 3600);
  }

  // 6. Review KYC stage (Employee)
  async reviewKyc(
    reviewerId: string,
    reviewerRole: EmployeeRole,
    dto: ReviewKycDto,
  ): Promise<ReviewKycResponse> {
    const request = await this.prisma.kycRequest.findUnique({
      where: { customerId: dto.customerId },
    });

    if (!request) {
      throw new NotFoundException('KYC request not found');
    }

    // Role-based step validation
    this.validateReviewerRole(dto.step, reviewerRole);

    // Enforce sequential review logic:
    // 1. Document (KYC Officer)
    // 2. Compliance (Compliance Officer) -> Requires Document approved
    // 3. Risk (Risk Officer) -> Requires Compliance approved
    // 4. Branch (Branch Manager) -> Requires Risk approved
    this.validateSequentialFlow(dto.step, request);

    const updateData: Prisma.KycRequestUpdateInput = {};
    const comment = dto.comment || '';

    if (dto.step === ReviewStep.DOCUMENT) {
      updateData.documentStatus = dto.status;
      updateData.documentComment = comment;
      updateData.documentReviewedBy = reviewerId;
    } else if (dto.step === ReviewStep.COMPLIANCE) {
      updateData.complianceStatus = dto.status;
      updateData.complianceComment = comment;
      updateData.complianceReviewedBy = reviewerId;
    } else if (dto.step === ReviewStep.RISK) {
      updateData.riskStatus = dto.status;
      updateData.riskComment = comment;
      updateData.riskReviewedBy = reviewerId;
    } else if (dto.step === ReviewStep.BRANCH) {
      updateData.branchStatus = dto.status;
      updateData.branchComment = comment;
      updateData.branchApprovedBy = reviewerId;
    }

    // Save step outcome
    const updatedRequest = await this.prisma.kycRequest.update({
      where: { customerId: dto.customerId },
      data: updateData,
    });

    // Handle rejection
    if (dto.status === ReviewStatus.REJECTED) {
      await this.prisma.customer.update({
        where: { id: dto.customerId },
        data: { status: 'REJECTED' },
      });
      return {
        request: updatedRequest,
        customerStatus: CustomerStatus.REJECTED,
      };
    }

    // Handle final step approval
    if (
      dto.step === ReviewStep.BRANCH &&
      dto.status === ReviewStatus.APPROVED
    ) {
      // 1. Update customer status to APPROVED
      await this.prisma.customer.update({
        where: { id: dto.customerId },
        data: { status: 'APPROVED' },
      });

      // 2. Automatically create new Savings Account
      const accountNumber = 'ACC-' + randomInt(10000000, 99999999).toString();
      const account = await this.prisma.account.create({
        data: {
          accountNumber,
          type: AccountType.SAVINGS,
          currency: 'INR',
          balance: 0.0,
          customerId: dto.customerId,
        },
      });

      return {
        request: updatedRequest,
        customerStatus: CustomerStatus.APPROVED,
        accountCreated: account,
      };
    }

    return { request: updatedRequest, customerStatus: CustomerStatus.PENDING };
  }

  // 7. Manual customer status administration (Admin)
  async updateCustomerStatus(
    dto: UpdateStatusDto,
  ): Promise<{ customerId: string; status: CustomerStatus }> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: dto.customerId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    // Direct status update
    const updated = await this.prisma.customer.update({
      where: { id: dto.customerId },
      data: { status: dto.status },
    });

    return {
      customerId: updated.id,
      status: updated.status,
    };
  }

  // Validate that the reviewer has the appropriate role for the step
  private validateReviewerRole(step: ReviewStep, role: EmployeeRole): void {
    if (role === EmployeeRole.CEO) {
      return; // CEO has bypass privileges
    }

    switch (step) {
      case ReviewStep.DOCUMENT:
        if (
          role !== EmployeeRole.KYC_OFFICER &&
          role !== EmployeeRole.BRANCH_MANAGER
        ) {
          throw new ForbiddenException(
            'Only KYC Officers can complete document reviews.',
          );
        }
        break;
      case ReviewStep.COMPLIANCE:
        if (role !== EmployeeRole.COMPLIANCE_OFFICER) {
          throw new ForbiddenException(
            'Only Compliance Officers can complete compliance reviews.',
          );
        }
        break;
      case ReviewStep.RISK:
        if (role !== EmployeeRole.RISK_OFFICER) {
          throw new ForbiddenException(
            'Only Risk Officers can complete risk reviews.',
          );
        }
        break;
      case ReviewStep.BRANCH:
        if (role !== EmployeeRole.BRANCH_MANAGER) {
          throw new ForbiddenException(
            'Only Branch Managers can sign-off branch approvals.',
          );
        }
        break;
      default:
        throw new BadRequestException('Invalid review step.');
    }
  }

  // Enforce sequential review logic: Document -> Compliance -> Risk -> Branch
  private validateSequentialFlow(step: ReviewStep, request: KycRequest): void {
    if (step === ReviewStep.COMPLIANCE) {
      if (request.documentStatus !== ReviewStatus.APPROVED) {
        throw new BadRequestException(
          'Compliance review requires approved Document Review.',
        );
      }
    } else if (step === ReviewStep.RISK) {
      if (request.documentStatus !== ReviewStatus.APPROVED) {
        throw new BadRequestException(
          'Risk review requires approved Document Review.',
        );
      }
      if (request.complianceStatus !== ReviewStatus.APPROVED) {
        throw new BadRequestException(
          'Risk review requires approved Compliance Review.',
        );
      }
    } else if (step === ReviewStep.BRANCH) {
      if (request.documentStatus !== ReviewStatus.APPROVED) {
        throw new BadRequestException(
          'Branch approval requires approved Document Review.',
        );
      }
      if (request.complianceStatus !== ReviewStatus.APPROVED) {
        throw new BadRequestException(
          'Branch approval requires approved Compliance Review.',
        );
      }
      if (request.riskStatus !== ReviewStatus.APPROVED) {
        throw new BadRequestException(
          'Branch approval requires approved Risk Review.',
        );
      }
    }
  }
}
