import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import type { Request, Response } from 'express';
import { PlatformLogger } from '../logging/platform-logger.service';

type ErrorResponseBody = {
  statusCode: number;
  timestamp: string;
  path: string;
  message: string;
};

@Injectable()
@Catch()
export class PlatformExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: PlatformLogger) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const message =
      exception instanceof Error
        ? exception.message
        : 'Unexpected server error';

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      Sentry.captureException(exception);
      this.logger.error(
        message,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    const payload: ErrorResponseBody = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
    };

    response.status(status).json(payload);
  }
}
