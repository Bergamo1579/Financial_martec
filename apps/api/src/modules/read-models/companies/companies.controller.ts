import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import type { AuthenticatedUser } from '@/modules/auth/auth.types';
import { QueryCompaniesDto } from '@/modules/integration/pedagogical/dto/query-companies.dto';
import { CompaniesService } from './companies.service';

@ApiTags('Empresas')
@ApiCookieAuth('fm_access_token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('owner', 'admin_financeiro', 'analista_financeiro', 'auditor')
@Controller('empresas')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get()
  @ApiOperation({ summary: 'Lista empresas sincronizadas do pedagógico' })
  async list(
    @Query() query: QueryCompaniesDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.companiesService.list(query, user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalha empresa sincronizada do pedagógico' })
  async findOne(
    @Param('id') id: string,
    @Query('forceRefresh') forceRefresh: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.companiesService.findOne(id, user.id, forceRefresh === 'true');
  }
}
