import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { TicketCategory, TicketStatus } from '@prisma/client';

export class CreateTicketDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsEnum(TicketCategory)
  @IsNotEmpty()
  category: TicketCategory;
}

export class AddCommentDto {
  @IsString()
  @IsNotEmpty()
  message: string;
}

export class UpdateTicketStatusDto {
  @IsEnum(TicketStatus)
  @IsNotEmpty()
  status: TicketStatus;
}

export class AssignTicketDto {
  @IsString()
  @IsNotEmpty()
  employeeId: string;
}
