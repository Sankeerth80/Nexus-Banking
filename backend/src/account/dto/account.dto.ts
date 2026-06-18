import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateAccountDto {
  @IsString()
  @IsNotEmpty()
  customerId: string;

  @IsString()
  @IsNotEmpty()
  type: string; // SAVINGS, CURRENT, SALARY, FIXED_DEPOSIT, RECURRING_DEPOSIT, NRE, NRO

  @IsString()
  @IsOptional()
  currency?: string;

  @IsNumber()
  @IsOptional()
  interestRate?: number;

  @IsString()
  @IsOptional()
  ifsc?: string;

  @IsString()
  @IsOptional()
  branchCode?: string;

  @IsNumber()
  @IsOptional()
  balance?: number;
}

export class UpdateAccountDto {
  @IsString()
  @IsOptional()
  type?: string;

  @IsNumber()
  @IsOptional()
  interestRate?: number;

  @IsString()
  @IsOptional()
  ifsc?: string;

  @IsString()
  @IsOptional()
  branchCode?: string;
}

export class CreateBeneficiaryDto {
  @IsString()
  @IsNotEmpty()
  nickname: string;

  @IsString()
  @IsNotEmpty()
  accountNumber: string;

  @IsString()
  @IsNotEmpty()
  bankName: string;

  @IsString()
  @IsNotEmpty()
  ifsc: string;
}

export class UpdateBeneficiaryDto {
  @IsString()
  @IsOptional()
  nickname?: string;

  @IsString()
  @IsOptional()
  accountNumber?: string;

  @IsString()
  @IsOptional()
  bankName?: string;

  @IsString()
  @IsOptional()
  ifsc?: string;
}
