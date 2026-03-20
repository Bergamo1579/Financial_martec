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
  AppMatriculaDetailDto,
  AppMatriculasPageDto,
} from './dto/app-area-response.dto';
import { QueryAppMatriculasDto } from './dto/query-app-matriculas.dto';
import { AppMatriculasService } from './matriculas.service';

@ApiTags('App Matriculas')
@ApiCookieAuth('fm_access_token')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('app.matriculas.view')
@Controller('app/matriculas')
export class AppMatriculasController {
  constructor(private readonly matriculasService: AppMatriculasService) {}

  @Get()
  @ApiOperation({ summary: 'Lista matriculas read-only compostas a partir do snapshot pedagogico' })
  @ApiOkResponse({ type: AppMatriculasPageDto })
  list(
    @Query() query: QueryAppMatriculasDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.matriculasService.list(query, user.id, getRequestId(request));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalha uma matricula do snapshot pedagogico' })
  @ApiOkResponse({ type: AppMatriculaDetailDto })
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.matriculasService.findOne(id, user.id, getRequestId(request));
  }
}
