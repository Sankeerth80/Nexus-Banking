import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { PlatformExceptionFilter } from './filters/platform-exception.filter';
import { PlatformLogger } from './logging/platform-logger.service';

@Module({
  providers: [
    PlatformLogger,
    {
      provide: APP_FILTER,
      useClass: PlatformExceptionFilter,
    },
  ],
  exports: [PlatformLogger],
})
export class CommonModule {}
