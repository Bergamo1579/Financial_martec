import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/common/prisma/prisma.service';
import type { AuditEventPayload } from '@financial-martec/contracts';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(payload: AuditEventPayload & { requestId?: string | null }) {
    await this.prisma.auditEvent.create({
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

  async list(query: { action?: string; resourceType?: string; limit?: number }) {
    return this.prisma.auditEvent.findMany({
      where: {
        ...(query.action ? { action: query.action } : {}),
        ...(query.resourceType ? { resourceType: query.resourceType } : {}),
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: query.limit ?? 50,
    });
  }
}
