import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Customer, Employee, EmployeeRole } from '@prisma/client';
import bcrypt from 'bcrypt';
import * as speakeasy from 'speakeasy';
import * as qrcode from 'qrcode';
import { randomBytes, randomInt } from 'node:crypto';

import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../cache/redis.service';
import { EmailService } from '../email/email.service';
import { validatePassword } from '../common/validation/password-policy';
import type { EnvironmentVariables } from '../config/environment';
import { RiskService } from '../common/risk/risk.service';

export type LoginResponse =
  | { step: '2fa'; userId: string; email: string }
  | { step: 'otp'; userId: string; email: string }
  | {
      step: 'complete';
      accessToken: string;
      refreshToken: string;
      user: Omit<Customer | Employee, 'passwordHash' | 'twoFactorSecret'> & {
        role: string;
      };
    };

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly email: EmailService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<EnvironmentVariables, true>,
    private readonly riskService: RiskService,
  ) {}

  // 1. User Registration (Customer only in this phase)
  async registerCustomer(dto: {
    fullName: string;
    email: string;
    phone: string;
    password: string;
  }): Promise<Omit<Customer, 'passwordHash'>> {
    const existing = await this.prisma.customer.findFirst({
      where: { OR: [{ email: dto.email }, { phone: dto.phone }] },
    });
    if (existing) {
      throw new ConflictException(
        'Customer with this email or phone already exists.',
      );
    }

    // Enforce password policy
    const policy = validatePassword(dto.password);
    if (!policy.isValid) {
      throw new BadRequestException(policy.errors.join(' '));
    }

    const saltRounds = parseInt(
      this.configService.get('BCRYPT_SALT_ROUNDS', { infer: true }) ?? '12',
      10,
    );
    const passwordHash = await bcrypt.hash(dto.password, saltRounds);

    // Generate unique customer number
    const customerNumber = 'CUST-' + randomInt(100000, 999999).toString();

    const customer = await this.prisma.customer.create({
      data: {
        fullName: dto.fullName,
        email: dto.email,
        phone: dto.phone,
        customerNumber,
        passwordHash,
        status: 'DRAFT',
      },
    });

    // Send email verification code
    await this.sendEmailVerification(customer.id, customer.email);

    const result = { ...customer };
    delete (result as { passwordHash?: string | null }).passwordHash;
    return result;
  }

  // Helper: Handle failed logins, lockout states and create audit logs
  private async handleFailedLoginAttempt(email: string, ipAddress: string) {
    const emailRes = await this.riskService.trackFailedLogin(email);
    const ipRes = await this.riskService.trackFailedLogin(ipAddress);

    if (emailRes.isLocked || ipRes.isLocked) {
      let user: Customer | Employee | null =
        await this.prisma.customer.findUnique({ where: { email } });
      if (!user) {
        user = await this.prisma.employee.findUnique({ where: { email } });
      }

      const userId = user?.id || 'unknown';
      const isCustomer = user ? !('role' in user) : false;

      if (user && isCustomer) {
        await this.prisma.customer.update({
          where: { id: user.id },
          data: { status: 'SUSPENDED' },
        });
      }

      await this.prisma.auditLog.create({
        data: {
          actorId: user && !isCustomer ? user.id : null,
          customerId: user && isCustomer ? user.id : null,
          action: 'SUSPICIOUS_FAILED_LOGINS',
          entityType: 'UserSession',
          entityId: userId,
          ipAddress: ipAddress || 'unknown',
          userAgent: 'system',
        },
      });
    }
  }

  // 2. Initiate Login (Customer or Employee/Admin)
  async initiateLogin(
    dto: { email: string; password: string },
    ipAddress?: string,
    userAgent?: string,
  ): Promise<LoginResponse> {
    const lockoutEmail = dto.email;
    const lockoutIp = ipAddress || 'unknown';

    const isEmailLocked = await this.riskService.isLockedOut(lockoutEmail);
    const isIpLocked = await this.riskService.isLockedOut(lockoutIp);

    if (isEmailLocked || isIpLocked) {
      throw new UnauthorizedException(
        'Too many failed login attempts. Account temporarily locked.',
      );
    }

    let user: Customer | Employee | null = null;
    let isCustomer = true;

    // Search Customer
    user = await this.prisma.customer.findUnique({
      where: { email: dto.email },
    });

    // Fallback to Employee
    if (!user) {
      user = await this.prisma.employee.findUnique({
        where: { email: dto.email },
      });
      isCustomer = false;
    }

    if (!user || !user.passwordHash) {
      await this.handleFailedLoginAttempt(lockoutEmail, lockoutIp);
      await this.auditLogin(
        'unknown',
        'LOGIN_FAIL',
        'Email not found',
        ipAddress,
        userAgent,
      );
      throw new UnauthorizedException('Invalid email or password.');
    }

    // Verify status/active
    if (isCustomer && (user as Customer).status === 'SUSPENDED') {
      throw new UnauthorizedException('Account is suspended.');
    }
    if (!isCustomer && !(user as Employee).active) {
      throw new UnauthorizedException('Employee account is inactive.');
    }

    // Verify Password
    const passwordMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatch) {
      await this.handleFailedLoginAttempt(lockoutEmail, lockoutIp);
      await this.auditLogin(
        user.id,
        'LOGIN_FAIL',
        'Incorrect password',
        ipAddress,
        userAgent,
      );
      throw new UnauthorizedException('Invalid email or password.');
    }

    // Reset failed logins upon correct credentials (prior to 2FA/OTP verification)
    await this.riskService.resetFailedLogins(lockoutEmail);
    await this.riskService.resetFailedLogins(lockoutIp);

    // If 2FA enabled
    if (user.twoFactorEnabled) {
      return { step: '2fa', userId: user.id, email: user.email };
    }

    // Otherwise, require OTP (Email verification OTP via Upstash Redis + Brevo)
    const otp = randomInt(100000, 999999).toString();
    const ttlSeconds = parseInt(
      this.configService.get('OTP_TTL_SECONDS', { infer: true }) ?? '300',
      10,
    );
    await this.redis.setOtp(user.id, otp, ttlSeconds);

    // Send OTP email
    await this.email.sendTemplateEmail(
      'otp',
      { email: user.email, name: user.fullName },
      { code: otp },
    );

    return { step: 'otp', userId: user.id, email: user.email };
  }

  // 3. Verify 2FA
  async verify2Fa(
    userId: string,
    code: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    user: Omit<Customer | Employee, 'passwordHash' | 'twoFactorSecret'> & {
      role: string;
    };
  }> {
    const user = await this.findUserById(userId);
    if (!user || !user.twoFactorSecret) {
      throw new BadRequestException('2FA is not set up for this user.');
    }

    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: code,
      window: 1, // Allow 30 seconds clock drift
    });

    if (!verified) {
      await this.handleFailedLoginAttempt(user.email, ipAddress || 'unknown');
      await this.auditLogin(
        userId,
        'LOGIN_FAIL_2FA',
        'Invalid 2FA code',
        ipAddress,
        userAgent,
      );
      throw new UnauthorizedException('Invalid 2FA code.');
    }

    // Clear locks on success
    await this.riskService.resetFailedLogins(user.email);
    if (ipAddress) {
      await this.riskService.resetFailedLogins(ipAddress);
    }

    return this.completeLogin(user, ipAddress, userAgent);
  }

  // 4. Verify OTP
  async verifyOtp(
    userId: string,
    code: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    user: Omit<Customer | Employee, 'passwordHash' | 'twoFactorSecret'> & {
      role: string;
    };
  }> {
    const user = await this.findUserById(userId);
    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const storedOtp = await this.redis.getOtp(userId);
    if (!storedOtp || storedOtp !== code) {
      await this.handleFailedLoginAttempt(user.email, ipAddress || 'unknown');
      await this.auditLogin(
        userId,
        'LOGIN_FAIL_OTP',
        'Invalid or expired OTP',
        ipAddress,
        userAgent,
      );
      throw new UnauthorizedException('Invalid or expired OTP code.');
    }

    // Clean up OTP key on success
    await this.redis.deleteOtp(userId);

    // Clear locks on success
    await this.riskService.resetFailedLogins(user.email);
    if (ipAddress) {
      await this.riskService.resetFailedLogins(ipAddress);
    }

    return this.completeLogin(user, ipAddress, userAgent);
  }

  // 5. Generate and setup 2FA
  async setup2Fa(
    userId: string,
  ): Promise<{ secret: string; qrCodeDataUrl: string }> {
    const user = await this.findUserById(userId);
    if (!user) {
      throw new NotFoundException('User not found.');
    }
    const secret = speakeasy.generateSecret({
      name: `NexusBanking:${user.email}`,
    });

    // Save temporary secret to Redis cache for verification before enabling
    await this.redis.setCache(`2fa-temp:${userId}`, secret.base32, 600); // 10 minutes TTL

    const qrCodeDataUrl = await qrcode.toDataURL(secret.otpauth_url ?? '');
    return {
      secret: secret.base32,
      qrCodeDataUrl,
    };
  }

  // Enable 2FA after validation
  async enable2Fa(userId: string, code: string): Promise<void> {
    const tempSecret = await this.redis.getCache(`2fa-temp:${userId}`);
    if (!tempSecret) {
      throw new BadRequestException(
        '2FA setup session expired. Please restart setup.',
      );
    }

    const verified = speakeasy.totp.verify({
      secret: tempSecret,
      encoding: 'base32',
      token: code,
      window: 1,
    });

    if (!verified) {
      throw new BadRequestException('Invalid verification code.');
    }

    const updateData = { twoFactorSecret: tempSecret, twoFactorEnabled: true };
    const isCustomer = await this.isCustomerUser(userId);

    if (isCustomer) {
      await this.prisma.customer.update({
        where: { id: userId },
        data: updateData,
      });
    } else {
      await this.prisma.employee.update({
        where: { id: userId },
        data: updateData,
      });
    }

    await this.redis.deleteCache(`2fa-temp:${userId}`);
  }

  // 6. Refresh Token rotation
  async refreshTokens(
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get('JWT_REFRESH_SECRET', { infer: true }),
      });

      const user = await this.findUserById(payload.userId);
      if (!user) {
        throw new UnauthorizedException('User not found.');
      }

      const activeSession = await this.redis.getSession(payload.userId);
      if (!activeSession) {
        throw new UnauthorizedException('Session expired.');
      }

      const sessionData = JSON.parse(activeSession) as { sessionId: string };
      if (sessionData.sessionId !== payload.sessionId) {
        throw new UnauthorizedException('Session hijacked or rotated.');
      }

      // Generate new tokens
      const newSessionId = randomBytes(16).toString('hex');
      const tokens = await this.generateTokenPair(user, newSessionId);

      // Update active session in Redis
      sessionData.sessionId = newSessionId;
      const sessionTimeout = 3600 * 24; // 24 hours session timeout
      await this.redis.setSession(
        user.id,
        JSON.stringify(sessionData),
        sessionTimeout,
      );

      return tokens;
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }
  }

  // 7. Logout / Session Invalidation
  async logout(userId: string): Promise<void> {
    await this.redis.deleteSession(userId);
  }

  // 8. Send Email Verification
  async sendEmailVerification(userId: string, email: string): Promise<void> {
    const code = randomInt(100000, 999999).toString();
    await this.redis.setOtp(`email-verify:${userId}`, code, 1800); // 30 minutes TTL

    await this.email.sendTemplateEmail(
      'welcome',
      { email, name: 'Nexus Customer' },
      { code },
    );
  }

  // Verify Email Code
  async verifyEmail(userId: string, code: string): Promise<void> {
    const storedCode = await this.redis.getOtp(`email-verify:${userId}`);
    if (!storedCode || storedCode !== code) {
      throw new BadRequestException(
        'Invalid or expired email verification code.',
      );
    }

    await this.redis.deleteOtp(`email-verify:${userId}`);

    const isCustomer = await this.isCustomerUser(userId);
    if (isCustomer) {
      await this.prisma.customer.update({
        where: { id: userId },
        data: { emailVerified: true, status: 'KYC_REVIEW' }, // Moves to KYC phase automatically
      });
    } else {
      await this.prisma.employee.update({
        where: { id: userId },
        data: { emailVerified: true },
      });
    }
  }

  // 9. Password Reset Request
  async requestPasswordReset(email: string): Promise<void> {
    let user: Customer | Employee | null =
      await this.prisma.customer.findUnique({ where: { email } });
    if (!user) {
      user = await this.prisma.employee.findUnique({ where: { email } });
    }

    if (!user) {
      // Avoid enum leak by resolving silently
      return;
    }

    const code = randomInt(100000, 999999).toString();
    await this.redis.setOtp(`password-reset:${user.id}`, code, 900); // 15 minutes TTL

    await this.email.sendTemplateEmail(
      'password-reset',
      { email, name: user.fullName },
      { code },
    );
  }

  // Execute Password Reset
  async resetPassword(dto: {
    email: string;
    code: string;
    password: string;
  }): Promise<void> {
    let user: Customer | Employee | null =
      await this.prisma.customer.findUnique({
        where: { email: dto.email },
      });
    if (!user) {
      user = await this.prisma.employee.findUnique({
        where: { email: dto.email },
      });
    }

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const storedCode = await this.redis.getOtp(`password-reset:${user.id}`);
    if (!storedCode || storedCode !== dto.code) {
      throw new BadRequestException('Invalid or expired password reset code.');
    }

    // Enforce password policy
    const policy = validatePassword(dto.password);
    if (!policy.isValid) {
      throw new BadRequestException(policy.errors.join(' '));
    }

    const saltRounds = parseInt(
      this.configService.get('BCRYPT_SALT_ROUNDS', { infer: true }) ?? '12',
      10,
    );
    const passwordHash = await bcrypt.hash(dto.password, saltRounds);

    const isCustomer = await this.isCustomerUser(user.id);
    if (isCustomer) {
      await this.prisma.customer.update({
        where: { id: user.id },
        data: { passwordHash },
      });
    } else {
      await this.prisma.employee.update({
        where: { id: user.id },
        data: { passwordHash },
      });
    }

    // Clean up reset code and active sessions to force re-login
    await this.redis.deleteOtp(`password-reset:${user.id}`);
    await this.redis.deleteSession(user.id);
  }

  // Helper: Complete Login, Audit, Generate Session and Tokens
  private async completeLogin(
    user: Customer | Employee,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    user: Omit<Customer | Employee, 'passwordHash' | 'twoFactorSecret'> & {
      role: string;
    };
  }> {
    const sessionId = randomBytes(16).toString('hex');
    const tokens = await this.generateTokenPair(user, sessionId);

    // Save Active Session in Redis
    const sessionData = {
      userId: user.id,
      role: this.getUserRole(user),
      sessionId,
      ipAddress,
      userAgent,
      createdAt: new Date().toISOString(),
    };

    const sessionTimeout = 3600 * 24; // 24 hours session timeout
    await this.redis.setSession(
      user.id,
      JSON.stringify(sessionData),
      sessionTimeout,
    );

    // Audit new device login
    const isNewDevice = await this.riskService.checkNewDevice(
      user.id,
      userAgent || 'unknown',
    );
    if (isNewDevice) {
      const isCustomer = !('role' in user);
      await this.prisma.auditLog.create({
        data: {
          actorId: isCustomer ? null : user.id,
          customerId: isCustomer ? user.id : null,
          action: 'NEW_DEVICE_LOGIN',
          entityType: 'UserSession',
          entityId: user.id,
          ipAddress: ipAddress ?? 'unknown',
          userAgent: userAgent ?? 'unknown',
        },
      });

      // Send email alert for new device login
      try {
        await this.email.sendTemplateEmail(
          'support-alert',
          { email: user.email, name: user.fullName },
          {
            message: `We detected a successful login from a new device: ${userAgent || 'unknown'}. If this wasn't you, please reset your password.`,
          },
        );
      } catch (err) {}
    }

    // Audit login success
    await this.auditLogin(
      user.id,
      'LOGIN_SUCCESS',
      'Session established',
      ipAddress,
      userAgent,
    );

    const userProfile = { ...user } as Record<string, any>;
    delete userProfile.passwordHash;
    delete userProfile.twoFactorSecret;

    return {
      ...tokens,
      user: {
        ...(userProfile as Omit<
          Customer | Employee,
          'passwordHash' | 'twoFactorSecret'
        >),
        role: sessionData.role,
      },
    };
  }

  // Helper: Token Generation
  private async generateTokenPair(
    user: Customer | Employee,
    sessionId: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const role = this.getUserRole(user);

    const payload = {
      userId: user.id,
      email: user.email,
      role,
      sessionId,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_ACCESS_SECRET', { infer: true }),
      expiresIn:
        this.configService.get('JWT_ACCESS_TTL', { infer: true }) ?? '15m',
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_REFRESH_SECRET', { infer: true }),
      expiresIn:
        this.configService.get('JWT_REFRESH_TTL', { infer: true }) ?? '7d',
    });

    return { accessToken, refreshToken };
  }

  // Helper: Determine User Role
  private getUserRole(user: Customer | Employee): string {
    if ('role' in user) {
      return user.role; // EmployeeRole enum values (e.g. CEO, branch manager)
    }
    return 'CUSTOMER';
  }

  // Helper: Find User by ID
  private async findUserById(
    userId: string,
  ): Promise<Customer | Employee | null> {
    let user: Customer | Employee | null =
      await this.prisma.customer.findUnique({
        where: { id: userId },
      });
    if (!user) {
      user = await this.prisma.employee.findUnique({ where: { id: userId } });
    }
    return user;
  }

  // Helper: Is Customer
  private async isCustomerUser(userId: string): Promise<boolean> {
    const count = await this.prisma.customer.count({ where: { id: userId } });
    return count > 0;
  }

  // Helper: Audit Login Activity
  private async auditLogin(
    actorId: string,
    action: string,
    detail: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    try {
      // Verify actor exists as Employee (AuditLog constraint requires Employee ID reference in Prisma schema)
      const isEmployee =
        actorId !== 'unknown' &&
        actorId !== 'customer' &&
        (await this.prisma.employee.count({ where: { id: actorId } })) > 0;

      const isCustomer =
        !isEmployee &&
        actorId !== 'unknown' &&
        (await this.prisma.customer.count({ where: { id: actorId } })) > 0;

      await this.prisma.auditLog.create({
        data: {
          actorId: isEmployee ? actorId : null,
          customerId: isCustomer ? actorId : null,
          action,
          entityType: 'UserSession',
          entityId: actorId,
          ipAddress: ipAddress ?? 'unknown',
          userAgent: userAgent ?? 'unknown',
        },
      });
    } catch (error) {
      console.error('Failed to log login audit activity:', error);
    }
  }
}
