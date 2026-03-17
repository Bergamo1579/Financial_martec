import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { env } from '@/common/config/env';

@Injectable()
export class InternalSyncGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
    }>();
    const secret = request.headers['x-internal-sync-secret'];

    if (secret !== env.INTERNAL_SYNC_SECRET) {
      throw new UnauthorizedException('Chave interna inválida.');
    }

    return true;
  }
}
