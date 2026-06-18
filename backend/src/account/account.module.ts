import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { StorageModule } from '../storage/storage.module';
import { CacheModule } from '../cache/cache.module';
import { EmailModule } from '../email/email.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { AccountController } from './account.controller';
import { BeneficiaryController } from './beneficiary.controller';
import { TransferController } from './transfer.controller';
import { AccountService } from './account.service';
import { TransferService } from './transfer.service';

@Module({
  imports: [
    DatabaseModule,
    StorageModule,
    CacheModule,
    EmailModule,
    RealtimeModule,
  ],
  controllers: [AccountController, BeneficiaryController, TransferController],
  providers: [AccountService, TransferService],
  exports: [AccountService, TransferService],
})
export class AccountModule {}
