import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import type { ApiError } from '@financial-martec/contracts';

function getDefaultCode(status: number) {
  switch (status) {
    case 400:
      return 'bad_request';
    case 401:
      return 'unauthorized';
    case 403:
      return 'forbidden';
    case 404:
      return 'not_found';
    case 409:
      return 'conflict';
    case 422:
      return 'unprocessable_entity';
    case 429:
      return 'too_many_requests';
    case 503:
      return 'service_unavailable';
    default:
      return 'internal_server_error';
  }
}

function normalizeHttpError(status: number, body: string | Record<string, unknown>): ApiError {
  if (typeof body === 'string') {
    return {
      code: getDefaultCode(status),
      message: body,
    };
  }

  const code = typeof body.code === 'string' ? body.code : getDefaultCode(status);
  const details = body.details;

  if (Array.isArray(body.message)) {
    return {
      code: body.code === 'validation_error' ? 'validation_error' : code,
      message: body.code === 'validation_error' ? 'Validation failed.' : 'Request failed.',
      details,
    };
  }

  return {
    code,
    message:
      typeof body.message === 'string'
        ? body.message
        : status >= 500
          ? 'Internal server error.'
          : 'Request failed.',
    ...(details !== undefined ? { details } : {}),
  };
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      response.status(status).json(normalizeHttpError(status, body as string | Record<string, unknown>));
      return;
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      code: 'internal_server_error',
      message: 'Internal server error.',
    } satisfies ApiError);
  }
}
