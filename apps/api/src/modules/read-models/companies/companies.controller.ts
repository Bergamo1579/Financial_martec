import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Permissions } from '@/common/decorators/permissions.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { getRequestId } from '@/common/lib/request.util';
import type { AuthenticatedUser } from '@/modules/auth/auth.types';
import { QueryCompaniesDto } from '@/modules/integration/pedagogical/dto/query-companies.dto';
import { CompaniesPageDto, CompanyDetailDto } from './dto/company-response.dto';
import { CompaniesService } from './companies.service';

@ApiTags('Empresas')
@ApiCookieAuth('fm_access_token')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('companies.read')
@Controller('empresas')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get()
  @ApiOperation({ summary: 'Lista empresas do snapshot local do pedagogico' })
  @ApiOkResponse({ type: CompaniesPageDto })
  async list(
    @Query() query: QueryCompaniesDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.companiesService.list(query, user.id, getRequestId(request));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalha empresa do snapshot local do pedagogico' })
  @ApiOkResponse({ type: CompanyDetailDto })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.companiesService.findOne(id, user.id, getRequestId(request));
  }
}
