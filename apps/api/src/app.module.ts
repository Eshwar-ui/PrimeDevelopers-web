import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './common/health/health.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { MIN_JWT_SECRET_LENGTH } from './modules/auth/token-claims';
import { NoStoreInterceptor } from './common/no-store.interceptor';
import { THROTTLERS } from './common/throttle';
import { AuthModule } from './modules/auth/auth.module';
import { ContentModule } from './modules/content/content.module';
import { PropertiesModule } from './modules/properties/properties.module';
import { NewsModule } from './modules/news/news.module';
import { LeadsModule } from './modules/leads/leads.module';
import { MailModule } from './modules/mail/mail.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { TrackerSyncModule } from './modules/tracker-sync/tracker-sync.module';
import { MediaModule } from './modules/media/media.module';
import { CspModule } from './modules/csp/csp.module';

/** Fail at startup with the variable names, instead of a Prisma stack trace. */
export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const missing = ['DATABASE_URL', 'JWT_ACCESS_SECRET'].filter((key) => !config[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(', ')}. ` +
        'Copy apps/api/.env.example to apps/api/.env and fill it in (see README "Local setup").',
    );
  }
  const secret = String(config.JWT_ACCESS_SECRET);
  if (secret.length < MIN_JWT_SECRET_LENGTH) {
    throw new Error(
      `JWT_ACCESS_SECRET is ${secret.length} characters; at least ${MIN_JWT_SECRET_LENGTH} are required. ` +
        'Generate one with: openssl rand -hex 64',
    );
  }
  return config;
}

@Module({
  imports: [
    /**
     * Environment: local files in development, real process variables in
     * production.
     *
     * In production the deploy (scripts/aws/02-deploy-api.sh) supplies the
     * values from SSM as real process variables. dotenv never
     * overwrites a variable that is already set, so a stray file could not
     * shadow them even if one were deployed.
     *
     * Locally, `.env.<NODE_ENV>` wins over `.env` when it exists. A bare
     * `nest start` leaves NODE_ENV unset, so it falls back to `development`
     * rather than looking for `.env.undefined`.
     *
     * `.env` keeps the plain name deliberately: the Prisma CLI reads that file
     * and only that file to resolve `env("DATABASE_URL")` in schema.prisma, so
     * renaming it would quietly break `db:pull`, `db:migrate` and `generate`.
     * It is the local-development file; production has no file at all.
     */
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [`.env.${process.env.NODE_ENV || 'development'}`, '.env'],
      // Fail at startup with the variable names, instead of a Prisma stack trace
      // or a web app that only says "Could not reach the server".
      validate: validateEnv,
    }),

    // The per-minute default for every route, plus a daily window used only by
    // routes marked @DailyLimit. See common/throttle.ts.
    ThrottlerModule.forRoot(THROTTLERS),

    PrismaModule,
    HealthModule,
    AuthModule,
    ContentModule,
    PropertiesModule,
    NewsModule,
    LeadsModule,
    MailModule,
    UploadsModule,
    TrackerSyncModule,
    MediaModule,
    CspModule,
  ],
  providers: [
    // Order matters: throttle before authenticating, so a flood of bad
    // credentials is rejected without a bcrypt comparison each.
    { provide: APP_GUARD, useClass: ThrottlerGuard },

    // Global, so authentication is the default and a new admin route that
    // forgets to declare it fails closed. Public routes opt out with @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_INTERCEPTOR, useClass: NoStoreInterceptor },
  ],
})
export class AppModule {}
