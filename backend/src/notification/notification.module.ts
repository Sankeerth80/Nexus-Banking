import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { EmailModule } from '../email/email.module';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [DatabaseModule, EmailModule, RealtimeModule],
  controllers: [NotificationController],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
