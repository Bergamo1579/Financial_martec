import { Injectable, NotFoundException } from '@nestjs/common';
import type { PedagogicalCompanySnapshot } from '@prisma/client';
import type { CompanyDetail, CompanyListItem } from '@financial-martec/contracts';
import { buildPaginatedResponse } from '@/common/lib/pagination.util';
import { PrismaService } from '@/common/prisma/prisma.service';
import { AuditService } from '@/modules/audit/audit.service';
import { QueryCompaniesDto } from '@/modules/integration/pedagogical/dto/query-companies.dto';

@Injectable()
export class CompaniesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async list(query: QueryCompaniesDto, actorId: string, requestId?: string | null) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = query.search
      ? {
          batch: {
            status: 'CURRENT' as const,
          },
          OR: [
            { name: { contains: query.search, mode: 'insensitive' as const } },
            { legalName: { contains: query.search, mode: 'insensitive' as const } },
            { taxId: { contains: query.search, mode: 'insensitive' as const } },
          ],
        }
      : {
          batch: {
            status: 'CURRENT' as const,
          },
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

    await this.auditService.record({
      actorId,
      actorType: 'user',
      action: 'read.company.list',
      resourceType: 'pedagogical_company_snapshot',
      requestId,
      metadata: { page, pageSize, search: query.search ?? null },
    });

    return buildPaginatedResponse(
      companies.map((company) => this.toCompanyListItem(company)),
      page,
      pageSize,
      total,
    );
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

    await this.auditService.record({
      actorId,
      actorType: 'user',
      action: 'read.company.detail',
      resourceType: 'pedagogical_company_snapshot',
      resourceId: sourceId,
      requestId,
    });

    return this.toCompanyDetail(company);
  }

  private toCompanyListItem(
    company: PedagogicalCompanySnapshot,
  ): CompanyListItem {
    return {
      sourceId: company.sourceId,
      name: company.name,
      legalName: company.legalName,
      taxId: company.taxId,
      email: company.email,
      phone: company.phone,
      sourceUpdatedAt: company.sourceUpdatedAt?.toISOString() ?? null,
      lastSyncedAt: company.lastSyncedAt.toISOString(),
    };
  }

  private toCompanyDetail(
    company: PedagogicalCompanySnapshot,
  ): CompanyDetail {
    return {
      ...this.toCompanyListItem(company),
      createdAt: company.createdAt.toISOString(),
      updatedAt: company.updatedAt.toISOString(),
    };
  }
}
