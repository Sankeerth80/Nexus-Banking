import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { AuthService, LoginResponse } from './auth.service';
import { CaptchaGuard } from '../common/guards/captcha.guard';
import { RateLimiterGuard } from '../common/guards/rate-limiter.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get current user profile from session' })
  async me(@Req() req: any) {
    return {
      userId: req.user.userId,
      email: req.user.email,
      role: req.user.role,
    };
  }

  @Post('register')
  @UseGuards(CaptchaGuard)
  @ApiOperation({ summary: 'Register a new customer profile' })
  @ApiResponse({
    status: 201,
    description: 'Customer profile successfully created.',
  })
  async register(@Body() dto: any) {
    return this.authService.registerCustomer(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RateLimiterGuard, CaptchaGuard)
  @ApiOperation({ summary: 'Initiate login process' })
  @ApiResponse({
    status: 200,
    description: 'Login details verified. Triggers 2FA or OTP.',
  })
  async login(
    @Body() dto: any,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip = req.ip || 'unknown';
    const ua = req.headers['user-agent'] || 'unknown';

    const loginResult = await this.authService.initiateLogin(dto, ip, ua);

    if (loginResult.step === 'complete') {
      this.setCookies(res, loginResult.accessToken, loginResult.refreshToken);
      return { step: 'complete', user: loginResult.user };
    }

    return {
      step: loginResult.step,
      userId: loginResult.userId,
      email: loginResult.email,
    };
  }

  @Post('verify-2fa')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify TOTP 2FA code' })
  @ApiResponse({
    status: 200,
    description: '2FA code verified. Session established.',
  })
  async verify2Fa(
    @Body() dto: { userId: string; code: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip = req.ip || 'unknown';
    const ua = req.headers['user-agent'] || 'unknown';

    const result = await this.authService.verify2Fa(
      dto.userId,
      dto.code,
      ip,
      ua,
    );
    this.setCookies(res, result.accessToken, result.refreshToken);

    return { step: 'complete', user: result.user };
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email OTP' })
  @ApiResponse({
    status: 200,
    description: 'OTP verified. Session established.',
  })
  async verifyOtp(
    @Body() dto: { userId: string; code: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip = req.ip || 'unknown';
    const ua = req.headers['user-agent'] || 'unknown';

    const result = await this.authService.verifyOtp(
      dto.userId,
      dto.code,
      ip,
      ua,
    );
    this.setCookies(res, result.accessToken, result.refreshToken);

    return { step: 'complete', user: result.user };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'Tokens rotated successfully.' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies['refresh_token'] || '';
    const result = await this.authService.refreshTokens(token);
    this.setCookies(res, result.accessToken, result.refreshToken);
    return { status: 'ok' };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Log out active session' })
  @ApiResponse({ status: 200, description: 'Session terminated.' })
  async logout(@Req() req: any, @Res({ passthrough: true }) res: Response) {
    const userId = req.user.userId;
    await this.authService.logout(userId);
    this.clearCookies(res);
    return { status: 'ok' };
  }

  @Post('verify-email-request')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request email verification code' })
  async verifyEmailRequest(@Req() req: any) {
    const { userId, email } = req.user;
    await this.authService.sendEmailVerification(userId, email);
    return { status: 'ok' };
  }

  @Post('verify-email')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email address' })
  async verifyEmail(@Req() req: any, @Body() dto: { code: string }) {
    const userId = req.user.userId;
    await this.authService.verifyEmail(userId, dto.code);
    return { status: 'ok' };
  }

  @Post('reset-password-request')
  @UseGuards(CaptchaGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset' })
  async resetPasswordRequest(@Body() dto: { email: string }) {
    await this.authService.requestPasswordReset(dto.email);
    return { status: 'ok' };
  }

  @Post('reset-password')
  @UseGuards(CaptchaGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit password reset' })
  async resetPassword(
    @Body() dto: { email: string; code: string; password: any },
  ) {
    await this.authService.resetPassword(dto);
    return { status: 'ok' };
  }

  @Post('2fa/setup')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get TOTP 2FA secret and QR code' })
  async setup2Fa(@Req() req: any) {
    return this.authService.setup2Fa(req.user.userId);
  }

  @Post('2fa/enable')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate and enable 2FA' })
  async enable2Fa(@Req() req: any, @Body() dto: { code: string }) {
    await this.authService.enable2Fa(req.user.userId, dto.code);
    return { status: 'ok' };
  }

  // Helpers to set and clear cookies securely
  private setCookies(res: Response, accessToken: string, refreshToken: string) {
    const isProd = process.env.NODE_ENV === 'production';

    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 15 * 60 * 1000, // 15 mins
    });

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
  }

  private clearCookies(res: Response) {
    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/' });
  }
}
