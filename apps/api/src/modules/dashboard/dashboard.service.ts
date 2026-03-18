import { Injectable } from '@nestjs/common';
import type { DashboardSummary } from '@financial-martec/contracts';
import { PrismaService } from '@/common/prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(): Promise<DashboardSummary> {
    const [totalCompanies, totalStudents, lastRun, lastSuccessfulRun, openIssues] = await Promise.all([
      this.prisma.pedagogicalCompanySnapshot.count({
        where: {
          batch: {
            status: 'CURRENT',
          },
        },
      }),
      this.prisma.pedagogicalStudentSnapshot.count({
        where: {
          batch: {
            status: 'CURRENT',
          },
        },
      }),
      this.prisma.pedagogicalSyncRun.findFirst({
        orderBy: {
          startedAt: 'desc',
        },
      }),
      this.prisma.pedagogicalSyncRun.findFirst({
        where: {
          status: 'SUCCESS',
        },
        orderBy: {
          finishedAt: 'desc',
        },
      }),
      this.prisma.pedagogicalIssueState.count({
        where: {
          resolvedAt: null,
        },
      }),
    ]);

    return {
      totalCompanies,
      totalStudents,
      lastSyncAt: lastRun?.finishedAt?.toISOString() ?? lastRun?.startedAt.toISOString() ?? null,
      lastSuccessfulSyncAt: lastSuccessfulRun?.finishedAt?.toISOString() ?? null,
      lastSyncStatus: lastRun?.status ?? null,
      openIssues,
    };
  }
}
