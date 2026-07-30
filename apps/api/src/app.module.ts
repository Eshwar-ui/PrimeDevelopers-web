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
import { UploadsModule } from './modules/uploads/uploads.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

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
