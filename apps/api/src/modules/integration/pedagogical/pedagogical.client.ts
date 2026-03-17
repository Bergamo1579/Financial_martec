import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import type {
  PedagogicalCompany,
  PedagogicalStudent,
} from '@financial-martec/contracts';
import { env } from '@/common/config/env';
import { RedisService } from '@/common/redis/redis.service';

const AUTH_CACHE_KEY = 'pedagogical:jwt';

@Injectable()
export class PedagogicalClientService {
  private readonly logger = new Logger(PedagogicalClientService.name);

  constructor(private readonly redis: RedisService) {}

  async listCompanies(): Promise<PedagogicalCompany[]> {
    return this.request<PedagogicalCompany[]>('/empresas');
  }

  async getCompany(id: string): Promise<PedagogicalCompany> {
    return this.request<PedagogicalCompany>(`/empresas/${id}`);
  }

  async listStudents(): Promise<PedagogicalStudent[]> {
    return this.request<PedagogicalStudent[]>('/alunos');
  }

  async getStudent(id: string): Promise<PedagogicalStudent> {
    return this.request<PedagogicalStudent>(`/alunos/${id}`);
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const headers = await this.buildHeaders(init?.headers);
    const response = await fetch(`${env.PEDAGOGICAL_API_BASE_URL}${path}`, {
      ...init,
      headers,
    });

    if (!response.ok) {
      this.logger.error(`Pedagogical request failed for ${path}: ${response.status}`);
      throw new InternalServerErrorException(
        `Falha ao consultar o sistema pedagógico (${response.status}).`,
      );
    }

    return (await response.json()) as T;
  }

  private async buildHeaders(headers?: HeadersInit) {
    const resolvedHeaders = new Headers(headers);
    resolvedHeaders.set('content-type', 'application/json');

    if (env.PEDAGOGICAL_API_KEY) {
      resolvedHeaders.set('x-api-key', env.PEDAGOGICAL_API_KEY);
      return resolvedHeaders;
    }

    const token = await this.getJwtToken();
    resolvedHeaders.set('authorization', `Bearer ${token}`);
    return resolvedHeaders;
  }

  private async getJwtToken() {
    const cache = await this.redis.getClient().get(AUTH_CACHE_KEY);
    if (cache) {
      return cache;
    }

    if (!env.PEDAGOGICAL_USERNAME || !env.PEDAGOGICAL_PASSWORD) {
      throw new InternalServerErrorException(
        'Credenciais do sistema pedagógico não configuradas.',
      );
    }

    const response = await fetch(`${env.PEDAGOGICAL_API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        username: env.PEDAGOGICAL_USERNAME,
        password: env.PEDAGOGICAL_PASSWORD,
      }),
    });

    if (!response.ok) {
      throw new InternalServerErrorException(
        'Falha ao autenticar com a API pedagógica.',
      );
    }

    const body = (await response.json()) as { token: string };
    await this.redis.getClient().set(AUTH_CACHE_KEY, body.token, 'EX', 5 * 60);
    return body.token;
  }
}
