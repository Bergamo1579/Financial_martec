import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { IndicacaoStatus, Prisma } from '@prisma/client';
import type {
  CadastroDetail,
  CadastroListItem,
  IndicacaoItem,
} from '@financial-martec/contracts';
import { buildPaginatedResponse } from '@/common/lib/pagination.util';
import { PrismaService } from '@/common/prisma/prisma.service';
import { AuditService } from '@/modules/audit/audit.service';
import {
  canArchiveCadastro,
  canDeleteCadastro,
  deriveCadastroStatus,
  hasCadastroOperationalHistory,
  normalizeCpf,
} from './app-area.util';
import { CreateCadastroDto } from './dto/create-cadastro.dto';
import { CreateIndicacaoDto } from './dto/create-indicacao.dto';
import { QueryCadastrosDto } from './dto/query-cadastros.dto';
import { UpdateCadastroDto } from './dto/update-cadastro.dto';

type CadastroListRow = Prisma.CadastroGetPayload<{
  include: {
    _count: {
      select: {
        indicacoes: true;
      };
    };
  };
}>;

type CadastroDetailRow = Prisma.CadastroGetPayload<{
  include: {
    indicacoes: {
      orderBy: {
        createdAt: 'desc';
      };
    };
  };
}>;

type IndicacaoRow = Prisma.IndicacaoGetPayload<Record<string, never>>;
type PrismaTransaction = Prisma.TransactionClient;

const duplicateBlockingStatuses: IndicacaoStatus[] = ['ENVIADA', 'ACEITA', 'CONTRATO_GERADO'];

@Injectable()
export class AppCadastrosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async list(query: QueryCadastrosDto, actorId: string, requestId?: string | null) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const trimmedSearch = query.search?.trim();
    const where: Prisma.CadastroWhereInput = {
      ...(query.includeDeleted ? {} : { deletedAt: null }),
      ...(query.status ? { status: query.status } : {}),
      ...(query.periodoEstudo ? { periodoEstudo: query.periodoEstudo } : {}),
      ...(trimmedSearch
        ? {
            OR: [
              { nomeCompleto: { contains: trimmedSearch, mode: 'insensitive' } },
              { cpf: { contains: trimmedSearch, mode: 'insensitive' } },
              { telefone: { contains: trimmedSearch, mode: 'insensitive' } },
              { nomeResponsavel: { contains: trimmedSearch, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [cadastros, total] = await Promise.all([
      this.prisma.cadastro.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          _count: {
            select: {
              indicacoes: true,
            },
          },
        },
      }),
      this.prisma.cadastro.count({ where }),
    ]);

    await this.auditService.record({
      actorId,
      actorType: 'user',
      action: 'app.cadastro.list',
      resourceType: 'cadastro',
      requestId,
      metadata: {
        page,
        pageSize,
        search: trimmedSearch ?? null,
        status: query.status ?? null,
        periodoEstudo: query.periodoEstudo ?? null,
        includeDeleted: query.includeDeleted ?? false,
      },
    });

    return buildPaginatedResponse(
      cadastros.map((cadastro) => this.toCadastroListItem(cadastro)),
      page,
      pageSize,
      total,
    );
  }

  async findOne(id: string, actorId: string, requestId?: string | null) {
    const cadastro = await this.prisma.cadastro.findUnique({
      where: { id },
      include: {
        indicacoes: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!cadastro) {
      throw new NotFoundException('Cadastro nao encontrado.');
    }

    const companyNameMap = await this.loadCompanyNameMap(
      this.prisma,
      new Set(cadastro.indicacoes.map((indicacao) => indicacao.empresaSourceId)),
    );

    await this.auditService.record({
      actorId,
      actorType: 'user',
      action: 'app.cadastro.detail',
      resourceType: 'cadastro',
      resourceId: id,
      requestId,
    });

    return this.toCadastroDetail(cadastro, companyNameMap);
  }

  async listIndicacoes(cadastroId: string, actorId: string, requestId?: string | null) {
    const cadastro = await this.prisma.cadastro.findUnique({
      where: { id: cadastroId },
      include: {
        indicacoes: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!cadastro) {
      throw new NotFoundException('Cadastro nao encontrado.');
    }

    const companyNameMap = await this.loadCompanyNameMap(
      this.prisma,
      new Set(cadastro.indicacoes.map((indicacao) => indicacao.empresaSourceId)),
    );

    await this.auditService.record({
      actorId,
      actorType: 'user',
      action: 'app.cadastro.indicacoes.list',
      resourceType: 'cadastro',
      resourceId: cadastroId,
      requestId,
    });

    return cadastro.indicacoes.map((indicacao) => this.toIndicacaoItem(indicacao, companyNameMap));
  }

  async create(
    dto: CreateCadastroDto,
    actorId: string,
    requestId?: string | null,
    ipAddress?: string | null,
  ) {
    const cpfNormalized = this.assertCpf(dto.cpf);
    await this.assertCpfAvailable(this.prisma, cpfNormalized);

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const cadastro = await tx.cadastro.create({
          data: {
            nomeCompleto: dto.nomeCompleto.trim(),
            telefone: dto.telefone.trim(),
            cpf: dto.cpf.trim(),
            cpfNormalized,
            nomeResponsavel: dto.nomeResponsavel.trim(),
            periodoEstudo: dto.periodoEstudo,
            status: 'ARQUIVADO',
          },
          include: {
            indicacoes: {
              orderBy: {
                createdAt: 'desc',
              },
            },
          },
        });

        await this.auditService.record(
          {
            actorId,
            actorType: 'user',
            action: 'app.cadastro.created',
            resourceType: 'cadastro',
            resourceId: cadastro.id,
            requestId,
            ipAddress,
            metadata: {
              periodoEstudo: cadastro.periodoEstudo,
              status: cadastro.status,
            },
          },
          tx,
        );

        return cadastro;
      });

      return this.toCadastroDetail(created, new Map());
    } catch (error) {
      this.rethrowKnownConflicts(error);
      throw error;
    }
  }

  async update(
    id: string,
    dto: UpdateCadastroDto,
    actorId: string,
    requestId?: string | null,
    ipAddress?: string | null,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.cadastro.findUnique({
          where: { id },
          include: {
            indicacoes: {
              orderBy: {
                createdAt: 'desc',
              },
            },
          },
        });

        if (!existing) {
          throw new NotFoundException('Cadastro nao encontrado.');
        }

        if (existing.deletedAt) {
          throw new ConflictException('Nao e possivel editar um cadastro excluido.');
        }

        const updateData: Prisma.CadastroUpdateInput = {};

        if (dto.nomeCompleto !== undefined) {
          updateData.nomeCompleto = dto.nomeCompleto.trim();
        }

        if (dto.telefone !== undefined) {
          updateData.telefone = dto.telefone.trim();
        }

        if (dto.cpf !== undefined) {
          const cpfNormalized = this.assertCpf(dto.cpf);
          await this.assertCpfAvailable(tx, cpfNormalized, id);
          updateData.cpf = dto.cpf.trim();
          updateData.cpfNormalized = cpfNormalized;
        }

        if (dto.nomeResponsavel !== undefined) {
          updateData.nomeResponsavel = dto.nomeResponsavel.trim();
        }

        if (dto.periodoEstudo !== undefined) {
          updateData.periodoEstudo = dto.periodoEstudo;
        }

        let cadastro = existing;

        if (Object.keys(updateData).length) {
          cadastro = await tx.cadastro.update({
            where: { id },
            data: updateData,
            include: {
              indicacoes: {
                orderBy: {
                  createdAt: 'desc',
                },
              },
            },
          });
        }

        if (dto.archive) {
          this.assertCanArchive(cadastro);
          cadastro = await this.archiveCadastro(tx, cadastro.id);
        } else if (Object.keys(updateData).length) {
          cadastro = await this.recalculateCadastroStatus(tx, cadastro.id);
        }

        const companyNameMap = await this.loadCompanyNameMap(
          tx,
          new Set(cadastro.indicacoes.map((indicacao) => indicacao.empresaSourceId)),
        );

        await this.auditService.record(
          {
            actorId,
            actorType: 'user',
            action: dto.archive ? 'app.cadastro.archived' : 'app.cadastro.updated',
            resourceType: 'cadastro',
            resourceId: cadastro.id,
            requestId,
            ipAddress,
            metadata: {
              archive: dto.archive ?? false,
              status: cadastro.status,
            },
          },
          tx,
        );

        return this.toCadastroDetail(cadastro, companyNameMap);
      });
    } catch (error) {
      this.rethrowKnownConflicts(error);
      throw error;
    }
  }

  async remove(
    id: string,
    actorId: string,
    requestId?: string | null,
    ipAddress?: string | null,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.cadastro.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              indicacoes: true,
            },
          },
          indicacoes: {
            orderBy: {
              createdAt: 'desc',
            },
          },
        },
      });

      if (!existing) {
        throw new NotFoundException('Cadastro nao encontrado.');
      }

      if (existing.deletedAt) {
        throw new ConflictException('Cadastro ja foi excluido.');
      }

      if (
        !canDeleteCadastro(
          existing._count.indicacoes,
          existing.pedagogicalStudentSourceId,
          existing.deletedAt,
        )
      ) {
        throw new ConflictException(
          'Cadastro possui historico operacional e nao pode ser excluido. Use Arquivar.',
        );
      }

      const deleted = await tx.cadastro.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          status: 'ARQUIVADO',
        },
        include: {
          indicacoes: {
            orderBy: {
              createdAt: 'desc',
            },
          },
        },
      });

      await this.auditService.record(
        {
          actorId,
          actorType: 'user',
          action: 'app.cadastro.deleted',
          resourceType: 'cadastro',
          resourceId: id,
          requestId,
          ipAddress,
        },
        tx,
      );

      return this.toCadastroDetail(deleted, new Map());
    });
  }

  async createIndicacao(
    cadastroId: string,
    dto: CreateIndicacaoDto,
    actorId: string,
    requestId?: string | null,
    ipAddress?: string | null,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const cadastro = await tx.cadastro.findUnique({
          where: { id: cadastroId },
        });

        if (!cadastro) {
          throw new NotFoundException('Cadastro nao encontrado.');
        }

        if (cadastro.deletedAt) {
          throw new ConflictException('Nao e possivel indicar um cadastro excluido.');
        }

        if (cadastro.pedagogicalStudentSourceId) {
          throw new ConflictException('Cadastro ja esta matriculado e nao aceita novas indicacoes.');
        }

        const hasContract = await tx.indicacao.findFirst({
          where: {
            cadastroId,
            status: 'CONTRATO_GERADO',
          },
          select: {
            id: true,
          },
        });

        if (hasContract) {
          throw new ConflictException(
            'Cadastro ja possui contrato gerado e nao aceita novas indicacoes.',
          );
        }

        const company = await tx.pedagogicalCompanySnapshot.findFirst({
          where: {
            sourceId: dto.empresaSourceId,
            batch: {
              status: 'CURRENT',
            },
          },
          select: {
            sourceId: true,
            name: true,
          },
        });

        if (!company) {
          throw new NotFoundException('Empresa nao encontrada no snapshot atual do pedagogico.');
        }

        const duplicateIndicacao = await tx.indicacao.findFirst({
          where: {
            cadastroId,
            empresaSourceId: dto.empresaSourceId,
            status: {
              in: duplicateBlockingStatuses,
            },
          },
          select: {
            id: true,
          },
        });

        if (duplicateIndicacao) {
          throw new ConflictException(
            'Ja existe uma indicacao aberta para este cadastro na empresa informada.',
          );
        }

        const indicacao = await tx.indicacao.create({
          data: {
            cadastroId,
            empresaSourceId: dto.empresaSourceId,
            status: 'ENVIADA',
          },
        });

        const updatedCadastro = await this.recalculateCadastroStatus(tx, cadastroId);

        await this.auditService.record(
          {
            actorId,
            actorType: 'user',
            action: 'app.indicacao.created',
            resourceType: 'indicacao',
            resourceId: indicacao.id,
            requestId,
            ipAddress,
            metadata: {
              cadastroId,
              empresaSourceId: dto.empresaSourceId,
              cadastroStatus: updatedCadastro.status,
            },
          },
          tx,
        );

        return this.toIndicacaoItem(indicacao, new Map([[company.sourceId, company.name]]));
      });
    } catch (error) {
      this.rethrowKnownConflicts(error);
      throw error;
    }
  }

  async acceptIndicacao(
    indicacaoId: string,
    actorId: string,
    requestId?: string | null,
    ipAddress?: string | null,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const indicacao = await tx.indicacao.findUnique({
        where: { id: indicacaoId },
        include: {
          cadastro: true,
        },
      });

      if (!indicacao) {
        throw new NotFoundException('Indicacao nao encontrada.');
      }

      this.assertIndicacaoMutationAllowed(indicacao.cadastro);

      if (indicacao.status !== 'ENVIADA') {
        throw new ConflictException('Somente indicacoes enviadas podem ser marcadas como aceitas.');
      }

      const acceptedAt = new Date();
      const updatedIndicacao = await tx.indicacao.update({
        where: { id: indicacaoId },
        data: {
          status: 'ACEITA',
          acceptedAt,
          closedAt: null,
          closedReason: null,
        },
      });

      const updatedCadastro = await this.recalculateCadastroStatus(tx, indicacao.cadastroId);
      const companyNameMap = await this.loadCompanyNameMap(tx, new Set([indicacao.empresaSourceId]));

      await this.auditService.record(
        {
          actorId,
          actorType: 'user',
          action: 'app.indicacao.accepted',
          resourceType: 'indicacao',
          resourceId: indicacaoId,
          requestId,
          ipAddress,
          metadata: {
            cadastroId: indicacao.cadastroId,
            empresaSourceId: indicacao.empresaSourceId,
            cadastroStatus: updatedCadastro.status,
          },
        },
        tx,
      );

      return this.toIndicacaoItem(updatedIndicacao, companyNameMap);
    });
  }

  async rejectIndicacao(
    indicacaoId: string,
    actorId: string,
    requestId?: string | null,
    ipAddress?: string | null,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const indicacao = await tx.indicacao.findUnique({
        where: { id: indicacaoId },
        include: {
          cadastro: true,
        },
      });

      if (!indicacao) {
        throw new NotFoundException('Indicacao nao encontrada.');
      }

      this.assertIndicacaoMutationAllowed(indicacao.cadastro);

      if (!['ENVIADA', 'ACEITA'].includes(indicacao.status)) {
        throw new ConflictException('Somente indicacoes enviadas ou aceitas podem ser recusadas.');
      }

      const closedAt = new Date();
      const updatedIndicacao = await tx.indicacao.update({
        where: { id: indicacaoId },
        data: {
          status: 'RECUSADA',
          rejectedAt: closedAt,
          closedAt,
          closedReason: 'Recusada manualmente.',
        },
      });

      const updatedCadastro = await this.recalculateCadastroStatus(tx, indicacao.cadastroId);
      const companyNameMap = await this.loadCompanyNameMap(tx, new Set([indicacao.empresaSourceId]));

      await this.auditService.record(
        {
          actorId,
          actorType: 'user',
          action: 'app.indicacao.rejected',
          resourceType: 'indicacao',
          resourceId: indicacaoId,
          requestId,
          ipAddress,
          metadata: {
            cadastroId: indicacao.cadastroId,
            empresaSourceId: indicacao.empresaSourceId,
            cadastroStatus: updatedCadastro.status,
          },
        },
        tx,
      );

      return this.toIndicacaoItem(updatedIndicacao, companyNameMap);
    });
  }

  async contractIndicacao(
    indicacaoId: string,
    actorId: string,
    requestId?: string | null,
    ipAddress?: string | null,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const indicacao = await tx.indicacao.findUnique({
        where: { id: indicacaoId },
        include: {
          cadastro: true,
        },
      });

      if (!indicacao) {
        throw new NotFoundException('Indicacao nao encontrada.');
      }

      this.assertIndicacaoMutationAllowed(indicacao.cadastro);

      if (indicacao.status !== 'ACEITA') {
        throw new ConflictException(
          'Somente indicacoes aceitas podem ser marcadas como contrato gerado.',
        );
      }

      const contractGeneratedAt = new Date();
      const updatedIndicacao = await tx.indicacao.update({
        where: { id: indicacaoId },
        data: {
          status: 'CONTRATO_GERADO',
          contractGeneratedAt,
          closedAt: null,
          closedReason: null,
        },
      });

      await tx.indicacao.updateMany({
        where: {
          cadastroId: indicacao.cadastroId,
          id: {
            not: indicacaoId,
          },
          status: {
            in: ['ENVIADA', 'ACEITA'],
          },
        },
        data: {
          status: 'ENCERRADA_POR_OUTRA_EMPRESA',
          closedAt: contractGeneratedAt,
          closedReason: 'Encerrada automaticamente por contrato gerado em outra empresa.',
        },
      });

      const updatedCadastro = await this.recalculateCadastroStatus(tx, indicacao.cadastroId);
      const companyNameMap = await this.loadCompanyNameMap(tx, new Set([indicacao.empresaSourceId]));

      await this.auditService.record(
        {
          actorId,
          actorType: 'user',
          action: 'app.indicacao.contract-generated',
          resourceType: 'indicacao',
          resourceId: indicacaoId,
          requestId,
          ipAddress,
          metadata: {
            cadastroId: indicacao.cadastroId,
            empresaSourceId: indicacao.empresaSourceId,
            cadastroStatus: updatedCadastro.status,
          },
        },
        tx,
      );

      return this.toIndicacaoItem(updatedIndicacao, companyNameMap);
    });
  }

  private assertCpf(value: string) {
    const normalized = normalizeCpf(value);
    if (!normalized) {
      throw new BadRequestException('CPF invalido.');
    }

    return normalized;
  }

  private async assertCpfAvailable(
    prisma: PrismaService | PrismaTransaction,
    cpfNormalized: string,
    cadastroIdToIgnore?: string,
  ) {
    const existing = await prisma.cadastro.findFirst({
      where: {
        cpfNormalized,
        deletedAt: null,
        ...(cadastroIdToIgnore ? { id: { not: cadastroIdToIgnore } } : {}),
      },
      select: {
        id: true,
      },
    });

    if (existing) {
      throw new ConflictException('Ja existe um cadastro ativo com este CPF.');
    }
  }

  private assertCanArchive(cadastro: Pick<CadastroDetailRow, 'deletedAt' | 'pedagogicalStudentSourceId'>) {
    if (!canArchiveCadastro(cadastro.pedagogicalStudentSourceId, cadastro.deletedAt)) {
      throw new ConflictException('Nao e possivel arquivar este cadastro.');
    }
  }

  private assertIndicacaoMutationAllowed(
    cadastro: Pick<CadastroDetailRow, 'deletedAt' | 'pedagogicalStudentSourceId'>,
  ) {
    if (cadastro.deletedAt) {
      throw new ConflictException('Nao e possivel operar indicacoes de um cadastro excluido.');
    }

    if (cadastro.pedagogicalStudentSourceId) {
      throw new ConflictException('Cadastro ja esta matriculado e nao aceita alteracoes operacionais.');
    }
  }

  private async archiveCadastro(tx: PrismaTransaction, cadastroId: string) {
    const archivedAt = new Date();
    await tx.indicacao.updateMany({
      where: {
        cadastroId,
        status: {
          in: duplicateBlockingStatuses,
        },
      },
      data: {
        status: 'RECUSADA',
        rejectedAt: archivedAt,
        closedAt: archivedAt,
        closedReason: 'Arquivado manualmente.',
      },
    });

    return this.recalculateCadastroStatus(tx, cadastroId);
  }

  private async recalculateCadastroStatus(tx: PrismaTransaction, cadastroId: string) {
    const cadastro = await tx.cadastro.findUnique({
      where: { id: cadastroId },
      include: {
        indicacoes: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!cadastro) {
      throw new NotFoundException('Cadastro nao encontrado.');
    }

    const nextStatus = deriveCadastroStatus(
      cadastro.pedagogicalStudentSourceId,
      cadastro.indicacoes.map((indicacao) => indicacao.status),
    );

    if (cadastro.status === nextStatus) {
      return cadastro;
    }

    return tx.cadastro.update({
      where: { id: cadastroId },
      data: {
        status: nextStatus,
      },
      include: {
        indicacoes: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });
  }

  private async loadCompanyNameMap(
    prisma: PrismaService | PrismaTransaction,
    sourceIds: Set<string>,
  ) {
    if (!sourceIds.size) {
      return new Map<string, string>();
    }

    const companies = await prisma.pedagogicalCompanySnapshot.findMany({
      where: {
        sourceId: {
          in: [...sourceIds],
        },
        batch: {
          status: 'CURRENT',
        },
      },
      select: {
        sourceId: true,
        name: true,
      },
    });

    return new Map(companies.map((company) => [company.sourceId, company.name]));
  }

  private toCadastroListItem(cadastro: CadastroListRow): CadastroListItem {
    const hasOperationalHistory = hasCadastroOperationalHistory(
      cadastro._count.indicacoes,
      cadastro.pedagogicalStudentSourceId,
    );

    return {
      id: cadastro.id,
      nomeCompleto: cadastro.nomeCompleto,
      telefone: cadastro.telefone,
      cpf: cadastro.cpf,
      nomeResponsavel: cadastro.nomeResponsavel,
      periodoEstudo: cadastro.periodoEstudo,
      status: cadastro.status,
      deletedAt: cadastro.deletedAt?.toISOString() ?? null,
      createdAt: cadastro.createdAt.toISOString(),
      updatedAt: cadastro.updatedAt.toISOString(),
      hasOperationalHistory,
      canDelete: canDeleteCadastro(
        cadastro._count.indicacoes,
        cadastro.pedagogicalStudentSourceId,
        cadastro.deletedAt,
      ),
      canArchive: canArchiveCadastro(cadastro.pedagogicalStudentSourceId, cadastro.deletedAt),
    };
  }

  private toCadastroDetail(
    cadastro: CadastroDetailRow,
    companyNameMap: Map<string, string>,
  ): CadastroDetail {
    return {
      ...this.toCadastroListItem({
        ...cadastro,
        _count: {
          indicacoes: cadastro.indicacoes.length,
        },
      }),
      pedagogicalStudentSourceId: cadastro.pedagogicalStudentSourceId ?? null,
      indicacoes: cadastro.indicacoes.map((indicacao) =>
        this.toIndicacaoItem(indicacao, companyNameMap),
      ),
    };
  }

  private toIndicacaoItem(
    indicacao: IndicacaoRow,
    companyNameMap: Map<string, string>,
  ): IndicacaoItem {
    return {
      id: indicacao.id,
      cadastroId: indicacao.cadastroId,
      empresaSourceId: indicacao.empresaSourceId,
      empresaNome: companyNameMap.get(indicacao.empresaSourceId) ?? null,
      status: indicacao.status,
      sentAt: indicacao.sentAt.toISOString(),
      acceptedAt: indicacao.acceptedAt?.toISOString() ?? null,
      rejectedAt: indicacao.rejectedAt?.toISOString() ?? null,
      contractGeneratedAt: indicacao.contractGeneratedAt?.toISOString() ?? null,
      closedAt: indicacao.closedAt?.toISOString() ?? null,
      closedReason: indicacao.closedReason ?? null,
      createdAt: indicacao.createdAt.toISOString(),
      updatedAt: indicacao.updatedAt.toISOString(),
    };
  }

  private rethrowKnownConflicts(error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('O registro informado viola uma restricao de unicidade.');
    }
  }
}
