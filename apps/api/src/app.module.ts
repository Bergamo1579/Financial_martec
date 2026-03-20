import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'crypto';
import { PrismaModule } from '@/common/prisma/prisma.module';
import { RedisModule } from '@/common/redis/redis.module';
import { isProduction } from '@/common/config/env';
import { AppAreaModule } from '@/modules/app-area/app-area.module';
import { AuthModule } from '@/modules/auth/auth.module';
import { AuditModule } from '@/modules/audit/audit.module';
import { BillingCoreModule } from '@/modules/billing-core/billing-core.module';
import { DashboardModule } from '@/modules/dashboard/dashboard.module';
import { HealthModule } from '@/modules/health/health.module';
import { PedagogicalIntegrationModule } from '@/modules/integration/pedagogical/pedagogical.module';
import { IamModule } from '@/modules/iam/iam.module';
import { CompaniesModule } from '@/modules/read-models/companies/companies.module';
import { StudentsModule } from '@/modules/read-models/students/students.module';
import { SyncModule } from '@/modules/sync/sync.module';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: isProduction ? 'info' : 'debug',
        transport: isProduction
          ? undefined
          : {
              target: 'pino-pretty',
              options: {
                colorize: true,
                singleLine: true,
              },
            },
        genReqId: (request) => {
          const headerRequestId = request.headers['x-request-id'];
          return Array.isArray(headerRequestId)
            ? (headerRequestId[0] ?? randomUUID())
            : (headerRequestId ?? randomUUID());
        },
        customProps: (request) => ({
          requestId: request.id,
        }),
      },
    }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: 60,
      },
      {
        name: 'auth',
        ttl: 60_000,
        limit: 10,
      },
    ]),
    PrismaModule,
    RedisModule,
    AppAreaModule,
    AuthModule,
    AuditModule,
    BillingCoreModule,
    DashboardModule,
    HealthModule,
    IamModule,
    PedagogicalIntegrationModule,
    CompaniesModule,
    StudentsModule,
    SyncModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
