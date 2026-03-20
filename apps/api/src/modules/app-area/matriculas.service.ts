import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AppMatriculaDetail, AppMatriculaListItem } from '@financial-martec/contracts';
import { buildPaginatedResponse } from '@/common/lib/pagination.util';
import { PrismaService } from '@/common/prisma/prisma.service';
import { AuditService } from '@/modules/audit/audit.service';
import { QueryAppMatriculasDto } from './dto/query-app-matriculas.dto';

type MatriculaRow = Prisma.PedagogicalStudentSnapshotGetPayload<{
  include: {
    companySnapshot: true;
    classSnapshot: true;
    unitSnapshot: true;
  };
}>;

@Injectable()
export class AppMatriculasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async list(query: QueryAppMatriculasDto, actorId: string, requestId?: string | null) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const trimmedSearch = query.search?.trim();
    const where: Prisma.PedagogicalStudentSnapshotWhereInput = {
      batch: {
        status: 'CURRENT',
      },
      ...(query.empresaSourceId ? { companySourceId: query.empresaSourceId } : {}),
      ...(query.turmaSourceId ? { classSourceId: query.turmaSourceId } : {}),
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
      action: 'app.matricula.list',
      resourceType: 'pedagogical_student_snapshot',
      requestId,
      metadata: {
        page,
        pageSize,
        search: trimmedSearch ?? null,
        empresaSourceId: query.empresaSourceId ?? null,
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
        classSnapshot: true,
        unitSnapshot: true,
      },
    });

    if (!student) {
      throw new NotFoundException('Matricula nao encontrada.');
    }

    await this.auditService.record({
      actorId,
      actorType: 'user',
      action: 'app.matricula.detail',
      resourceType: 'pedagogical_student_snapshot',
      resourceId: sourceId,
      requestId,
    });

    return this.toMatriculaDetail(student);
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

  private toMatriculaDetail(student: MatriculaRow): AppMatriculaDetail {
    const rawData = this.toRecord(student.data);

    return {
      ...this.toMatriculaListItem(student),
      email: student.email,
      telefone: this.readString(rawData, 'celular'),
      dataNascimento: student.birthDate?.toISOString() ?? null,
      nomeResponsavel: this.readString(rawData, 'responsavel_nome'),
      sexo: this.readString(rawData, 'sexo'),
      rg: this.readString(rawData, 'rg'),
      endereco: this.readString(rawData, 'endereco'),
      numero: this.readString(rawData, 'numero'),
      complemento: this.readString(rawData, 'complemento'),
      bairro: this.readString(rawData, 'bairro'),
      cidade: this.readString(rawData, 'cidade'),
      cep: this.readString(rawData, 'cep'),
      celularRecado: this.readString(rawData, 'celular_recado'),
      escola: this.readString(rawData, 'escola'),
      serie: this.readString(rawData, 'serie'),
      periodo: this.readString(rawData, 'periodo'),
      pedagogicalCreatedAt: this.readDateString(rawData, 'criado_em'),
      pedagogicalUpdatedAt: this.readDateString(rawData, 'atualizado_em'),
      createdAt: student.createdAt.toISOString(),
      updatedAt: student.updatedAt.toISOString(),
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

  private readDateString(record: Record<string, unknown> | null, key: string) {
    const value = this.readString(record, key);
    if (!value) {
      return null;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
  }
}
