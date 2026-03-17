import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  PedagogicalCompany,
  PedagogicalStudent,
} from '@financial-martec/contracts';
import { PrismaService } from '@/common/prisma/prisma.service';
import { sha256, stableJson } from '@/common/lib/hash.util';
import { PedagogicalClientService } from './pedagogical.client';

function parseDate(value?: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

@Injectable()
export class PedagogicalProjectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly client: PedagogicalClientService,
  ) {}

  async ensureCompanies(forceRefresh = false) {
    const count = await this.prisma.pedagogicalCompanySnapshot.count();
    if (forceRefresh || count === 0) {
      await this.syncCompanies();
    }
  }

  async ensureCompany(sourceId: string, forceRefresh = false) {
    const existing = await this.prisma.pedagogicalCompanySnapshot.findUnique({
      where: { sourceId },
    });

    if (!existing || forceRefresh) {
      const company = await this.client.getCompany(sourceId);
      await this.upsertCompany(company);
    }
  }

  async ensureStudents(forceRefresh = false) {
    const count = await this.prisma.pedagogicalStudentSnapshot.count();
    if (forceRefresh || count === 0) {
      await this.syncStudents();
    }
  }

  async ensureStudent(sourceId: string, forceRefresh = false) {
    const existing = await this.prisma.pedagogicalStudentSnapshot.findUnique({
      where: { sourceId },
    });

    if (!existing || forceRefresh) {
      const student = await this.client.getStudent(sourceId);
      await this.upsertStudent(student);
    }
  }

  async runFullSync(triggeredByUserId?: string | null, mode = 'manual') {
    const run = await this.prisma.pedagogicalSyncRun.create({
      data: {
        mode,
        triggeredByUserId: triggeredByUserId ?? null,
        status: 'RUNNING',
      },
    });

    try {
      const companies = await this.client.listCompanies();
      const students = await this.client.listStudents();

      for (const company of companies) {
        await this.upsertCompany(company);
      }

      for (const student of students) {
        await this.upsertStudent(student);
      }

      const existingCompanies = await this.prisma.pedagogicalCompanySnapshot.findMany({
        select: { sourceId: true },
      });
      const existingStudents = await this.prisma.pedagogicalStudentSnapshot.findMany({
        select: { sourceId: true },
      });

      const remoteCompanyIds = new Set(companies.map((company) => company.id));
      const remoteStudentIds = new Set(students.map((student) => student.id));

      const missingCompanies = existingCompanies.filter(
        (company: { sourceId: string }) => !remoteCompanyIds.has(company.sourceId),
      );
      const missingStudents = existingStudents.filter(
        (student: { sourceId: string }) => !remoteStudentIds.has(student.sourceId),
      );

      const issues = [
        ...missingCompanies.map((company: { sourceId: string }) => ({
          entityType: 'company',
          entitySourceId: company.sourceId,
          severity: 'WARNING' as const,
          code: 'missing_in_remote',
          message: 'Empresa existe localmente, mas não retornou na API pedagógica.',
        })),
        ...missingStudents.map((student: { sourceId: string }) => ({
          entityType: 'student',
          entitySourceId: student.sourceId,
          severity: 'WARNING' as const,
          code: 'missing_in_remote',
          message: 'Aluno existe localmente, mas não retornou na API pedagógica.',
        })),
      ];

      if (issues.length) {
        await this.prisma.pedagogicalSyncIssue.createMany({
          data: issues.map((issue) => ({
            syncRunId: run.id,
            ...issue,
          })),
        });
      }

      const status = issues.length ? 'PARTIAL' : 'SUCCESS';

      return this.prisma.pedagogicalSyncRun.update({
        where: { id: run.id },
        data: {
          status,
          finishedAt: new Date(),
          summary: {
            companiesFetched: companies.length,
            studentsFetched: students.length,
            issues: issues.length,
          },
        },
        include: {
          issues: true,
        },
      });
    } catch (error) {
      return this.prisma.pedagogicalSyncRun.update({
        where: { id: run.id },
        data: {
          status: 'FAILED',
          finishedAt: new Date(),
          summary: {
            error: error instanceof Error ? error.message : 'unknown',
          },
        },
      });
    }
  }

  private async syncCompanies() {
    const companies = await this.client.listCompanies();
    for (const company of companies) {
      await this.upsertCompany(company);
    }
  }

  private async syncStudents() {
    const students = await this.client.listStudents();
    for (const student of students) {
      await this.upsertStudent(student);
    }
  }

  private async upsertCompany(company: PedagogicalCompany) {
    const payloadHash = sha256(stableJson(company));

    await this.prisma.pedagogicalCompanySnapshot.upsert({
      where: { sourceId: company.id },
      update: {
        name: company.nome,
        legalName: company.razao_social ?? null,
        taxId: company.cnpj ?? null,
        email: company.email ?? null,
        phone: company.telefone ?? null,
        payloadHash,
        sourceUpdatedAt: parseDate(company.criado_em),
        lastSyncedAt: new Date(),
        data: company as unknown as Prisma.InputJsonValue,
      },
      create: {
        sourceId: company.id,
        name: company.nome,
        legalName: company.razao_social ?? null,
        taxId: company.cnpj ?? null,
        email: company.email ?? null,
        phone: company.telefone ?? null,
        payloadHash,
        sourceUpdatedAt: parseDate(company.criado_em),
        lastSyncedAt: new Date(),
        data: company as unknown as Prisma.InputJsonValue,
      },
    });
  }

  private async upsertStudent(student: PedagogicalStudent) {
    const payloadHash = sha256(stableJson(student));
    const company = await this.prisma.pedagogicalCompanySnapshot.findUnique({
      where: { sourceId: student.empresa_id },
      select: { id: true },
    });

    await this.prisma.pedagogicalStudentSnapshot.upsert({
      where: { sourceId: student.id },
      update: {
        companySourceId: student.empresa_id,
        companySnapshotId: company?.id ?? null,
        name: student.nome,
        cpf: student.cpf,
        email: student.email ?? null,
        birthDate: parseDate(student.data_nascimento),
        payloadHash,
        sourceUpdatedAt: parseDate(student.atualizado_em ?? student.criado_em),
        lastSyncedAt: new Date(),
        data: student as unknown as Prisma.InputJsonValue,
      },
      create: {
        sourceId: student.id,
        companySourceId: student.empresa_id,
        companySnapshotId: company?.id ?? null,
        name: student.nome,
        cpf: student.cpf,
        email: student.email ?? null,
        birthDate: parseDate(student.data_nascimento),
        payloadHash,
        sourceUpdatedAt: parseDate(student.atualizado_em ?? student.criado_em),
        lastSyncedAt: new Date(),
        data: student as unknown as Prisma.InputJsonValue,
      },
    });
  }
}
