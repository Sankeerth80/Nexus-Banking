import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedRequest } from '../common/types/authenticated-request';
import { AccountService } from './account.service';
import { CreateBeneficiaryDto, UpdateBeneficiaryDto } from './dto/account.dto';

@ApiTags('beneficiaries')
@Controller('beneficiaries')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BeneficiaryController {
  constructor(private readonly accountService: AccountService) {}

  @Get()
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Get all beneficiaries for active customer' })
  async getMyBeneficiaries(@Req() req: AuthenticatedRequest) {
    const customerId = req.user.userId;
    return this.accountService.getBeneficiariesForCustomer(customerId);
  }

  @Post()
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Add a new beneficiary' })
  async addBeneficiary(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateBeneficiaryDto,
  ) {
    const customerId = req.user.userId;
    return this.accountService.createBeneficiary(customerId, dto);
  }

  @Put(':id')
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Update beneficiary details' })
  async updateBeneficiary(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateBeneficiaryDto,
  ) {
    // Verify ownership
    const myBeneficiaries =
      await this.accountService.getBeneficiariesForCustomer(req.user.userId);
    const ownsBeneficiary = myBeneficiaries.some((b) => b.id === id);
    if (!ownsBeneficiary) {
      throw new ForbiddenException(
        'Access denied: You do not own this beneficiary',
      );
    }
    return this.accountService.updateBeneficiary(id, dto);
  }

  @Delete(':id')
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Delete beneficiary' })
  async deleteBeneficiary(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    // Verify ownership
    const myBeneficiaries =
      await this.accountService.getBeneficiariesForCustomer(req.user.userId);
    const ownsBeneficiary = myBeneficiaries.some((b) => b.id === id);
    if (!ownsBeneficiary) {
      throw new ForbiddenException(
        'Access denied: You do not own this beneficiary',
      );
    }
    return this.accountService.deleteBeneficiary(id);
  }

  @Post(':id/status')
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Toggle beneficiary active status' })
  async toggleStatus(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body('active') active: boolean,
  ) {
    // Verify ownership
    const myBeneficiaries =
      await this.accountService.getBeneficiariesForCustomer(req.user.userId);
    const ownsBeneficiary = myBeneficiaries.some((b) => b.id === id);
    if (!ownsBeneficiary) {
      throw new ForbiddenException(
        'Access denied: You do not own this beneficiary',
      );
    }
    return this.accountService.toggleBeneficiaryStatus(id, active);
  }
}
