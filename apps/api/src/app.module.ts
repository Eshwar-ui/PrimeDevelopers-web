import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './common/health/health.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { AuthModule } from './modules/auth/auth.module';
import { ContentModule } from './modules/content/content.module';
import { PropertiesModule } from './modules/properties/properties.module';
import { NewsModule } from './modules/news/news.module';
import { LeadsModule } from './modules/leads/leads.module';
import { MailModule } from './modules/mail/mail.module';
import { UploadsModule } from './modules/uploads/uploads.module';

@Module({
  imports: [
    /**
     * Environment: local files in development, real process variables in
     * production.
     *
     * On Render none of these files exist — the values are set in the dashboard
     * (see render.yaml) and arrive as real process variables. dotenv never
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
    }),

    // Default ceiling for every route. Login and the public lead endpoint
    // tighten this further with their own @Throttle — they are the
    // unauthenticated writes and the only obvious abuse targets.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),

    PrismaModule,
    HealthModule,
    AuthModule,
    ContentModule,
    PropertiesModule,
    NewsModule,
    LeadsModule,
    MailModule,
    UploadsModule,
  ],
  providers: [
    // Order matters: throttle before authenticating, so a flood of bad
    // credentials is rejected without a bcrypt comparison each.
    { provide: APP_GUARD, useClass: ThrottlerGuard },

    // Global, so authentication is the default and a new admin route that
    // forgets to declare it fails closed. Public routes opt out with @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
