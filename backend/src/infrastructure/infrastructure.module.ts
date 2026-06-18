import { Module } from '@nestjs/common';
import { CacheModule } from '../cache/cache.module';
import { DatabaseModule } from '../database/database.module';
import { EmailModule } from '../email/email.module';
import { ObservabilityModule } from '../observability/observability.module';
import { StorageModule } from '../storage/storage.module';
import { InfrastructureHealthService } from './infrastructure-health.service';

@Module({
  imports: [
    DatabaseModule,
    CacheModule,
    StorageModule,
    EmailModule,
    ObservabilityModule,
  ],
  providers: [InfrastructureHealthService],
  exports: [InfrastructureHealthService],
})
export class InfrastructureModule {}
