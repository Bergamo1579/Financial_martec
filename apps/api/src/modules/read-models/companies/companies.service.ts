import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { AuditService } from '@/modules/audit/audit.service';
import { QueryCompaniesDto } from '@/modules/integration/pedagogical/dto/query-companies.dto';
import { PedagogicalProjectionService } from '@/modules/integration/pedagogical/pedagogical.projection.service';

@Injectable()
export class CompaniesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projection: PedagogicalProjectionService,
    private readonly auditService: AuditService,
  ) {}

  async list(query: QueryCompaniesDto, actorId: string) {
    await this.projection.ensureCompanies(query.forceRefresh);

    const data = await this.prisma.pedagogicalCompanySnapshot.findMany({
      where: query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { legalName: { contains: query.search, mode: 'insensitive' } },
              { taxId: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : undefined,
      orderBy: {
        name: 'asc',
      },
      take: query.take,
    });

    await this.auditService.record({
      actorId,
      actorType: 'user',
      action: 'read.company.list',
      resourceType: 'pedagogical_company_snapshot',
      metadata: { ...query },
    });

    return data;
  }

  async findOne(sourceId: string, actorId: string, forceRefresh = false) {
    await this.projection.ensureCompany(sourceId, forceRefresh);

    const company = await this.prisma.pedagogicalCompanySnapshot.findUnique({
      where: { sourceId },
    });

    if (!company) {
      throw new NotFoundException('Empresa não encontrada.');
    }

    await this.auditService.record({
      actorId,
      actorType: 'user',
      action: 'read.company.detail',
      resourceType: 'pedagogical_company_snapshot',
      resourceId: sourceId,
    });

    return company;
  }
}
