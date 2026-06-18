import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { TransferService } from './transfer.service';
import {
  InitiateTransferDto,
  VerifyTransferDto,
  ReviewTransferDto,
} from './dto/transfer.dto';

@ApiTags('transfers')
@Controller('transfers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TransferController {
  constructor(private readonly transferService: TransferService) {}

  @Post('initiate')
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Initiate a money transfer and trigger OTP code' })
  async initiate(@Req() req: any, @Body() dto: InitiateTransferDto) {
    const customerId = req.user.userId;
    return this.transferService.initiateTransfer(customerId, dto);
  }

  @Post(':id/verify-2fa')
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Verify 2FA TOTP code for transfer authorization' })
  async verify2Fa(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: VerifyTransferDto,
  ) {
    const customerId = req.user.userId;
    return this.transferService.verifyTransfer2Fa(customerId, id, dto.code);
  }

  @Post(':id/verify-otp')
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Verify email OTP and execute transfer' })
  async verifyOtp(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: VerifyTransferDto,
  ) {
    const customerId = req.user.userId;
    return this.transferService.verifyTransferOtp(customerId, id, dto.code);
  }

  @Get('history')
  @Roles('CUSTOMER')
  @ApiOperation({
    summary: 'Retrieve transfer transaction history for active customer',
  })
  async getMyHistory(@Req() req: any) {
    const customerId = req.user.userId;
    return this.transferService.getTransferHistory(customerId);
  }

  @Get('admin')
  @Roles(
    'CEO',
    'BRANCH_MANAGER',
    'IT_ADMINISTRATOR',
    'SUPPORT_OFFICER',
    'RELATIONSHIP_MANAGER',
    'AUDITOR',
  )
  @ApiOperation({
    summary: 'Retrieve full ledger of transfers (Employee/Admin)',
  })
  async getAllTransfers() {
    return this.transferService.getAllTransfers();
  }

  @Get('audit-logs')
  @Roles(
    'CEO',
    'BRANCH_MANAGER',
    'IT_ADMINISTRATOR',
    'SECURITY_ADMINISTRATOR',
    'AUDITOR',
  )
  @ApiOperation({ summary: 'Retrieve system audit logs (Employee/Admin)' })
  async getAuditLogs() {
    return this.transferService.getAuditLogs();
  }

  @Get('pending-reviews')
  @Roles('CEO', 'BRANCH_MANAGER', 'RISK_OFFICER', 'COMPLIANCE_OFFICER')
  @ApiOperation({
    summary: 'Retrieve pending transfers requiring compliance/risk review',
  })
  async getPendingReviews() {
    return this.transferService.getPendingRiskReviews();
  }

  @Post(':id/review')
  @Roles('CEO', 'BRANCH_MANAGER', 'RISK_OFFICER', 'COMPLIANCE_OFFICER')
  @ApiOperation({ summary: 'Approve or reject a held transfer' })
  async review(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: ReviewTransferDto,
  ) {
    const employeeId = req.user.userId;
    return this.transferService.reviewTransfer(
      id,
      dto.approve,
      employeeId,
      dto.comment,
    );
  }

  @Post(':id/cancel')
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Cancel a pending scheduled transfer' })
  async cancel(@Req() req: any, @Param('id') id: string) {
    const customerId = req.user.userId;
    return this.transferService.cancelScheduledTransfer(customerId, id);
  }
}
