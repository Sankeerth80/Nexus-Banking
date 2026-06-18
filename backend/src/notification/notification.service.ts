import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { EmailService } from '../email/email.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { TicketCategory, TicketStatus } from '@prisma/client';
import { CreateTicketDto } from './dto/notification.dto';

@Injectable()
export class NotificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  // ==========================================
  // NOTIFICATIONS CORE
  // ==========================================

  async createNotification(
    customerId: string,
    title: string,
    message: string,
    category: string,
  ) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    // Save In-App Notification in database
    const notification = await this.prisma.notification.create({
      data: {
        customerId,
        title,
        message,
        category,
        read: false,
      },
    });

    // Realtime Broadcast via Socket.IO
    try {
      this.realtimeGateway.server.emit('notification', {
        event: 'notification',
        referenceId: notification.id,
        message: `${title}: ${message}`,
        occurredAt: new Date().toISOString(),
      });
    } catch (err) {
      // Gateway not initialized
    }

    // Send Email notification via Brevo smtp
    try {
      await this.emailService.sendTemplateEmail('support-alert', {
        email: customer.email,
      });
    } catch (err) {
      // Brevo not configured/demo sandbox mode
    }

    return notification;
  }

  async getMyNotifications(customerId: string) {
    return this.prisma.notification.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async markAsRead(customerId: string, id: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (notification.customerId !== customerId) {
      throw new ForbiddenException('Access denied');
    }

    return this.prisma.notification.update({
      where: { id },
      data: { read: true },
    });
  }

  // ==========================================
  // SUPPORT TICKETS CLIENTS
  // ==========================================

  async createTicket(customerId: string, dto: CreateTicketDto) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const ticket = await this.prisma.ticket.create({
      data: {
        customerId,
        title: dto.title,
        description: dto.description,
        category: dto.category,
        status: TicketStatus.OPEN,
      },
    });

    // Broadcast ticket created
    try {
      this.realtimeGateway.server.emit('support-ticket', {
        event: 'support-ticket',
        referenceId: ticket.id,
        message: `New support ticket raised by ${customer.fullName}`,
        occurredAt: new Date().toISOString(),
      });
    } catch (err) {}

    // Send in-app notification
    await this.createNotification(
      customerId,
      'Support Ticket Opened',
      `Your support ticket #${ticket.id.slice(0, 8).toUpperCase()} under category ${ticket.category} has been opened.`,
      ticket.category,
    );

    return ticket;
  }

  async getMyTickets(customerId: string) {
    return this.prisma.ticket.findMany({
      where: { customerId },
      include: {
        comments: {
          orderBy: { createdAt: 'asc' },
        },
        assignedTo: {
          select: { fullName: true, email: true, role: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getTicketDetails(customerId: string, ticketId: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        comments: {
          orderBy: { createdAt: 'asc' },
        },
        assignedTo: {
          select: { fullName: true, email: true, role: true },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    if (ticket.customerId !== customerId) {
      throw new ForbiddenException('Access denied');
    }

    return ticket;
  }

  async addTicketComment(
    actorId: string,
    authorName: string,
    authorRole: 'CUSTOMER' | 'EMPLOYEE',
    ticketId: string,
    message: string,
  ) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    if (authorRole === 'CUSTOMER' && ticket.customerId !== actorId) {
      throw new ForbiddenException('Access denied');
    }

    const comment = await this.prisma.ticketComment.create({
      data: {
        ticketId,
        authorId: actorId,
        authorName,
        authorRole,
        message,
      },
    });

    // Update ticket touch timestamp
    await this.prisma.ticket.update({
      where: { id: ticketId },
      data: { updatedAt: new Date() },
    });

    // If Support Officer commented, alert client
    if (authorRole === 'EMPLOYEE') {
      await this.createNotification(
        ticket.customerId,
        'Support Case Response',
        `Support agent ${authorName} replied to case #${ticketId.slice(0, 8).toUpperCase()}: "${message.slice(0, 50)}..."`,
        ticket.category,
      );
    } else {
      // Customer added reply: trigger realtime socket
      try {
        this.realtimeGateway.server.emit('support-ticket', {
          event: 'support-ticket',
          referenceId: ticketId,
          message: `Customer commented on support case #${ticketId.slice(0, 8).toUpperCase()}`,
          occurredAt: new Date().toISOString(),
        });
      } catch (err) {}
    }

    return comment;
  }

  // ==========================================
  // SUPPORT TICKETS EMPLOYEES
  // ==========================================

  async getAllTicketsAdmin() {
    return this.prisma.ticket.findMany({
      include: {
        customer: {
          select: { fullName: true, email: true, phone: true },
        },
        comments: {
          orderBy: { createdAt: 'asc' },
        },
        assignedTo: {
          select: { id: true, fullName: true, role: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async assignTicketAdmin(ticketId: string, employeeId: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    const updated = await this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        assignedToId: employeeId,
        status: TicketStatus.ASSIGNED,
      },
      include: {
        assignedTo: { select: { fullName: true } },
      },
    });

    await this.createNotification(
      ticket.customerId,
      'Support Case Assigned',
      `Your support ticket #${ticketId.slice(0, 8).toUpperCase()} has been assigned to support officer ${employee.fullName}.`,
      ticket.category,
    );

    return updated;
  }

  async updateTicketStatusAdmin(ticketId: string, status: TicketStatus) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    const updated = await this.prisma.ticket.update({
      where: { id: ticketId },
      data: { status },
    });

    await this.createNotification(
      ticket.customerId,
      'Support Case Status Updated',
      `Your support ticket #${ticketId.slice(0, 8).toUpperCase()} status has been updated to "${status}".`,
      ticket.category,
    );

    return updated;
  }
}
