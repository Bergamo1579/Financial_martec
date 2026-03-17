import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '@/common/decorators/roles.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { AuditService } from './audit.service';
import { QueryAuditEventsDto } from './dto/query-audit-events.dto';

@ApiTags('Audit')
@ApiCookieAuth('fm_access_token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('events')
  @Roles('owner', 'admin_financeiro', 'auditor')
  @ApiOperation({ summary: 'Lista eventos de auditoria' })
  async list(@Query() query: QueryAuditEventsDto) {
    return this.auditService.list(query);
  }
}
