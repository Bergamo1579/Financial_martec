import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuditEventItem } from '@financial-martec/contracts';
import { buildPaginatedResponse } from '@/common/lib/pagination.util';
import { PrismaService } from '@/common/prisma/prisma.service';
import type { QueryAuditEventsDto } from './dto/query-audit-events.dto';
import type { AuditEventPayload } from '@financial-martec/contracts';

type AuditEventWithActor = Prisma.AuditEventGetPayload<{
  include: {
    actorUser: {
      select: {
        id: true;
        name: true;
        email: true;
      };
    };
  };
}>;

type AuditPrismaClient = Pick<PrismaService, 'auditEvent'> | Pick<Prisma.TransactionClient, 'auditEvent'>;

function toRecord(value: Prisma.JsonValue | null | undefined) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(
    payload: AuditEventPayload & { requestId?: string | null },
    prisma: AuditPrismaClient = this.prisma,
  ) {
    await prisma.auditEvent.create({
      data: {
        actorUserId: payload.actorId ?? null,
        actorType: payload.actorType,
        action: payload.action,
        resourceType: payload.resourceType,
        resourceId: payload.resourceId ?? null,
        ipAddress: payload.ipAddress ?? null,
        requestId: payload.requestId ?? null,
        metadata: (payload.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async list(query: QueryAuditEventsDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = {
      ...(query.action ? { action: query.action } : {}),
      ...(query.resourceType ? { resourceType: query.resourceType } : {}),
      ...(query.actorUserId ? { actorUserId: query.actorUserId } : {}),
      ...(query.resourceId ? { resourceId: query.resourceId } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    const [events, total] = await Promise.all([
      this.prisma.auditEvent.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          actorUser: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
      this.prisma.auditEvent.count({ where }),
    ]);

    return buildPaginatedResponse(
      events.map((event) => this.toAuditEventItem(event)),
      page,
      pageSize,
      total,
    );
  }

  private toAuditEventItem(
    event: AuditEventWithActor,
  ): AuditEventItem {
    return {
      id: event.id,
      actorType: event.actorType as 'user' | 'system',
      actorUser: event.actorUser
        ? {
            id: event.actorUser.id,
            name: event.actorUser.name,
            email: event.actorUser.email,
          }
        : null,
      action: event.action,
      resourceType: event.resourceType,
      resourceId: event.resourceId ?? null,
      ipAddress: event.ipAddress ?? null,
      requestId: event.requestId ?? null,
      metadata: toRecord(event.metadata),
      createdAt: event.createdAt.toISOString(),
    };
  }
}
