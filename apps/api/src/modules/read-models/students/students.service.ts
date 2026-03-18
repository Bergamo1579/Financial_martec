import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { StudentDetail, StudentListItem } from '@financial-martec/contracts';
import { buildPaginatedResponse } from '@/common/lib/pagination.util';
import { PrismaService } from '@/common/prisma/prisma.service';
import { AuditService } from '@/modules/audit/audit.service';
import { QueryStudentsDto } from '@/modules/integration/pedagogical/dto/query-students.dto';

type StudentWithCompany = Prisma.PedagogicalStudentSnapshotGetPayload<{
  include: {
    companySnapshot: true;
  };
}>;

@Injectable()
export class StudentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async list(query: QueryStudentsDto, actorId: string, requestId?: string | null) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = {
      batch: {
        status: 'CURRENT' as const,
      },
      ...(query.companySourceId
        ? {
            companySourceId: query.companySourceId,
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' as const } },
              { cpf: { contains: query.search, mode: 'insensitive' as const } },
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
        },
      }),
      this.prisma.pedagogicalStudentSnapshot.count({ where }),
    ]);

    await this.auditService.record({
      actorId,
      actorType: 'user',
      action: 'read.student.list',
      resourceType: 'pedagogical_student_snapshot',
      requestId,
      metadata: {
        page,
        pageSize,
        search: query.search ?? null,
        companySourceId: query.companySourceId ?? null,
      },
    });

    return buildPaginatedResponse(
      students.map((student) => this.toStudentListItem(student)),
      page,
      pageSize,
      total,
    );
  }

  async findOne(sourceId: string, actorId: string, requestId?: string | null) {
    const student = await this.prisma.pedagogicalStudentSnapshot.findFirst({
      where: {
        sourceId,
        batch: {
          status: 'CURRENT',
        },
      },
      include: {
        companySnapshot: true,
      },
    });

    if (!student) {
      throw new NotFoundException('Aluno nao encontrado.');
    }

    await this.auditService.record({
      actorId,
      actorType: 'user',
      action: 'read.student.detail',
      resourceType: 'pedagogical_student_snapshot',
      resourceId: sourceId,
      requestId,
    });

    return this.toStudentDetail(student);
  }

  private toStudentListItem(
    student: StudentWithCompany,
  ): StudentListItem {
    return {
      sourceId: student.sourceId,
      name: student.name,
      cpf: student.cpf,
      email: student.email,
      birthDate: student.birthDate?.toISOString() ?? null,
      sourceUpdatedAt: student.sourceUpdatedAt?.toISOString() ?? null,
      lastSyncedAt: student.lastSyncedAt.toISOString(),
      company: student.companySnapshot
        ? {
            sourceId: student.companySnapshot.sourceId,
            name: student.companySnapshot.name,
          }
        : null,
    };
  }

  private toStudentDetail(
    student: StudentWithCompany,
  ): StudentDetail {
    return {
      ...this.toStudentListItem(student),
      createdAt: student.createdAt.toISOString(),
      updatedAt: student.updatedAt.toISOString(),
    };
  }
}
