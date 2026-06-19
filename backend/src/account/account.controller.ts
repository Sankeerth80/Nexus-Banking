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
import { CreateAccountDto, UpdateAccountDto } from './dto/account.dto';

@ApiTags('accounts')
@Controller('accounts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Get()
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Get all accounts for active customer' })
  async getMyAccounts(@Req() req: AuthenticatedRequest) {
    const customerId = req.user.userId;
    return this.accountService.getAccountsForCustomer(customerId);
  }

  @Get('admin')
  @Roles(
    'CEO',
    'BRANCH_MANAGER',
    'IT_ADMINISTRATOR',
    'SUPPORT_OFFICER',
    'RELATIONSHIP_MANAGER',
  )
  @ApiOperation({
    summary: 'Get all accounts across the bank (Employee/Admin)',
  })
  async getAllAccounts() {
    return this.accountService.getAllAccounts();
  }

  @Post()
  @ApiOperation({ summary: 'Create a new account' })
  async createAccount(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateAccountDto,
  ) {
    // If CUSTOMER, they can only create accounts for themselves
    if (req.user.role === 'CUSTOMER' && dto.customerId !== req.user.userId) {
      throw new ForbiddenException(
        'Customers can only create accounts for themselves',
      );
    }
    return this.accountService.createAccount(dto);
  }

  @Put(':id')
  @Roles('CEO', 'BRANCH_MANAGER', 'IT_ADMINISTRATOR')
  @ApiOperation({ summary: 'Update account details' })
  async updateAccount(@Param('id') id: string, @Body() dto: UpdateAccountDto) {
    return this.accountService.updateAccount(id, dto);
  }

  @Delete(':id')
  @Roles('CEO', 'BRANCH_MANAGER', 'IT_ADMINISTRATOR')
  @ApiOperation({ summary: 'Delete account' })
  async deleteAccount(@Param('id') id: string) {
    return this.accountService.deleteAccount(id);
  }

  @Post(':id/status')
  @Roles('CEO', 'BRANCH_MANAGER', 'IT_ADMINISTRATOR', 'SUPPORT_OFFICER')
  @ApiOperation({ summary: 'Toggle account status (Activate/Deactivate)' })
  async toggleStatus(
    @Param('id') id: string,
    @Body('status') status: 'ACTIVE' | 'DEACTIVATED',
  ) {
    return this.accountService.toggleAccountStatus(id, status);
  }

  @Get(':id/statement')
  @ApiOperation({
    summary: 'Generate statement and return MinIO download link',
  })
  async getStatement(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    // If customer, verify they own this account
    if (req.user.role === 'CUSTOMER') {
      const ownsAccount = await this.accountService.customerOwnsAccount(
        req.user.userId,
        id,
      );
      if (!ownsAccount) {
        throw new ForbiddenException(
          'Access denied: You do not own this account',
        );
      }
    }
    return this.accountService.generateStatement(id);
  }
}
