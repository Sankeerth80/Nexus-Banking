import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import type { EnvironmentVariables } from '../config/environment';
import type { CookieRequest } from '../common/types/authenticated-request';

export type JwtPayload = {
  userId: string;
  email: string;
  role: string;
  sessionId: string;
  deviceFingerprint?: string;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService<EnvironmentVariables, true>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => {
          const cookies = (req as CookieRequest).cookies;
          const token = cookies?.access_token;
          return token || ExtractJwt.fromAuthHeaderAsBearerToken()(req);
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_ACCESS_SECRET', { infer: true }),
    });
  }

  validate(payload: JwtPayload): JwtPayload {
    if (!payload || !payload.userId || !payload.role) {
      throw new UnauthorizedException('Invalid token payload.');
    }
    return {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
      sessionId: payload.sessionId,
      deviceFingerprint: payload.deviceFingerprint,
    };
  }
}
