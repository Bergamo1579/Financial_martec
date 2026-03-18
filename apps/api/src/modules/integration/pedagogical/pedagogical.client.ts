import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import type {
  PedagogicalCompany,
  PedagogicalStudent,
} from '@financial-martec/contracts';
import { env } from '@/common/config/env';
import { ExternalDependencyException } from '@/common/exceptions/external-dependency.exception';
import { RedisService } from '@/common/redis/redis.service';

const AUTH_CACHE_KEY = 'pedagogical:jwt';

type PedagogicalRequestContext = {
  headers: Headers;
  authMode: 'api-key' | 'jwt';
};

export type PedagogicalCollectionPage<T> = {
  items: T[];
  fetchDurationMs: number;
};

type PaginatedCollectionEnvelope<T> = {
  items: T[];
  nextPage: number | null;
};

@Injectable()
export class PedagogicalClientService {
  private readonly logger = new Logger(PedagogicalClientService.name);

  constructor(private readonly redis: RedisService) {}

  async listCompanies(): Promise<PedagogicalCompany[]> {
    return this.collectCollection(this.streamCompanies());
  }

  async getCompany(id: string): Promise<PedagogicalCompany> {
    return this.request<PedagogicalCompany>(`/empresas/${id}`);
  }

  async listStudents(): Promise<PedagogicalStudent[]> {
    return this.collectCollection(this.streamStudents());
  }

  async getStudent(id: string): Promise<PedagogicalStudent> {
    return this.request<PedagogicalStudent>(`/alunos/${id}`);
  }

  streamCompanies() {
    return this.iterateCollection<PedagogicalCompany>('/empresas');
  }

  streamStudents() {
    return this.iterateCollection<PedagogicalStudent>('/alunos');
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    return (await this.requestWithMetrics<T>(path, init)).body;
  }

  private async requestWithMetrics<T>(path: string, init?: RequestInit) {
    const requestContext = await this.buildRequestContext(init?.headers);
    let response: Response;
    let requestStartedAt = Date.now();
    try {
      response = await this.performFetch(path, init, requestContext.headers);
    } catch (error) {
      throw this.toExternalDependencyError(path, error);
    }

    if (
      requestContext.authMode === 'jwt' &&
      (response.status === 401 || response.status === 403)
    ) {
      this.logger.warn(
        `Pedagogical JWT rejected for ${path} with ${response.status}. Retrying after cache eviction.`,
      );
      await this.redis.getClient().del(AUTH_CACHE_KEY);
      const retryContext = await this.buildRequestContext(init?.headers);
      requestStartedAt = Date.now();
      try {
        response = await this.performFetch(path, init, retryContext.headers);
      } catch (error) {
        throw this.toExternalDependencyError(path, error);
      }
    }

    if (!response.ok) {
      this.logger.error(`Pedagogical request failed for ${path}: ${response.status}`);
      throw new ExternalDependencyException(
        `Falha ao consultar o sistema pedagogico (${response.status}).`,
        {
          path,
          status: response.status,
        },
      );
    }

    return {
      body: (await response.json()) as T,
      fetchDurationMs: Date.now() - requestStartedAt,
    };
  }

  private async performFetch(path: string, init: RequestInit | undefined, headers: Headers) {
    return fetch(`${env.PEDAGOGICAL_API_BASE_URL}${path}`, {
      ...init,
      headers,
      signal: AbortSignal.timeout(env.PEDAGOGICAL_REQUEST_TIMEOUT_MS),
    });
  }

  private async buildRequestContext(headers?: HeadersInit): Promise<PedagogicalRequestContext> {
    const resolvedHeaders = new Headers(headers);
    resolvedHeaders.set('content-type', 'application/json');

    if (env.PEDAGOGICAL_API_KEY) {
      resolvedHeaders.set('x-api-key', env.PEDAGOGICAL_API_KEY);
      return {
        headers: resolvedHeaders,
        authMode: 'api-key',
      };
    }

    const token = await this.getJwtToken();
    resolvedHeaders.set('authorization', `Bearer ${token}`);
    return {
      headers: resolvedHeaders,
      authMode: 'jwt',
    };
  }

  private async getJwtToken() {
    const cache = await this.redis.getClient().get(AUTH_CACHE_KEY);
    if (cache) {
      return cache;
    }

    if (!env.PEDAGOGICAL_USERNAME || !env.PEDAGOGICAL_PASSWORD) {
      throw new InternalServerErrorException(
        'Credenciais do sistema pedagogico nao configuradas.',
      );
    }

    let response: Response;
    try {
      response = await fetch(`${env.PEDAGOGICAL_API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        signal: AbortSignal.timeout(env.PEDAGOGICAL_REQUEST_TIMEOUT_MS),
        body: JSON.stringify({
          username: env.PEDAGOGICAL_USERNAME,
          password: env.PEDAGOGICAL_PASSWORD,
        }),
      });
    } catch (error) {
      throw this.toExternalDependencyError('/auth/login', error);
    }

    if (!response.ok) {
      throw new ExternalDependencyException('Falha ao autenticar com a API pedagogica.', {
        path: '/auth/login',
        status: response.status,
      });
    }

    const body = (await response.json()) as { token: string };
    await this.redis.getClient().set(AUTH_CACHE_KEY, body.token, 'EX', 5 * 60);
    return body.token;
  }

  private async collectCollection<T>(
    pages: AsyncIterable<PedagogicalCollectionPage<T>>,
  ) {
    const items: T[] = [];

    for await (const page of pages) {
      items.push(...page.items);
    }

    return items;
  }

  private async *iterateCollection<T>(path: string): AsyncGenerator<PedagogicalCollectionPage<T>> {
    if (env.PEDAGOGICAL_PAGINATION_MODE === 'off') {
      const response = await this.requestWithMetrics<T[]>(path);
      if (!Array.isArray(response.body)) {
        throw new ExternalDependencyException(
          `A colecao ${path} retornou um formato inesperado sem paginacao habilitada.`,
          {
            path,
          },
        );
      }

      yield {
        items: response.body,
        fetchDurationMs: response.fetchDurationMs,
      };
      return;
    }

    let page = 1;
    while (true) {
      const paginatedPath = this.buildPaginatedCollectionPath(path, page);
      const response = await this.requestWithMetrics<unknown>(paginatedPath);
      const paginatedEnvelope = this.parsePaginatedEnvelope<T>(response.body, page);

      if (!paginatedEnvelope) {
        if (env.PEDAGOGICAL_PAGINATION_MODE === 'force') {
          throw new ExternalDependencyException(
            `A colecao ${path} nao retornou um envelope paginado compativel.`,
            {
              path,
            },
          );
        }

        if (!Array.isArray(response.body)) {
          throw new ExternalDependencyException(
            `A colecao ${path} retornou um payload inesperado.`,
            {
              path,
            },
          );
        }

        yield {
          items: response.body as T[],
          fetchDurationMs: response.fetchDurationMs,
        };
        return;
      }

      yield {
        items: paginatedEnvelope.items,
        fetchDurationMs: response.fetchDurationMs,
      };

      if (paginatedEnvelope.nextPage === null) {
        return;
      }

      page = paginatedEnvelope.nextPage;
    }
  }

  private buildPaginatedCollectionPath(path: string, page: number) {
    const url = new URL(path, 'http://pedagogical.local');
    url.searchParams.set('page', String(page));
    url.searchParams.set('pageSize', String(env.PEDAGOGICAL_PAGE_SIZE));

    const queryString = url.searchParams.toString();
    return `${url.pathname}${queryString ? `?${queryString}` : ''}`;
  }

  private parsePaginatedEnvelope<T>(
    payload: unknown,
    requestedPage: number,
  ): PaginatedCollectionEnvelope<T> | null {
    if (Array.isArray(payload)) {
      return null;
    }

    if (!payload || typeof payload !== 'object') {
      return null;
    }

    const record = payload as Record<string, unknown>;
    const items = this.readCollectionItems<T>(record);
    if (!items) {
      return null;
    }

    const paginationRecord = this.readPaginationRecord(record);
    const page =
      this.asNumber(record.page) ??
      this.asNumber(record.currentPage) ??
      this.asNumber(paginationRecord?.page) ??
      this.asNumber(paginationRecord?.currentPage) ??
      requestedPage;
    const totalPages =
      this.asNumber(record.totalPages) ??
      this.asNumber(paginationRecord?.totalPages) ??
      this.asNumber(paginationRecord?.lastPage);
    const nextPage =
      this.asNumber(record.nextPage) ??
      this.asNumber(paginationRecord?.nextPage) ??
      (this.asBoolean(record.hasMore) === true || this.asBoolean(paginationRecord?.hasMore) === true
        ? page + 1
        : null) ??
      (totalPages && page < totalPages ? page + 1 : null);

    return {
      items,
      nextPage,
    };
  }

  private readCollectionItems<T>(record: Record<string, unknown>) {
    const candidates = [record.items, record.data, record.results, record.records];
    const nestedData =
      record.data && typeof record.data === 'object' && !Array.isArray(record.data)
        ? (record.data as Record<string, unknown>)
        : null;

    if (nestedData) {
      candidates.push(nestedData.items, nestedData.results, nestedData.records);
    }

    for (const candidate of candidates) {
      if (Array.isArray(candidate)) {
        return candidate as T[];
      }
    }

    return null;
  }

  private readPaginationRecord(record: Record<string, unknown>) {
    const pagination = record.pagination;
    if (pagination && typeof pagination === 'object' && !Array.isArray(pagination)) {
      return pagination as Record<string, unknown>;
    }

    const meta = record.meta;
    if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
      return meta as Record<string, unknown>;
    }

    return null;
  }

  private asNumber(value: unknown) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
  }

  private asBoolean(value: unknown) {
    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'string') {
      if (value === 'true') {
        return true;
      }

      if (value === 'false') {
        return false;
      }
    }

    return null;
  }

  private toExternalDependencyError(path: string, error: unknown) {
    const details: Record<string, unknown> = {
      path,
    };

    if (error instanceof Error) {
      details.reason = error.name;
      if (error.message) {
        details.cause = error.message;
      }
    }

    return new ExternalDependencyException(
      `Falha ao consultar o sistema pedagogico (${path}).`,
      details,
    );
  }
}
