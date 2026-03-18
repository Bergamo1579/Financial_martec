import { ServiceUnavailableException } from '@nestjs/common';

export class ExternalDependencyException extends ServiceUnavailableException {
  constructor(message: string, details?: Record<string, unknown>) {
    super({
      code: 'external_dependency_failed',
      message,
      details,
    });
  }
}
