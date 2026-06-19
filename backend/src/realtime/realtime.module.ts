import { Module } from '@nestjs/common';
import { ObservabilityModule } from '../observability/observability.module';
import { RealtimeGateway } from './realtime.gateway';

@Module({
  imports: [ObservabilityModule],
  providers: [RealtimeGateway],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
