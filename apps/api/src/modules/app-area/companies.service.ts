import { Injectable, NotFoundException } from '@nestjs/common';
import { IndicacaoStatus, Prisma } from '@prisma/client';
import type {
  AppCompanyDetail,
  AppCompanyIndicacaoItem,
  AppCompanyListItem,
  AppMatriculaListItem,
} from '@financial-martec/contracts';
import { buildPaginatedResponse } from '@/common/lib/pagination.util';
import { PrismaService } from '@/common/prisma/prisma.service';
import { AuditService } from '@/modules/audit/audit.service';
import { isCompanyIndicacaoOpen } from './app-area.util';
import { QueryAppCompaniesDto } from './dto/query-app-companies.dto';
import { QueryAppMatriculasDto } from './dto/query-app-matriculas.dto';

type CompanyRow = Prisma.PedagogicalCompanySnapshotGetPayload<Record<string, never>>;
type MatriculaRow = Prisma.PedagogicalStudentSnapshotGetPayload<{
  include: {
    companySnapshot: true;
    classSnapshot: true;
    unitSnapshot: true;
  };
}>;
type IndicacaoCompanyRow = Prisma.IndicacaoGetPayload<{
  include: {
    cadastro: true;
  };
}>;

@Injectable()
export class AppCompaniesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async list(query: QueryAppCompaniesDto, actorId: string, requestId?: string | null) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const trimmedSearch = query.search?.trim();
    const where: Prisma.PedagogicalCompanySnapshotWhereInput = {
      batch: {
        status: 'CURRENT',
      },
      ...(trimmedSearch
        ? {
            OR: [
              { name: { contains: trimmedSearch, mode: 'insensitive' } },
              { legalName: { contains: trimmedSearch, mode: 'insensitive' } },
              { taxId: { contains: trimmedSearch, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [companies, total] = await Promise.all([
      this.prisma.pedagogicalCompanySnapshot.findMany({
        where,
        orderBy: {
          name: 'asc',
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.pedagogicalCompanySnapshot.count({ where }),
    ]);

    const sourceIds = companies.map((company) => company.sourceId);
    const [matriculadosCountMap, indicacoesAbertasMap] = await Promise.all([
      this.loadMatriculadosCountMap(sourceIds),
      this.loadIndicacoesAbertasCountMap(sourceIds),
    ]);

    let items = companies.map((company) =>
      this.toCompanyListItem(company, matriculadosCountMap, indicacoesAbertasMap),
    );

    if (query.hasOpenIndicacoes) {
      items = items.filter((item) => item.totalIndicacoesAbertas > 0);
    }

    await this.auditService.record({
      actorId,
      actorType: 'user',
      action: 'app.company.list',
      resourceType: 'pedagogical_company_snapshot',
      requestId,
      metadata: {
        page,
        pageSize,
        search: trimmedSearch ?? null,
        hasOpenIndicacoes: query.hasOpenIndicacoes ?? false,
      },
    });

    return buildPaginatedResponse(items, page, pageSize, total);
  }

  async findOne(sourceId: string, actorId: string, requestId?: string | null) {
    const company = await this.prisma.pedagogicalCompanySnapshot.findFirst({
      where: {
        sourceId,
        batch: {
          status: 'CURRENT',
        },
      },
    });

    if (!company) {
      throw new NotFoundException('Empresa nao encontrada.');
    }

    const [matriculadosCountMap, indicacoesAbertasMap, indicacoesPorStatus] = await Promise.all([
      this.loadMatriculadosCountMap([sourceId]),
      this.loadIndicacoesAbertasCountMap([sourceId]),
      this.loadIndicacoesPorStatusMap(sourceId),
    ]);

    await this.auditService.record({
      actorId,
      actorType: 'user',
      action: 'app.company.detail',
      resourceType: 'pedagogical_company_snapshot',
      resourceId: sourceId,
      requestId,
    });

    return this.toCompanyDetail(company, matriculadosCountMap, indicacoesAbertasMap, indicacoesPorStatus);
  }

  async listMatriculados(
    sourceId: string,
    query: QueryAppMatriculasDto,
    actorId: string,
    requestId?: string | null,
  ) {
    await this.ensureCompanyExists(sourceId);

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const trimmedSearch = query.search?.trim();
    const where: Prisma.PedagogicalStudentSnapshotWhereInput = {
      batch: {
        status: 'CURRENT',
      },
      companySourceId: sourceId,
      ...(query.turmaSourceId
        ? {
            classSourceId: query.turmaSourceId,
          }
        : {}),
      ...(trimmedSearch
        ? {
            OR: [
              { name: { contains: trimmedSearch, mode: 'insensitive' } },
              { cpf: { contains: trimmedSearch, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [students, total] = await Promise.all([
      this.prisma.pedagogicalStudentSnapshot.findMany({
        where,
        orderBy: {
          name: 'asc',
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          companySnapshot: true,
          classSnapshot: true,
          unitSnapshot: true,
        },
      }),
      this.prisma.pedagogicalStudentSnapshot.count({ where }),
    ]);

    await this.auditService.record({
      actorId,
      actorType: 'user',
      action: 'app.company.matriculados.list',
      resourceType: 'pedagogical_company_snapshot',
      resourceId: sourceId,
      requestId,
      metadata: {
        page,
        pageSize,
        search: trimmedSearch ?? null,
        turmaSourceId: query.turmaSourceId ?? null,
      },
    });

    return buildPaginatedResponse(
      students.map((student) => this.toMatriculaListItem(student)),
      page,
      pageSize,
      total,
    );
  }

  async listIndicacoes(sourceId: string, actorId: string, requestId?: string | null) {
    await this.ensureCompanyExists(sourceId);

    const indicacoes = await this.prisma.indicacao.findMany({
      where: {
        empresaSourceId: sourceId,
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      include: {
        cadastro: true,
      },
    });

    await this.auditService.record({
      actorId,
      actorType: 'user',
      action: 'app.company.indicacoes.list',
      resourceType: 'pedagogical_company_snapshot',
      resourceId: sourceId,
      requestId,
    });

    return indicacoes.map((indicacao) => this.toCompanyIndicacaoItem(indicacao));
  }

  private async ensureCompanyExists(sourceId: string) {
    const company = await this.prisma.pedagogicalCompanySnapshot.findFirst({
      where: {
        sourceId,
        batch: {
          status: 'CURRENT',
        },
      },
      select: {
        sourceId: true,
      },
    });

    if (!company) {
      throw new NotFoundException('Empresa nao encontrada.');
    }
  }

  private async loadMatriculadosCountMap(sourceIds: string[]) {
    if (!sourceIds.length) {
      return new Map<string, number>();
    }

    const rows = await this.prisma.pedagogicalStudentSnapshot.groupBy({
      by: ['companySourceId'],
      where: {
        batch: {
          status: 'CURRENT',
        },
        companySourceId: {
          in: sourceIds,
        },
      },
      _count: {
        _all: true,
      },
    });

    return new Map(rows.map((row) => [row.companySourceId, row._count._all]));
  }

  private async loadIndicacoesAbertasCountMap(sourceIds: string[]) {
    if (!sourceIds.length) {
      return new Map<string, number>();
    }

    const rows = await this.prisma.indicacao.groupBy({
      by: ['empresaSourceId', 'status'],
      where: {
        empresaSourceId: {
          in: sourceIds,
        },
      },
      _count: {
        _all: true,
      },
    });

    const countMap = new Map<string, number>();
    for (const row of rows) {
      if (!isCompanyIndicacaoOpen(row.status)) {
        continue;
      }

      countMap.set(
        row.empresaSourceId,
        (countMap.get(row.empresaSourceId) ?? 0) + row._count._all,
      );
    }

    return countMap;
  }

  private async loadIndicacoesPorStatusMap(sourceId: string) {
    const rows = await this.prisma.indicacao.groupBy({
      by: ['status'],
      where: {
        empresaSourceId: sourceId,
      },
      _count: {
        _all: true,
      },
    });

    return rows.reduce<Partial<Record<IndicacaoStatus, number>>>((accumulator, row) => {
      accumulator[row.status] = row._count._all;
      return accumulator;
    }, {});
  }

  private toCompanyListItem(
    company: CompanyRow,
    matriculadosCountMap: Map<string, number>,
    indicacoesAbertasMap: Map<string, number>,
  ): AppCompanyListItem {
    return {
      id: company.sourceId,
      sourceId: company.sourceId,
      name: company.name,
      legalName: company.legalName,
      taxId: company.taxId,
      email: company.email,
      phone: company.phone,
      totalMatriculados: matriculadosCountMap.get(company.sourceId) ?? 0,
      totalIndicacoesAbertas: indicacoesAbertasMap.get(company.sourceId) ?? 0,
      sourceUpdatedAt: company.sourceUpdatedAt?.toISOString() ?? null,
      lastSyncedAt: company.lastSyncedAt.toISOString(),
    };
  }

  private toCompanyDetail(
    company: CompanyRow,
    matriculadosCountMap: Map<string, number>,
    indicacoesAbertasMap: Map<string, number>,
    indicacoesPorStatus: Partial<Record<IndicacaoStatus, number>>,
  ): AppCompanyDetail {
    const rawData = this.toRecord(company.data);

    return {
      ...this.toCompanyListItem(company, matriculadosCountMap, indicacoesAbertasMap),
      address: this.readString(rawData, 'endereco'),
      city: this.readString(rawData, 'cidade'),
      neighborhood: this.readString(rawData, 'bairro'),
      state: this.readString(rawData, 'estado'),
      postalCode: this.readString(rawData, 'cep'),
      representativeName: this.readString(rawData, 'representante_nome'),
      representativeRole: this.readString(rawData, 'representante_cargo'),
      username: this.readString(rawData, 'username'),
      createdAt: company.createdAt.toISOString(),
      updatedAt: company.updatedAt.toISOString(),
      indicacoesPorStatus,
    };
  }

  private toCompanyIndicacaoItem(indicacao: IndicacaoCompanyRow): AppCompanyIndicacaoItem {
    return {
      indicacaoId: indicacao.id,
      cadastroId: indicacao.cadastroId,
      cadastroNomeCompleto: indicacao.cadastro.nomeCompleto,
      cadastroCpf: indicacao.cadastro.cpf,
      empresaSourceId: indicacao.empresaSourceId,
      statusIndicacao: indicacao.status,
      statusCadastro: indicacao.cadastro.status,
      sentAt: indicacao.sentAt.toISOString(),
      acceptedAt: indicacao.acceptedAt?.toISOString() ?? null,
      rejectedAt: indicacao.rejectedAt?.toISOString() ?? null,
      contractGeneratedAt: indicacao.contractGeneratedAt?.toISOString() ?? null,
      updatedAt: indicacao.updatedAt.toISOString(),
      closedAt: indicacao.closedAt?.toISOString() ?? null,
      closedReason: indicacao.closedReason ?? null,
    };
  }

  private toMatriculaListItem(student: MatriculaRow): AppMatriculaListItem {
    return {
      id: student.sourceId,
      sourceId: student.sourceId,
      nome: student.name,
      cpf: student.cpf,
      empresa: student.companySnapshot
        ? {
            sourceId: student.companySnapshot.sourceId,
            name: student.companySnapshot.name,
          }
        : null,
      turma: student.classSnapshot
        ? {
            sourceId: student.classSnapshot.sourceId,
            name: student.classSnapshot.name,
            description: student.classSnapshot.description,
          }
        : null,
      unidade: student.unitSnapshot
        ? {
            sourceId: student.unitSnapshot.sourceId,
            name: student.unitSnapshot.name,
          }
        : null,
      situacao: 'MATRICULADO',
      lastSyncedAt: student.lastSyncedAt.toISOString(),
    };
  }

  private toRecord(value: Prisma.JsonValue | null | undefined) {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }

  private readString(record: Record<string, unknown> | null, key: string) {
    const value = record?.[key];
    return typeof value === 'string' ? value : null;
  }
}
