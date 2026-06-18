import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { CommonModule } from '../common/common.module';
import { CacheModule } from '../cache/cache.module';
import { EmailModule } from '../email/email.module';
import { DatabaseModule } from '../database/database.module';
import { RiskModule } from '../common/risk/risk.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({}),
    DatabaseModule,
    CacheModule,
    EmailModule,
    CommonModule,
    RiskModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, PassportModule],
})
export class AuthModule {}
