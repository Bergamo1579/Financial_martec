import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permissions } from '@/common/decorators/permissions.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { AuditEventsPageDto } from './dto/audit-response.dto';
import { QueryAuditEventsDto } from './dto/query-audit-events.dto';
import { AuditService } from './audit.service';

@ApiTags('Audit')
@ApiCookieAuth('fm_access_token')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('audit.read')
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('events')
  @ApiOperation({ summary: 'Lista eventos de auditoria com filtros operacionais' })
  @ApiOkResponse({ type: AuditEventsPageDto })
  async list(@Query() query: QueryAuditEventsDto) {
    return this.auditService.list(query);
  }
}
