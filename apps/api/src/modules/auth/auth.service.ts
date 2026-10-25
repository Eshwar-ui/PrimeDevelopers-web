import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomBytes, createHash } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * A bcrypt hash of nothing in particular, compared against when no user
 * matches. Without it, "unknown email" returns in a fraction of the time
 * "wrong password" takes, which is enough to enumerate valid admin addresses.
 */
const DUMMY_HASH = '$2b$12$C6UzMDM.H6dfI/f/IKcEe.rTgvxLTsdmnPfKAbnPQ0Cd6TnFYSN6y';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async login(email: string, password: string): Promise<TokenPair> {
    const user = await this.prisma.websiteAdminUser.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok) throw new UnauthorizedException('Invalid email or password');

    return this.issue(user.id, user.email);
  }

  /**
   * Rotates on every use: the presented token is revoked and a new one issued.
   * A stolen refresh token is therefore usable at most once, and its use
   * invalidates the legitimate holder's copy — which surfaces the theft rather
   * than letting it persist silently.
   */
  async refresh(refreshToken: string): Promise<TokenPair> {
    const tokenHash = this.hash(refreshToken);
    const row = await this.prisma.websiteAdminRefreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    const now = new Date();

    if (!row) throw new UnauthorizedException('Invalid or expired refresh token');

    // A token that was already rotated away is being presented again. Either the
    // holder kept a stale copy, or someone else has it — and the two cannot be told
    // apart, so the safe answer is the same for both: end every session that admin
    // has. The browser reads the newest token from storage before refreshing
    // (apps/web/src/lib/api.js), so a legitimate second tab does not trip this.
    if (row.revokedAt) {
      await this.prisma.websiteAdminRefreshToken.updateMany({
        where: { userId: row.userId, revokedAt: null },
        data: { revokedAt: now },
      });
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    if (row.expiresAt < now) throw new UnauthorizedException('Invalid or expired refresh token');

    // Revoke-if-still-live in one statement. Two concurrent refreshes with the same
    // token used to both pass the check above and both get new tokens; now only
    // the one that flips the row wins.
    const { count } = await this.prisma.websiteAdminRefreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: now },
    });
    if (count !== 1) throw new UnauthorizedException('Invalid or expired refresh token');

    return this.issue(row.user.id, row.user.email);
  }

  /**
   * Idempotent by design — logging out with an already-revoked or unknown token
   * is a success, not an error. The caller's intent (be logged out) is
   * satisfied either way, and reporting "unknown token" would leak whether a
   * given token had ever existed.
   */
  async logout(refreshToken: string): Promise<void> {
    await this.prisma.websiteAdminRefreshToken.updateMany({
      where: { tokenHash: this.hash(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async issue(userId: string, email: string): Promise<TokenPair> {
    const accessToken = await this.jwt.signAsync(
      { sub: userId, email },
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get<string>('JWT_ACCESS_EXPIRY', '15m'),
      },
    );

    // Opaque random token rather than a second JWT. The database row is the
    // source of truth for whether it is still valid, so a signature would add
    // nothing but another secret to leak.
    const refreshToken = randomBytes(48).toString('base64url');
    const ttlMs = parseDuration(this.config.get<string>('JWT_REFRESH_EXPIRY', '7d'));

    await this.prisma.websiteAdminRefreshToken.create({
      data: {
        tokenHash: this.hash(refreshToken),
        userId,
        expiresAt: new Date(Date.now() + ttlMs),
      },
    });

    // Rows were never deleted, so every sign-in and every refresh left one behind
    // for good. Pruned here, per user, a day after they stop mattering — late
    // enough that a just-revoked token is still recognised as reused (above).
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await this.prisma.websiteAdminRefreshToken.deleteMany({
      where: { userId, OR: [{ expiresAt: { lt: dayAgo } }, { revokedAt: { lt: dayAgo } }] },
    });

    return { accessToken, refreshToken };
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}

/** Parses `15m` / `12h` / `7d` into milliseconds. */
export function parseDuration(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value.trim());
  if (!match) throw new Error(`Invalid duration: "${value}". Expected e.g. 15m, 12h, 7d.`);
  const units = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 } as const;
  return Number(match[1]) * units[match[2] as keyof typeof units];
}
