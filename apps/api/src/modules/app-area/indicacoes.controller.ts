import { Controller, Param, Patch, Req, UseGuards } from '@nestjs/common';
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
import { AppCadastrosService } from './cadastros.service';
import { IndicacaoItemDto } from './dto/app-area-response.dto';

@ApiTags('App Indicacoes')
@ApiCookieAuth('fm_access_token')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('app.empresas.manage-indicacoes')
@Controller('app/indicacoes')
export class AppIndicacoesController {
  constructor(private readonly cadastrosService: AppCadastrosService) {}

  @Patch(':id/accept')
  @ApiOperation({ summary: 'Marca uma indicacao como aceita' })
  @ApiOkResponse({ type: IndicacaoItemDto })
  accept(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.cadastrosService.acceptIndicacao(
      id,
      user.id,
      getRequestId(request),
      getRequestIp(request),
    );
  }

  @Patch(':id/reject')
  @ApiOperation({ summary: 'Marca uma indicacao como recusada' })
  @ApiOkResponse({ type: IndicacaoItemDto })
  reject(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.cadastrosService.rejectIndicacao(
      id,
      user.id,
      getRequestId(request),
      getRequestIp(request),
    );
  }

  @Patch(':id/contract')
  @ApiOperation({ summary: 'Marca uma indicacao como contrato gerado e encerra as demais abertas' })
  @ApiOkResponse({ type: IndicacaoItemDto })
  contract(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.cadastrosService.contractIndicacao(
      id,
      user.id,
      getRequestId(request),
      getRequestIp(request),
    );
  }
}
