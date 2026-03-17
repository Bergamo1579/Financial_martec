import { Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiExcludeEndpoint,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import type { AuthenticatedUser } from '@/modules/auth/auth.types';
import { InternalSyncGuard } from './internal-sync.guard';
import { SyncService } from './sync.service';

@ApiTags('Sync')
@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post('pedagogical/run')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiCookieAuth('fm_access_token')
  @Roles('owner', 'admin_financeiro')
  @ApiOperation({ summary: 'Enfileira reconciliação manual do sistema pedagógico' })
  run(@CurrentUser() user: AuthenticatedUser) {
    return this.syncService.enqueuePedagogicalSync(user.id);
  }

  @Post('internal/pedagogical/execute')
  @UseGuards(InternalSyncGuard)
  @ApiExcludeEndpoint()
  execute() {
    return this.syncService.executePedagogicalSync(null, 'worker');
  }
}
