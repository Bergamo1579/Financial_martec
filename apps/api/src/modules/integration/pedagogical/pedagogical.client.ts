import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import type {
  PedagogicalClass,
  PedagogicalCompany,
  PedagogicalStudent,
  PedagogicalUnit,
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

type RawRecord = Record<string, unknown>;

@Injectable()
export class PedagogicalClientService {
  private readonly logger = new Logger(PedagogicalClientService.name);

  constructor(private readonly redis: RedisService) {}

  async listCompanies(): Promise<PedagogicalCompany[]> {
    return this.collectCollection(this.streamCompanies());
  }

  async getCompany(id: string): Promise<PedagogicalCompany> {
    return this.normalizeCompany(await this.request<unknown>(`/empresas/${id}`));
  }

  async listStudents(): Promise<PedagogicalStudent[]> {
    return this.collectCollection(this.streamStudents());
  }

  async getStudent(id: string): Promise<PedagogicalStudent> {
    return this.normalizeStudent(await this.request<unknown>(`/alunos/${id}`));
  }

  async listClasses(): Promise<PedagogicalClass[]> {
    return this.collectCollection(this.streamClasses());
  }

  async getClass(id: string): Promise<PedagogicalClass> {
    return this.normalizeClass(await this.request<unknown>(`/turmas/${id}`));
  }

  async listUnits(): Promise<PedagogicalUnit[]> {
    return this.collectCollection(this.streamUnits());
  }

  async getUnit(id: string): Promise<PedagogicalUnit> {
    return this.normalizeUnit(await this.request<unknown>(`/unidades/${id}`));
  }

  async *streamCompanies(): AsyncGenerator<PedagogicalCollectionPage<PedagogicalCompany>> {
    for await (const page of this.iterateCollection<unknown>('/empresas')) {
      yield {
        items: page.items.map((item) => this.normalizeCompany(item)),
        fetchDurationMs: page.fetchDurationMs,
      };
    }
  }

  async *streamStudents(): AsyncGenerator<PedagogicalCollectionPage<PedagogicalStudent>> {
    for await (const page of this.iterateCollection<unknown>('/alunos')) {
      yield {
        items: page.items.map((item) => this.normalizeStudent(item)),
        fetchDurationMs: page.fetchDurationMs,
      };
    }
  }

  async *streamClasses(): AsyncGenerator<PedagogicalCollectionPage<PedagogicalClass>> {
    for await (const page of this.iterateCollection<unknown>('/turmas')) {
      yield {
        items: page.items.map((item) => this.normalizeClass(item)),
        fetchDurationMs: page.fetchDurationMs,
      };
    }
  }

  async *streamUnits(): AsyncGenerator<PedagogicalCollectionPage<PedagogicalUnit>> {
    for await (const page of this.iterateCollection<unknown>('/unidades')) {
      yield {
        items: page.items.map((item) => this.normalizeUnit(item)),
        fetchDurationMs: page.fetchDurationMs,
      };
    }
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

  private normalizeCompany(payload: unknown): PedagogicalCompany {
    const record = this.assertRecord(payload, 'empresa');

    return {
      id: this.readRequiredString(record, ['id', 'empresa_id'], 'empresa.id'),
      nome: this.readRequiredString(record, ['nome', 'empresa_nome'], 'empresa.nome'),
      criado_em: this.readOptionalString(record, ['criado_em', 'empresa_criado_em']) ?? undefined,
      razao_social:
        this.readOptionalString(record, ['razao_social', 'empresa_razao_social']) ?? undefined,
      cnpj: this.readOptionalString(record, ['cnpj', 'empresa_cnpj']) ?? undefined,
      inscricao_estadual: this.readOptionalString(record, [
        'inscricao_estadual',
        'empresa_inscricao_estadual',
      ]),
      endereco: this.readOptionalString(record, ['endereco', 'empresa_endereco']),
      numero: this.readOptionalString(record, ['numero', 'empresa_numero']),
      cidade: this.readOptionalString(record, ['cidade', 'empresa_cidade']),
      bairro: this.readOptionalString(record, ['bairro', 'empresa_bairro']),
      estado: this.readOptionalString(record, ['estado', 'empresa_estado']),
      cep: this.readOptionalString(record, ['cep', 'empresa_cep']),
      telefone: this.readOptionalString(record, ['telefone', 'empresa_telefone']),
      email: this.readOptionalString(record, ['email', 'empresa_email']),
      representante_nome: this.readOptionalString(record, [
        'representante_nome',
        'empresa_representante_nome',
      ]),
      representante_cargo: this.readOptionalString(record, [
        'representante_cargo',
        'empresa_representante_cargo',
      ]),
      username: this.readOptionalString(record, ['username', 'user_username']),
    };
  }

  private normalizeStudent(payload: unknown): PedagogicalStudent {
    const record = this.assertRecord(payload, 'aluno');

    return {
      id: this.readRequiredString(record, ['id', 'aluno_id'], 'aluno.id'),
      nome: this.readRequiredString(record, ['nome', 'aluno_nome'], 'aluno.nome'),
      cpf: this.readRequiredString(record, ['cpf', 'aluno_cpf'], 'aluno.cpf'),
      data_nascimento: this.readRequiredString(
        record,
        ['data_nascimento', 'aluno_data_nascimento'],
        'aluno.data_nascimento',
      ),
      unidade_id: this.readOptionalString(record, ['unidade_id', 'aluno_unidade_id']),
      turma_id: this.readOptionalString(record, ['turma_id', 'aluno_turma_id']),
      empresa_id: this.readRequiredString(
        record,
        ['empresa_id', 'aluno_empresa_id'],
        'aluno.empresa_id',
      ),
      criado_em: this.readOptionalString(record, ['criado_em', 'aluno_criado_em']) ?? undefined,
      atualizado_em:
        this.readOptionalString(record, ['atualizado_em', 'aluno_atualizado_em']) ?? undefined,
      responsavel_nome: this.readOptionalString(record, [
        'responsavel_nome',
        'aluno_responsavel_nome',
      ]),
      sexo: this.readOptionalString(record, ['sexo', 'aluno_sexo']) as 'M' | 'F' | null,
      rg: this.readOptionalString(record, ['rg', 'aluno_rg']),
      endereco: this.readOptionalString(record, ['endereco', 'aluno_endereco']),
      numero: this.readOptionalString(record, ['numero', 'aluno_numero']),
      complemento: this.readOptionalString(record, ['complemento', 'aluno_complemento']),
      bairro: this.readOptionalString(record, ['bairro', 'aluno_bairro']),
      cidade: this.readOptionalString(record, ['cidade', 'aluno_cidade']),
      cep: this.readOptionalString(record, ['cep', 'aluno_cep']),
      celular: this.readOptionalString(record, ['celular', 'aluno_celular']),
      celular_recado: this.readOptionalString(record, [
        'celular_recado',
        'aluno_celular_recado',
      ]),
      email: this.readOptionalString(record, ['email', 'aluno_email']),
      escola: this.readOptionalString(record, ['escola', 'aluno_escola']),
      serie: this.readOptionalString(record, ['serie', 'aluno_serie']),
      periodo: this.readOptionalString(record, ['periodo', 'aluno_periodo']) as
        | 'manha'
        | 'tarde'
        | 'noite'
        | null,
    };
  }

  private normalizeClass(payload: unknown): PedagogicalClass {
    const record = this.assertRecord(payload, 'turma');

    return {
      id: this.readRequiredString(record, ['id'], 'turma.id'),
      nome: this.readRequiredString(record, ['nome'], 'turma.nome'),
      descricao: this.readOptionalString(record, ['descricao']),
      criado_em: this.readOptionalString(record, ['criado_em']) ?? undefined,
      id_unidade: this.readOptionalString(record, ['id_unidade']),
    };
  }

  private normalizeUnit(payload: unknown): PedagogicalUnit {
    const record = this.assertRecord(payload, 'unidade');

    return {
      id: this.readRequiredString(record, ['id'], 'unidade.id'),
      nome: this.readRequiredString(record, ['nome'], 'unidade.nome'),
      localizacao: this.readOptionalString(record, ['localizacao']),
    };
  }

  private assertRecord(payload: unknown, entityName: string): RawRecord {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new ExternalDependencyException(
        `Payload invalido recebido do sistema pedagogico para ${entityName}.`,
        {
          entityName,
        },
      );
    }

    return payload as RawRecord;
  }

  private readRequiredString(record: RawRecord, keys: string[], fieldName: string) {
    const value = this.readOptionalString(record, keys);
    if (!value) {
      throw new ExternalDependencyException(
        `Campo obrigatorio ausente no payload do sistema pedagogico: ${fieldName}.`,
        {
          fieldName,
        },
      );
    }

    return value;
  }

  private readOptionalString(record: RawRecord, keys: string[]) {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed ? trimmed : null;
      }
    }

    return null;
  }
}
