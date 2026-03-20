import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import {
  ApiCookieAuth,
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
import {
  AppCompaniesPageDto,
  AppCompanyDetailDto,
  AppCompanyIndicacaoItemDto,
  AppMatriculasPageDto,
} from './dto/app-area-response.dto';
import { AppCompaniesService } from './companies.service';
import { QueryAppCompaniesDto } from './dto/query-app-companies.dto';
import { QueryAppMatriculasDto } from './dto/query-app-matriculas.dto';

@ApiTags('App Empresas')
@ApiCookieAuth('fm_access_token')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('app.empresas.view')
@Controller('app/empresas')
export class AppCompaniesController {
  constructor(private readonly companiesService: AppCompaniesService) {}

  @Get()
  @ApiOperation({ summary: 'Lista empresas do snapshot local da area comum' })
  @ApiOkResponse({ type: AppCompaniesPageDto })
  list(
    @Query() query: QueryAppCompaniesDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.companiesService.list(query, user.id, getRequestId(request));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalha empresa do snapshot local da area comum' })
  @ApiOkResponse({ type: AppCompanyDetailDto })
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.companiesService.findOne(id, user.id, getRequestId(request));
  }

  @Get(':id/matriculados')
  @ApiOperation({ summary: 'Lista matriculados vinculados a empresa no snapshot atual' })
  @ApiOkResponse({ type: AppMatriculasPageDto })
  listMatriculados(
    @Param('id') id: string,
    @Query() query: QueryAppMatriculasDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.companiesService.listMatriculados(id, query, user.id, getRequestId(request));
  }

  @Get(':id/indicacoes')
  @ApiOperation({ summary: 'Lista indicacoes locais da empresa' })
  @ApiOkResponse({ type: AppCompanyIndicacaoItemDto, isArray: true })
  listIndicacoes(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.companiesService.listIndicacoes(id, user.id, getRequestId(request));
  }
}
