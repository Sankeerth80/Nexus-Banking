import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';
import { TransferType } from '@prisma/client';

export class InitiateTransferDto {
  @IsString()
  @IsNotEmpty()
  sourceAccountId: string;

  @IsString()
  @IsOptional()
  destinationAccountId?: string;

  @IsString()
  @IsOptional()
  recipientDetails?: string; // e.g. IFSC:SBIN0001234;ACC-9876543 or upi@id

  @IsNumber()
  @IsPositive()
  amount: number;

  @IsEnum(TransferType)
  @IsNotEmpty()
  type: TransferType;

  @IsString()
  @IsOptional()
  scheduledFor?: string; // ISO date string
}

export class VerifyTransferDto {
  @IsString()
  @IsNotEmpty()
  code: string;
}

export class ReviewTransferDto {
  @IsBoolean()
  @IsNotEmpty()
  approve: boolean;

  @IsString()
  @IsOptional()
  comment?: string;
}
