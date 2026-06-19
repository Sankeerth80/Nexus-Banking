import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../cache/redis.service';

@Injectable()
export class RiskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  // Tracks failed logins per email or IP address. Lockout threshold is 5 attempts in 15 mins.
  async trackFailedLogin(
    emailOrIp: string,
  ): Promise<{ isLocked: boolean; attemptsLeft: number }> {
    const key = `failed-logins:${emailOrIp.toLowerCase()}`;
    const client = this.redis.getClient();
    const count = await client.incr(key);

    if (count === 1) {
      await client.expire(key, 900); // 15 minutes window
    }

    const maxAttempts = 5;
    const isLocked = count >= maxAttempts;
    const attemptsLeft = Math.max(0, maxAttempts - count);

    return { isLocked, attemptsLeft };
  }

  // Check if email or IP is currently locked out
  async isLockedOut(emailOrIp: string): Promise<boolean> {
    const key = `failed-logins:${emailOrIp.toLowerCase()}`;
    const client = this.redis.getClient();
    const countStr = await client.get<string>(key);
    if (!countStr) return false;

    const count = parseInt(String(countStr), 10);
    return count >= 5;
  }

  // Reset failed login counter upon successful authentication
  async resetFailedLogins(emailOrIp: string): Promise<void> {
    const key = `failed-logins:${emailOrIp.toLowerCase()}`;
    const client = this.redis.getClient();
    await client.del(key);
  }

  // Detects if current userAgent has been used by this user before.
  // Returns true if the device (userAgent) is new/unseen.
  async checkNewDevice(userId: string, currentUa: string): Promise<boolean> {
    // Check if the user has prior successful logins.
    const totalLoginsCount = await this.prisma.auditLog.count({
      where: {
        OR: [{ actorId: userId }, { customerId: userId }],
        action: 'LOGIN_SUCCESS',
      },
    });

    if (totalLoginsCount === 0) {
      // First login ever, not considered a "new" device threat alert
      return false;
    }

    // Check if there is a successful login with the exact current userAgent
    const exactDeviceLogin = await this.prisma.auditLog.findFirst({
      where: {
        OR: [{ actorId: userId }, { customerId: userId }],
        action: 'LOGIN_SUCCESS',
        userAgent: currentUa,
      },
    });

    // If they have logged in before, but never with this user agent, it is a new device
    return !exactDeviceLogin;
  }
}
