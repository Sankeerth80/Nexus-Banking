import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { RedisService } from '../../cache/redis.service';
import type { JwtPayload } from '../jwt.strategy';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly redisService: RedisService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Run Passport JWT validation strategy first
    const passportOk = await super.canActivate(context);
    if (!passportOk) {
      return false;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: JwtPayload }>();
    const user = request.user;

    if (!user || !user.userId) {
      throw new UnauthorizedException('Authentication identity not found.');
    }

    // Verify session existence in Upstash Redis (Session Management / Timeout check)
    const activeSession = await this.redisService.getSession(user.userId);
    if (!activeSession) {
      throw new UnauthorizedException(
        'Session expired or logged out. Please sign in again.',
      );
    }

    // Verify trusted device if applicable (or optional check)
    // For this simulation, we check if the session payload contains the active session id
    const payload = JSON.parse(activeSession) as { sessionId: string };
    if (payload.sessionId !== user.sessionId) {
      throw new UnauthorizedException(
        'Session invalidated by another login or administrator.',
      );
    }

    return true;
  }
}
