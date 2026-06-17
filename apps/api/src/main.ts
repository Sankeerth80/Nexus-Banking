import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as Sentry from '@sentry/nestjs';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import type { EnvironmentVariables } from './config/environment';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const configService =
    app.get<ConfigService<EnvironmentVariables, true>>(ConfigService);

  const sentryDsn = configService.get('SENTRY_DSN', { infer: true });
  if (sentryDsn) {
    Sentry.init({
      dsn: sentryDsn,
      environment: configService.get('APP_ENV', { infer: true }),
      tracesSampleRate: configService.get('SENTRY_TRACES_SAMPLE_RATE', {
        infer: true,
      }),
    });
  }

  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: configService
      .get('CORS_ORIGIN', { infer: true })
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.setGlobalPrefix('api');
  app.enableShutdownHooks();

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Nexus Banking API')
    .setDescription('Simulation-only enterprise net banking API.')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    jsonDocumentUrl: 'api/docs-json',
  });

  const port =
    configService.get('PORT', { infer: true }) ??
    configService.get('API_PORT', { infer: true }) ??
    4000;

  await app.listen(port, '0.0.0.0');
}

void bootstrap();
