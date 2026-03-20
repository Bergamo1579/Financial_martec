import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
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
  CadastroDetailDto,
  CadastrosPageDto,
  IndicacaoItemDto,
} from './dto/app-area-response.dto';
import { AppCadastrosService } from './cadastros.service';
import { CreateCadastroDto } from './dto/create-cadastro.dto';
import { CreateIndicacaoDto } from './dto/create-indicacao.dto';
import { QueryCadastrosDto } from './dto/query-cadastros.dto';
import { UpdateCadastroDto } from './dto/update-cadastro.dto';

@ApiTags('App Cadastros')
@ApiCookieAuth('fm_access_token')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('app/cadastros')
export class AppCadastrosController {
  constructor(private readonly cadastrosService: AppCadastrosService) {}

  @Get()
  @Permissions('app.cadastros.view')
  @ApiOperation({ summary: 'Lista cadastros locais da area comum' })
  @ApiOkResponse({ type: CadastrosPageDto })
  list(
    @Query() query: QueryCadastrosDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.cadastrosService.list(query, user.id, getRequestId(request));
  }

  @Post()
  @Permissions('app.cadastros.manage')
  @ApiOperation({ summary: 'Cria um novo cadastro local' })
  @ApiOkResponse({ type: CadastroDetailDto })
  create(
    @Body() dto: CreateCadastroDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.cadastrosService.create(
      dto,
      user.id,
      getRequestId(request),
      getRequestIp(request),
    );
  }

  @Get(':id')
  @Permissions('app.cadastros.view')
  @ApiOperation({ summary: 'Detalha um cadastro local' })
  @ApiOkResponse({ type: CadastroDetailDto })
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.cadastrosService.findOne(id, user.id, getRequestId(request));
  }

  @Patch(':id')
  @Permissions('app.cadastros.manage')
  @ApiOperation({ summary: 'Atualiza um cadastro local ou executa arquivamento' })
  @ApiOkResponse({ type: CadastroDetailDto })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCadastroDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.cadastrosService.update(
      id,
      dto,
      user.id,
      getRequestId(request),
      getRequestIp(request),
    );
  }

  @Delete(':id')
  @Permissions('app.cadastros.manage')
  @ApiOperation({ summary: 'Executa soft delete em cadastro sem historico operacional' })
  @ApiOkResponse({ type: CadastroDetailDto })
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.cadastrosService.remove(
      id,
      user.id,
      getRequestId(request),
      getRequestIp(request),
    );
  }

  @Get(':id/indicacoes')
  @Permissions('app.cadastros.view')
  @ApiOperation({ summary: 'Lista historico de indicacoes de um cadastro' })
  @ApiOkResponse({ type: IndicacaoItemDto, isArray: true })
  listIndicacoes(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.cadastrosService.listIndicacoes(id, user.id, getRequestId(request));
  }

  @Post(':id/indicacoes')
  @Permissions('app.cadastros.manage')
  @ApiOperation({ summary: 'Cria uma nova indicacao para empresa do pedagogico' })
  @ApiOkResponse({ type: IndicacaoItemDto })
  createIndicacao(
    @Param('id') id: string,
    @Body() dto: CreateIndicacaoDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.cadastrosService.createIndicacao(
      id,
      dto,
      user.id,
      getRequestId(request),
      getRequestIp(request),
    );
  }
}
