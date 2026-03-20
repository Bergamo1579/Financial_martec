import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
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
import { getRequestId, getRequestIp } from '@/common/lib/request.util';
import type { AuthenticatedUser } from '@/modules/auth/auth.types';
import {
  PlanoPagamentoDetailDto,
  PlanosPagamentoPageDto,
} from './dto/app-area-response.dto';
import { AppPlanosPagamentoService } from './planos-pagamento.service';
import { CreatePlanoPagamentoDto } from './dto/create-plano-pagamento.dto';
import { QueryPlanosPagamentoDto } from './dto/query-planos-pagamento.dto';
import { UpdatePlanoPagamentoDto } from './dto/update-plano-pagamento.dto';

@ApiTags('App Planos de Pagamento')
@ApiCookieAuth('fm_access_token')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('app/planos-pagamento')
export class AppPlanosPagamentoController {
  constructor(private readonly planosPagamentoService: AppPlanosPagamentoService) {}

  @Get()
  @Permissions('app.planos-pagamento.view')
  @ApiOperation({ summary: 'Lista planos de pagamento locais' })
  @ApiOkResponse({ type: PlanosPagamentoPageDto })
  list(
    @Query() query: QueryPlanosPagamentoDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.planosPagamentoService.list(query, user.id, getRequestId(request));
  }

  @Post()
  @Permissions('app.planos-pagamento.manage')
  @ApiOperation({ summary: 'Cria plano de pagamento local' })
  @ApiOkResponse({ type: PlanoPagamentoDetailDto })
  create(
    @Body() dto: CreatePlanoPagamentoDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.planosPagamentoService.create(
      dto,
      user.id,
      getRequestId(request),
      getRequestIp(request),
    );
  }

  @Get(':id')
  @Permissions('app.planos-pagamento.view')
  @ApiOperation({ summary: 'Detalha plano de pagamento local' })
  @ApiOkResponse({ type: PlanoPagamentoDetailDto })
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.planosPagamentoService.findOne(id, user.id, getRequestId(request));
  }

  @Patch(':id')
  @Permissions('app.planos-pagamento.manage')
  @ApiOperation({ summary: 'Atualiza plano de pagamento local' })
  @ApiOkResponse({ type: PlanoPagamentoDetailDto })
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePlanoPagamentoDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.planosPagamentoService.update(
      id,
      dto,
      user.id,
      getRequestId(request),
      getRequestIp(request),
    );
  }
}
