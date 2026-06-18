import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { EmployeeRole } from '@prisma/client';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { KycService } from './kyc.service';
import { ReviewKycDto, SubmitKycDto, UpdateStatusDto } from './dto/kyc.dto';

@ApiTags('kyc')
@Controller('kyc')
export class KycController {
  constructor(private readonly kycService: KycService) {}

  @Post('upload')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CUSTOMER')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Upload a KYC document file (ID, photo, signature)',
  })
  @ApiResponse({ status: 201, description: 'File uploaded successfully.' })
  async upload(
    @UploadedFile() file: any,
    @Body('type') type: 'PHOTO' | 'SIGNATURE' | 'ID_PROOF',
  ) {
    if (!file) {
      throw new BadRequestException('No file provided for upload.');
    }
    return this.kycService.uploadKycFile(
      {
        buffer: file.buffer,
        originalname: file.originalname,
        mimetype: file.mimetype,
      },
      type,
    );
  }

  @Post('submit')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CUSTOMER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit KYC documentation details' })
  @ApiResponse({ status: 200, description: 'KYC submitted successfully.' })
  async submit(@Req() req: any, @Body() dto: SubmitKycDto) {
    const customerId = req.user.userId;
    return this.kycService.submitKyc(customerId, dto);
  }

  @Get('status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Get current customer KYC status' })
  async status(@Req() req: any) {
    const customerId = req.user.userId;
    return this.kycService.getKycStatus(customerId);
  }

  @Get('pending')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    'CEO',
    'KYC_OFFICER',
    'COMPLIANCE_OFFICER',
    'RISK_OFFICER',
    'BRANCH_MANAGER',
  )
  @ApiOperation({ summary: 'List pending KYC applications' })
  async pending() {
    return this.kycService.getPendingKycRequests();
  }

  @Get('request/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    'CEO',
    'KYC_OFFICER',
    'COMPLIANCE_OFFICER',
    'RISK_OFFICER',
    'BRANCH_MANAGER',
  )
  @ApiOperation({ summary: 'Get details of a specific KYC request' })
  async getRequest(@Param('id') id: string) {
    return this.kycService.getKycRequestDetails(id);
  }

  @Post('review')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    'CEO',
    'KYC_OFFICER',
    'COMPLIANCE_OFFICER',
    'RISK_OFFICER',
    'BRANCH_MANAGER',
  )
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit a review for a KYC stage' })
  async review(@Req() req: any, @Body() dto: ReviewKycDto) {
    const reviewerId = req.user.userId;
    const reviewerRole = req.user.role as EmployeeRole;
    return this.kycService.reviewKyc(reviewerId, reviewerRole, dto);
  }

  @Post('customer/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CEO', 'SECURITY_ADMINISTRATOR', 'IT_ADMINISTRATOR')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Admin control to update customer status (freeze/suspend)',
  })
  async updateStatus(@Body() dto: UpdateStatusDto) {
    return this.kycService.updateCustomerStatus(dto);
  }
}
