import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService, TokenPair } from './auth.service';
import { LoginDto, RefreshDto } from './dto/auth.dto';
import { Public } from '../../common/decorators/public.decorator';
import type { AuthedUser } from './jwt.strategy';
import { clearRefreshCookie, cookieModeEnabled, readRefreshCookie, setRefreshCookie } from './refresh-cookie';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private auth: AuthService,
    private config: ConfigService,
  ) {}

  private get cookieMode(): boolean {
    return cookieModeEnabled(this.config.get<string>('REFRESH_COOKIE'));
  }

  /**
   * In cookie mode the refresh token goes into an HttpOnly cookie and is left out of
   * the body, so the page's JavaScript never holds it (see refresh-cookie.ts).
   */
  private deliver(pair: TokenPair, res: Response): TokenPair | { accessToken: string } {
    if (!this.cookieMode) return pair;
    setRefreshCookie(res, pair.refreshToken, this.config.get<string>('JWT_REFRESH_EXPIRY', '7d'));
    return { accessToken: pair.accessToken };
  }

  // Tighter than the global ceiling: this is the one endpoint where guessing
  // repeatedly is the whole attack.
  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange admin credentials for a token pair' })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    return this.deliver(await this.auth.login(dto.email, dto.password), res);
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate a refresh token for a fresh pair' })
  async refresh(@Body() dto: RefreshDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = dto.refreshToken ?? readRefreshCookie(req);
    if (!token) throw new UnauthorizedException('Invalid or expired refresh token');
    try {
      return this.deliver(await this.auth.refresh(token), res);
    } catch (err) {
      // A cookie the server no longer honours is cleared, so the browser stops
      // presenting it on every visit.
      if (this.cookieMode) clearRefreshCookie(res);
      throw err;
    }
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke a refresh token' })
  async logout(@Body() dto: RefreshDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = dto.refreshToken ?? readRefreshCookie(req);
    if (token) await this.auth.logout(token);
    if (this.cookieMode) clearRefreshCookie(res);
  }

  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'The currently authenticated admin' })
  me(@Req() req: Request) {
    return req.user as AuthedUser;
  }
}
