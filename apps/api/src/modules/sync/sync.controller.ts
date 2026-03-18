import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiExcludeEndpoint,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Permissions } from '@/common/decorators/permissions.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { getRequestId } from '@/common/lib/request.util';
import type { AuthenticatedUser } from '@/modules/auth/auth.types';
import { QuerySyncIssueStatesDto } from './dto/query-sync-issue-states.dto';
import { QuerySyncRunsDto } from './dto/query-sync-runs.dto';
import { ResolveSyncIssueDto } from './dto/resolve-sync-issue.dto';
import {
  SyncEnqueueResponseDto,
  SyncIssueStateItemDto,
  SyncIssueStatesPageDto,
  SyncOverviewDto,
  SyncRunDetailDto,
  SyncRunsPageDto,
} from './dto/sync-response.dto';
import { InternalSyncGuard } from './internal-sync.guard';
import { SyncService } from './sync.service';

@ApiTags('Sync')
@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post('pedagogical/run')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @HttpCode(200)
  @ApiCookieAuth('fm_access_token')
  @Permissions('sync.manage')
  @ApiOperation({ summary: 'Enfileira reconciliacao manual do sistema pedagogico' })
  @ApiOkResponse({ type: SyncEnqueueResponseDto })
  run(@CurrentUser() user: AuthenticatedUser, @Req() request: Request) {
    return this.syncService.enqueuePedagogicalSync(user.id, getRequestId(request));
  }

  @Get('pedagogical/overview')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiCookieAuth('fm_access_token')
  @Permissions('sync.manage')
  @ApiOperation({ summary: 'Retorna o estado operacional do ultimo snapshot pedagogico' })
  @ApiOkResponse({ type: SyncOverviewDto })
  overview() {
    return this.syncService.getOverview();
  }

  @Get('pedagogical/runs')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiCookieAuth('fm_access_token')
  @Permissions('sync.manage')
  @ApiOperation({ summary: 'Lista execucoes de sync do pedagogico com filtros basicos' })
  @ApiOkResponse({ type: SyncRunsPageDto })
  listRuns(@Query() query: QuerySyncRunsDto) {
    return this.syncService.listRuns(query);
  }

  @Get('pedagogical/runs/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiCookieAuth('fm_access_token')
  @Permissions('sync.manage')
  @ApiOperation({ summary: 'Detalha uma execucao especifica do sync pedagogico' })
  @ApiOkResponse({ type: SyncRunDetailDto })
  getRunDetail(@Param('id') id: string) {
    return this.syncService.getRunDetail(id);
  }

  @Get('pedagogical/issues')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiCookieAuth('fm_access_token')
  @Permissions('sync.manage')
  @ApiOperation({ summary: 'Lista o estado atual das pendencias do snapshot pedagogico' })
  @ApiOkResponse({ type: SyncIssueStatesPageDto })
  listIssueStates(@Query() query: QuerySyncIssueStatesDto) {
    return this.syncService.listIssueStates(query);
  }

  @Patch('pedagogical/issues/:id/resolve')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiCookieAuth('fm_access_token')
  @Permissions('sync.manage')
  @ApiOperation({ summary: 'Resolve manualmente uma pendencia operacional do snapshot pedagogico' })
  @ApiOkResponse({ type: SyncIssueStateItemDto })
  resolveIssueState(
    @Param('id') id: string,
    @Body() dto: ResolveSyncIssueDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.syncService.resolveIssueState(
      id,
      user.id,
      dto.note,
      getRequestId(request),
    );
  }

  @Post('internal/pedagogical/execute')
  @UseGuards(InternalSyncGuard)
  @ApiExcludeEndpoint()
  execute(
    @Body()
    body?: {
      triggeredByUserId?: string | null;
      mode?: 'manual' | 'schedule' | 'startup';
    },
  ) {
    return this.syncService.executePedagogicalSync(
      body?.triggeredByUserId ?? null,
      body?.mode ?? 'manual',
    );
  }
}
