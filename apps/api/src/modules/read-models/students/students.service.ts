import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { AuditService } from '@/modules/audit/audit.service';
import { QueryStudentsDto } from '@/modules/integration/pedagogical/dto/query-students.dto';
import { PedagogicalProjectionService } from '@/modules/integration/pedagogical/pedagogical.projection.service';

@Injectable()
export class StudentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projection: PedagogicalProjectionService,
    private readonly auditService: AuditService,
  ) {}

  async list(query: QueryStudentsDto, actorId: string) {
    await this.projection.ensureStudents(query.forceRefresh);

    const students = await this.prisma.pedagogicalStudentSnapshot.findMany({
      where: {
        ...(query.companySourceId
          ? {
              companySourceId: query.companySourceId,
            }
          : {}),
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: 'insensitive' } },
                { cpf: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: {
        name: 'asc',
      },
      take: query.take,
      include: {
        companySnapshot: true,
      },
    });

    await this.auditService.record({
      actorId,
      actorType: 'user',
      action: 'read.student.list',
      resourceType: 'pedagogical_student_snapshot',
      metadata: { ...query },
    });

    return students;
  }

  async findOne(sourceId: string, actorId: string, forceRefresh = false) {
    await this.projection.ensureStudent(sourceId, forceRefresh);

    const student = await this.prisma.pedagogicalStudentSnapshot.findUnique({
      where: { sourceId },
      include: {
        companySnapshot: true,
      },
    });

    if (!student) {
      throw new NotFoundException('Aluno não encontrado.');
    }

    await this.auditService.record({
      actorId,
      actorType: 'user',
      action: 'read.student.detail',
      resourceType: 'pedagogical_student_snapshot',
      resourceId: sourceId,
    });

    return student;
  }
}
