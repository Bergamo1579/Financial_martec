import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { env } from './common/config/env';
import { ApiExceptionFilter } from './common/filters/api-exception.filter';
import { buildValidationErrorDetails } from './common/lib/validation.util';

type ConfigureAppOptions = {
  withSwagger?: boolean;
};

type ProxyAwareApp = {
  set(setting: string, value: boolean | number | string): void;
};

function resolveTrustProxySetting() {
  const value = env.TRUST_PROXY?.trim();
  if (!value) {
    return false;
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  if (/^\d+$/.test(value)) {
    return Number(value);
  }

  return value;
}

function applyTrustProxy(app: INestApplication) {
  const instance = app.getHttpAdapter().getInstance() as unknown;
  if (
    typeof instance === 'object' &&
    instance !== null &&
    'set' in instance &&
    typeof (instance as ProxyAwareApp).set === 'function'
  ) {
    (instance as ProxyAwareApp).set('trust proxy', resolveTrustProxySetting());
  }
}

export function configureApp(app: INestApplication, options?: ConfigureAppOptions) {
  app.setGlobalPrefix('v1');
  applyTrustProxy(app);
  app.useLogger(app.get(Logger));
  app.use(cookieParser());
  app.useGlobalFilters(new ApiExceptionFilter());
  app.use(
    helmet({
      crossOriginResourcePolicy: false,
    }),
  );
  app.enableCors({
    origin: env.CORS_ORIGIN.split(',').map((origin) => origin.trim()),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) =>
        new BadRequestException({
          code: 'validation_error',
          message: 'Validation failed.',
          details: buildValidationErrorDetails(errors),
        }),
    }),
  );

  if (options?.withSwagger) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Financial Martec API')
      .setDescription('API do backoffice financeiro com integracao API-first ao sistema pedagogico')
      .setVersion('0.1.0')
      .addBearerAuth()
      .addCookieAuth('fm_access_token')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('reference', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });
  }
}
