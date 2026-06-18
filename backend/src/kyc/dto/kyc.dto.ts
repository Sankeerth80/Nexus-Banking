import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SubmitKycDto {
  @IsString()
  @IsNotEmpty()
  idType: string;

  @IsString()
  @IsNotEmpty()
  idNumber: string;

  @IsString()
  @IsNotEmpty()
  idDocKey: string;

  @IsString()
  @IsNotEmpty()
  photoKey: string;

  @IsString()
  @IsNotEmpty()
  signatureKey: string;
}

export enum ReviewStep {
  DOCUMENT = 'document',
  RISK = 'risk',
  COMPLIANCE = 'compliance',
  BRANCH = 'branch',
}

export enum ReviewStatus {
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export class ReviewKycDto {
  @IsString()
  @IsNotEmpty()
  customerId: string;

  @IsEnum(ReviewStep)
  @IsNotEmpty()
  step: ReviewStep;

  @IsEnum(ReviewStatus)
  @IsNotEmpty()
  status: ReviewStatus;

  @IsString()
  @IsOptional()
  comment?: string;
}

export enum CustomerAdminStatus {
  APPROVED = 'APPROVED',
  FROZEN = 'FROZEN',
  SUSPENDED = 'SUSPENDED',
}

export class UpdateStatusDto {
  @IsString()
  @IsNotEmpty()
  customerId: string;

  @IsEnum(CustomerAdminStatus)
  @IsNotEmpty()
  status: CustomerAdminStatus;
}
