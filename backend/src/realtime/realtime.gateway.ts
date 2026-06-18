import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';

type BankingRealtimeEvent =
  | 'login'
  | 'notification'
  | 'money-transfer'
  | 'support-ticket'
  | 'admin-approval';

type RealtimePayload = {
  event: BankingRealtimeEvent;
  referenceId: string;
  message: string;
  occurredAt: string;
};

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class RealtimeGateway {
  @WebSocketServer()
  server!: Server;

  @SubscribeMessage('login')
  handleLogin(
    @MessageBody() payload: RealtimePayload,
    @ConnectedSocket() client: Socket,
  ) {
    client.emit('notification', this.normalizePayload('login', payload));
  }

  @SubscribeMessage('notification')
  handleNotification(@MessageBody() payload: RealtimePayload) {
    this.server.emit(
      'notification',
      this.normalizePayload('notification', payload),
    );
  }

  @SubscribeMessage('money-transfer')
  handleMoneyTransfer(@MessageBody() payload: RealtimePayload) {
    this.server.emit(
      'money-transfer',
      this.normalizePayload('money-transfer', payload),
    );
  }

  @SubscribeMessage('support-ticket')
  handleSupportTicket(@MessageBody() payload: RealtimePayload) {
    this.server.emit(
      'support-ticket',
      this.normalizePayload('support-ticket', payload),
    );
  }

  @SubscribeMessage('admin-approval')
  handleAdminApproval(@MessageBody() payload: RealtimePayload) {
    this.server.emit(
      'admin-approval',
      this.normalizePayload('admin-approval', payload),
    );
  }

  private normalizePayload(
    event: BankingRealtimeEvent,
    payload: RealtimePayload,
  ): RealtimePayload {
    return {
      event,
      referenceId: payload.referenceId,
      message: payload.message,
      occurredAt: payload.occurredAt || new Date().toISOString(),
    };
  }
}
