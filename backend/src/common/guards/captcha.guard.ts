import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { EnvironmentVariables } from '../../config/environment';

@Injectable()
export class CaptchaGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService<EnvironmentVariables, true>,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const captchaToken = request.headers['x-captcha-token'] as string;

    const isDemoMode =
      this.configService.get('DEMO_BANKING_MODE', { infer: true }) === 'true';

    // In demo or local mode, we allow a mock captcha bypass
    if (isDemoMode && captchaToken === 'MOCK_CAPTCHA_PASS') {
      return true;
    }

    if (!captchaToken) {
      throw new HttpException(
        'Captcha token is required for this operation.',
        HttpStatus.BAD_REQUEST,
      );
    }

    // In non-demo production environments, we would perform a fetch to reCAPTCHA/Turnstile APIs
    // e.g. await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', ...)
    // For this simulation/foundation, we verify that the token has a valid format (non-empty, minimum length)
    if (captchaToken.length < 10) {
      throw new HttpException(
        'Invalid captcha token. Verification failed.',
        HttpStatus.BAD_REQUEST,
      );
    }

    return true;
  }
}
