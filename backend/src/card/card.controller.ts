import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CardService } from './card.service';
import {
  CreateCreditCardDto,
  CreateDebitCardDto,
  UpdateLimitsDto,
  SetPinDto,
  PayBillDto,
  ConvertEmiDto,
  UpdateCardStatusDto,
  ToggleAutoPayDto,
} from './dto/card.dto';

@ApiTags('cards')
@Controller('cards')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CardController {
  constructor(private readonly cardService: CardService) {}

  @Get()
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'List all cards for the active customer' })
  async getMyCards(@Req() req: any) {
    const customerId = req.user.userId;
    return this.cardService.getCards(customerId);
  }

  @Post('debit')
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Request a new debit card linked to account' })
  async requestDebit(@Req() req: any, @Body() dto: CreateDebitCardDto) {
    const customerId = req.user.userId;
    return this.cardService.createDebitCard(customerId, dto);
  }

  @Post('credit')
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Apply for a new credit card' })
  async applyCredit(@Req() req: any, @Body() dto: CreateCreditCardDto) {
    const customerId = req.user.userId;
    return this.cardService.applyCreditCard(customerId, dto);
  }

  @Post(':id/activate')
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Activate an inactive credit/debit card' })
  async activate(@Req() req: any, @Param('id') id: string) {
    const customerId = req.user.userId;
    return this.cardService.activateCard(customerId, id);
  }

  @Post(':id/status')
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Freeze, unfreeze, block, or replace card' })
  async updateStatus(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateCardStatusDto,
  ) {
    const customerId = req.user.userId;
    return this.cardService.updateCardStatus(customerId, id, dto.status);
  }

  @Put(':id/limits')
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Update usage toggles and transaction limits' })
  async updateLimits(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateLimitsDto,
  ) {
    const customerId = req.user.userId;
    return this.cardService.updateLimits(customerId, id, dto);
  }

  @Post(':id/pin')
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Set or update card PIN' })
  async setPin(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: SetPinDto,
  ) {
    const customerId = req.user.userId;
    return this.cardService.updatePin(customerId, id, dto.pin);
  }

  @Post(':id/pay-bill')
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Pay credit card bill outstanding balance' })
  async payBill(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: PayBillDto,
  ) {
    const customerId = req.user.userId;
    return this.cardService.payCreditCardBill(customerId, id, dto);
  }

  @Post('transactions/:transactionId/emi')
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Convert card purchase transaction to EMI' })
  async convertEmi(
    @Req() req: any,
    @Param('transactionId') transactionId: string,
    @Body() dto: ConvertEmiDto,
  ) {
    const customerId = req.user.userId;
    return this.cardService.convertToEmi(customerId, transactionId, dto.months);
  }

  @Post(':id/redeem-rewards')
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Redeem credit card rewards points for cashback' })
  async redeemRewards(@Req() req: any, @Param('id') id: string) {
    const customerId = req.user.userId;
    return this.cardService.redeemRewards(customerId, id);
  }

  @Put(':id/autopay')
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Toggle auto-pay switch for credit card' })
  async toggleAutoPay(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: ToggleAutoPayDto,
  ) {
    const customerId = req.user.userId;
    return this.cardService.toggleAutoPay(customerId, id, dto.enabled);
  }

  // Admin and management endpoints
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
    summary: 'View all provisioned cards across the bank (Employee/Admin)',
  })
  async getAllCards() {
    return this.cardService.getAllCardsAdmin();
  }

  @Post(':id/admin-approve')
  @Roles(
    'CEO',
    'BRANCH_MANAGER',
    'IT_ADMINISTRATOR',
    'SUPPORT_OFFICER',
    'RELATIONSHIP_MANAGER',
  )
  @ApiOperation({ summary: 'Approve applied credit card (Employee/Admin)' })
  async adminApprove(@Param('id') id: string) {
    return this.cardService.adminApproveCard(id);
  }
}
