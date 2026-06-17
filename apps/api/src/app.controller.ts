import { Controller, Get, Res } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import {
  AppService,
  type PlatformHealth,
  type PlatformOverview,
} from './app.service';
import { MetricsService } from './observability/metrics.service';

@ApiTags('platform')
@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly metricsService: MetricsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Platform capability overview' })
  @ApiOkResponse({
    description: 'Demo platform capabilities and integration status.',
  })
  getOverview(): PlatformOverview {
    return this.appService.getPlatformOverview();
  }

  @Get('health')
  @ApiOperation({ summary: 'Health check' })
  @ApiOkResponse({ description: 'Service is healthy.' })
  getHealth(): PlatformHealth {
    return this.appService.getHealth();
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Prometheus metrics' })
  async getMetrics(
    @Res({ passthrough: true }) response: Response,
  ): Promise<string> {
    response.type(this.metricsService.contentType);
    return this.metricsService.renderMetrics();
  }
}
