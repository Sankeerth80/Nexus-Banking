import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { CacheModule } from '../../cache/cache.module';
import { RiskService } from './risk.service';

@Module({
  imports: [DatabaseModule, CacheModule],
  providers: [RiskService],
  exports: [RiskService],
})
export class RiskModule {}
