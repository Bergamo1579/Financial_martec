import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  PlanoPagamentoDetail,
  PlanoPagamentoListItem,
} from '@financial-martec/contracts';
import { buildPaginatedResponse } from '@/common/lib/pagination.util';
import { PrismaService } from '@/common/prisma/prisma.service';
import { AuditService } from '@/modules/audit/audit.service';
import { CreatePlanoPagamentoDto } from './dto/create-plano-pagamento.dto';
import { QueryPlanosPagamentoDto } from './dto/query-planos-pagamento.dto';
import { UpdatePlanoPagamentoDto } from './dto/update-plano-pagamento.dto';

const futureUsageCopy = [
  'Este plano sera vinculado futuramente a uma relacao entre matricula e empresa.',
  'A empresa sera a pagadora dos boletos.',
  'A geracao de parcelas e boletos nao faz parte desta fase.',
];

@Injectable()
export class AppPlanosPagamentoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async list(query: QueryPlanosPagamentoDto, actorId: string, requestId?: string | null) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const trimmedSearch = query.search?.trim();
    const where: Prisma.PlanoPagamentoWhereInput = {
      ...(trimmedSearch
        ? {
            nome: {
              contains: trimmedSearch,
              mode: 'insensitive',
            },
          }
        : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    const [planos, total] = await Promise.all([
      this.prisma.planoPagamento.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { nome: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.planoPagamento.count({ where }),
    ]);

    await this.auditService.record({
      actorId,
      actorType: 'user',
      action: 'app.payment-plan.list',
      resourceType: 'plano_pagamento',
      requestId,
      metadata: {
        page,
        pageSize,
        search: trimmedSearch ?? null,
        status: query.status ?? null,
      },
    });

    return buildPaginatedResponse(
      planos.map((plano) => this.toPlanoListItem(plano)),
      page,
      pageSize,
      total,
    );
  }

  async findOne(id: string, actorId: string, requestId?: string | null) {
    const plano = await this.prisma.planoPagamento.findUnique({
      where: { id },
    });

    if (!plano) {
      throw new NotFoundException('Plano de pagamento nao encontrado.');
    }

    await this.auditService.record({
      actorId,
      actorType: 'user',
      action: 'app.payment-plan.detail',
      resourceType: 'plano_pagamento',
      resourceId: id,
      requestId,
    });

    return this.toPlanoDetail(plano);
  }

  async create(
    dto: CreatePlanoPagamentoDto,
    actorId: string,
    requestId?: string | null,
    ipAddress?: string | null,
  ) {
    this.assertPlanoFields(dto.valorTotal, dto.quantidadeMeses, dto.diaVencimento);

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const plano = await tx.planoPagamento.create({
          data: {
            nome: dto.nome.trim(),
            valorTotal: new Prisma.Decimal(dto.valorTotal),
            quantidadeMeses: dto.quantidadeMeses,
            diaVencimento: dto.diaVencimento,
            status: dto.status ?? 'ATIVO',
          },
        });

        await this.auditService.record(
          {
            actorId,
            actorType: 'user',
            action: 'app.payment-plan.created',
            resourceType: 'plano_pagamento',
            resourceId: plano.id,
            requestId,
            ipAddress,
            metadata: {
              status: plano.status,
            },
          },
          tx,
        );

        return plano;
      });

      return this.toPlanoDetail(created);
    } catch (error) {
      this.rethrowKnownConflicts(error);
      throw error;
    }
  }

  async update(
    id: string,
    dto: UpdatePlanoPagamentoDto,
    actorId: string,
    requestId?: string | null,
    ipAddress?: string | null,
  ) {
    if (
      dto.valorTotal !== undefined ||
      dto.quantidadeMeses !== undefined ||
      dto.diaVencimento !== undefined
    ) {
      const current = await this.prisma.planoPagamento.findUnique({
        where: { id },
      });

      if (!current) {
        throw new NotFoundException('Plano de pagamento nao encontrado.');
      }

      this.assertPlanoFields(
        dto.valorTotal ?? Number(current.valorTotal.toString()),
        dto.quantidadeMeses ?? current.quantidadeMeses,
        dto.diaVencimento ?? current.diaVencimento,
      );
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.planoPagamento.findUnique({
          where: { id },
        });

        if (!existing) {
          throw new NotFoundException('Plano de pagamento nao encontrado.');
        }

        const updated = await tx.planoPagamento.update({
          where: { id },
          data: {
            ...(dto.nome !== undefined ? { nome: dto.nome.trim() } : {}),
            ...(dto.valorTotal !== undefined
              ? {
                  valorTotal: new Prisma.Decimal(dto.valorTotal),
                }
              : {}),
            ...(dto.quantidadeMeses !== undefined
              ? {
                  quantidadeMeses: dto.quantidadeMeses,
                }
              : {}),
            ...(dto.diaVencimento !== undefined
              ? {
                  diaVencimento: dto.diaVencimento,
                }
              : {}),
            ...(dto.status !== undefined ? { status: dto.status } : {}),
          },
        });

        await this.auditService.record(
          {
            actorId,
            actorType: 'user',
            action: 'app.payment-plan.updated',
            resourceType: 'plano_pagamento',
            resourceId: updated.id,
            requestId,
            ipAddress,
            metadata: {
              status: updated.status,
            },
          },
          tx,
        );

        return this.toPlanoDetail(updated);
      });
    } catch (error) {
      this.rethrowKnownConflicts(error);
      throw error;
    }
  }

  private assertPlanoFields(valorTotal: number, quantidadeMeses: number, diaVencimento: number) {
    if (!(valorTotal > 0)) {
      throw new BadRequestException('Valor total deve ser maior que zero.');
    }

    if (!Number.isInteger(quantidadeMeses) || quantidadeMeses <= 0) {
      throw new BadRequestException('Quantidade de meses deve ser um inteiro positivo.');
    }

    if (!Number.isInteger(diaVencimento) || diaVencimento < 1 || diaVencimento > 31) {
      throw new BadRequestException('Dia de vencimento deve estar entre 1 e 31.');
    }
  }

  private toPlanoListItem(
    plano: Prisma.PlanoPagamentoGetPayload<Record<string, never>>,
  ): PlanoPagamentoListItem {
    return {
      id: plano.id,
      nome: plano.nome,
      valorTotal: Number(plano.valorTotal.toString()),
      quantidadeMeses: plano.quantidadeMeses,
      diaVencimento: plano.diaVencimento,
      status: plano.status,
      createdAt: plano.createdAt.toISOString(),
      updatedAt: plano.updatedAt.toISOString(),
    };
  }

  private toPlanoDetail(
    plano: Prisma.PlanoPagamentoGetPayload<Record<string, never>>,
  ): PlanoPagamentoDetail {
    return {
      ...this.toPlanoListItem(plano),
      usoFuturoEsperado: futureUsageCopy,
    };
  }

  private rethrowKnownConflicts(error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('Ja existe um plano de pagamento com este nome.');
    }
  }
}
