import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Length,
  Min,
} from 'class-validator';
import { CardStatus } from '@prisma/client';

export class CreateDebitCardDto {
  @IsString()
  @IsNotEmpty()
  accountId: string;
}

export class CreateCreditCardDto {
  @IsString()
  @IsNotEmpty()
  tier: string; // "CLASSIC" | "GOLD" | "PLATINUM"

  @IsNumber()
  @IsPositive()
  @IsOptional()
  requestedLimit?: number;
}

export class UpdateLimitsDto {
  @IsBoolean()
  @IsOptional()
  atmEnabled?: boolean;

  @IsBoolean()
  @IsOptional()
  onlineEnabled?: boolean;

  @IsBoolean()
  @IsOptional()
  contactlessEnabled?: boolean;

  @IsBoolean()
  @IsOptional()
  internationalEnabled?: boolean;

  @IsNumber()
  @Min(0)
  @IsOptional()
  dailyLimit?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  atmLimit?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  onlineLimit?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  contactlessLimit?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  internationalLimit?: number;
}

export class SetPinDto {
  @IsString()
  @IsNotEmpty()
  @Length(4, 4)
  pin: string;
}

export class PayBillDto {
  @IsString()
  @IsNotEmpty()
  accountId: string;

  @IsNumber()
  @IsPositive()
  amount: number;
}

export class ConvertEmiDto {
  @IsNumber()
  @IsNotEmpty()
  months: number; // e.g. 3, 6, 12
}

export class UpdateCardStatusDto {
  @IsEnum(CardStatus)
  @IsNotEmpty()
  status: CardStatus;
}

export class ToggleAutoPayDto {
  @IsBoolean()
  @IsNotEmpty()
  enabled: boolean;
}
