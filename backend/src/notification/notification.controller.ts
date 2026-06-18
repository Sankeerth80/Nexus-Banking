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
import { NotificationService } from './notification.service';
import { PrismaService } from '../database/prisma.service';
import {
  CreateTicketDto,
  AddCommentDto,
  UpdateTicketStatusDto,
  AssignTicketDto,
} from './dto/notification.dto';

@ApiTags('notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly prismaService: PrismaService,
  ) {}

  // ==========================================
  // CUSTOMER NOTIFICATIONS
  // ==========================================

  @Get()
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'List all notifications for active customer' })
  async getNotifications(@Req() req: any) {
    const customerId = req.user.userId;
    return this.notificationService.getMyNotifications(customerId);
  }

  @Post(':id/read')
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Mark in-app notification as read' })
  async markRead(@Req() req: any, @Param('id') id: string) {
    const customerId = req.user.userId;
    return this.notificationService.markAsRead(customerId, id);
  }

  // ==========================================
  // CUSTOMER & AGENT TICKETS WORKSPACE
  // ==========================================

  @Get('tickets')
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'List all support cases submitted by customer' })
  async getTickets(@Req() req: any) {
    const customerId = req.user.userId;
    return this.notificationService.getMyTickets(customerId);
  }

  @Post('tickets')
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Submit a new support ticket' })
  async createTicket(@Req() req: any, @Body() dto: CreateTicketDto) {
    const customerId = req.user.userId;
    return this.notificationService.createTicket(customerId, dto);
  }

  @Get('tickets/:id')
  @Roles(
    'CUSTOMER',
    'CEO',
    'BRANCH_MANAGER',
    'SUPPORT_OFFICER',
    'RELATIONSHIP_MANAGER',
    'AUDITOR',
  )
  @ApiOperation({
    summary: 'View details of a support ticket (Owner or Employee)',
  })
  async getDetails(@Req() req: any, @Param('id') id: string) {
    const actorId = req.user.userId;
    const isCustomer = req.user.role === 'CUSTOMER';
    if (isCustomer) {
      return this.notificationService.getTicketDetails(actorId, id);
    }
    // Employee bypass ownership
    return this.prismaService.ticket.findUnique({
      where: { id },
      include: {
        customer: { select: { fullName: true, email: true, phone: true } },
        comments: { orderBy: { createdAt: 'asc' } },
        assignedTo: { select: { id: true, fullName: true, role: true } },
      },
    });
  }

  @Post('tickets/:id/comments')
  @Roles(
    'CUSTOMER',
    'CEO',
    'BRANCH_MANAGER',
    'SUPPORT_OFFICER',
    'RELATIONSHIP_MANAGER',
  )
  @ApiOperation({ summary: 'Append comment feedback on case file' })
  async addComment(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: AddCommentDto,
  ) {
    const actorId = req.user.userId;
    const isCustomer = req.user.role === 'CUSTOMER';
    let authorName = 'Support Officer';
    let authorRole: 'CUSTOMER' | 'EMPLOYEE' = 'EMPLOYEE';

    if (isCustomer) {
      const cust = await this.prismaService.customer.findUnique({
        where: { id: actorId },
      });
      authorName = cust?.fullName || 'Customer';
      authorRole = 'CUSTOMER';
    } else {
      const emp = await this.prismaService.employee.findUnique({
        where: { id: actorId },
      });
      authorName = emp?.fullName || 'Agent';
      authorRole = 'EMPLOYEE';
    }

    return this.notificationService.addTicketComment(
      actorId,
      authorName,
      authorRole,
      id,
      dto.message,
    );
  }

  // ==========================================
  // EMPLOYEE TICKET MANAGER
  // ==========================================

  @Get('admin/tickets')
  @Roles(
    'CEO',
    'BRANCH_MANAGER',
    'SUPPORT_OFFICER',
    'RELATIONSHIP_MANAGER',
    'AUDITOR',
  )
  @ApiOperation({
    summary: 'List all support cases in bank system (Employee/Admin)',
  })
  async getAdminTickets() {
    return this.notificationService.getAllTicketsAdmin();
  }

  @Post('admin/tickets/:id/assign')
  @Roles('CEO', 'BRANCH_MANAGER', 'SUPPORT_OFFICER', 'RELATIONSHIP_MANAGER')
  @ApiOperation({ summary: 'Assign case to support staff (Employee/Admin)' })
  async assignTicket(@Param('id') id: string, @Body() dto: AssignTicketDto) {
    return this.notificationService.assignTicketAdmin(id, dto.employeeId);
  }

  @Post('admin/tickets/:id/status')
  @Roles('CEO', 'BRANCH_MANAGER', 'SUPPORT_OFFICER', 'RELATIONSHIP_MANAGER')
  @ApiOperation({ summary: 'Update status of support case (Employee/Admin)' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateTicketStatusDto,
  ) {
    return this.notificationService.updateTicketStatusAdmin(id, dto.status);
  }
}
