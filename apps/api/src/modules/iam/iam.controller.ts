import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Permissions } from '@/common/decorators/permissions.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { getRequestId, getRequestIp } from '@/common/lib/request.util';
import type { AuthenticatedUser } from '@/modules/auth/auth.types';
import { CreateIamUserDto } from './dto/create-iam-user.dto';
import {
  IamPermissionItemDto,
  IamRoleItemDto,
  IamUserDetailDto,
  IamUsersPageDto,
} from './dto/iam-response.dto';
import { QueryIamUsersDto } from './dto/query-iam-users.dto';
import { ReplaceIamUserRolesDto } from './dto/replace-iam-user-roles.dto';
import { UpdateIamUserStatusDto } from './dto/update-iam-user-status.dto';
import { IamService } from './iam.service';

@ApiTags('IAM')
@ApiCookieAuth('fm_access_token')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('iam')
export class IamController {
  constructor(private readonly iamService: IamService) {}

  @Get('roles')
  @Permissions('iam.roles.read')
  @ApiOperation({ summary: 'Lista perfis internos e suas permissoes efetivas' })
  @ApiOkResponse({ type: IamRoleItemDto, isArray: true })
  listRoles() {
    return this.iamService.listRoles();
  }

  @Get('permissions')
  @Permissions('iam.roles.read')
  @ApiOperation({ summary: 'Lista o catalogo de permissoes internas' })
  @ApiOkResponse({ type: IamPermissionItemDto, isArray: true })
  listPermissions() {
    return this.iamService.listPermissions();
  }

  @Get('users')
  @Permissions('iam.users.read')
  @ApiOperation({ summary: 'Lista usuarios internos com filtros basicos' })
  @ApiOkResponse({ type: IamUsersPageDto })
  listUsers(@Query() query: QueryIamUsersDto) {
    return this.iamService.listUsers(query);
  }

  @Get('users/:id')
  @Permissions('iam.users.read')
  @ApiOperation({ summary: 'Detalha um usuario interno' })
  @ApiOkResponse({ type: IamUserDetailDto })
  getUser(@Param('id') id: string) {
    return this.iamService.getUser(id);
  }

  @Post('users')
  @Permissions('iam.users.manage')
  @ApiOperation({ summary: 'Cria um novo usuario interno com perfis iniciais' })
  @ApiOkResponse({ type: IamUserDetailDto })
  createUser(
    @Body() dto: CreateIamUserDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.iamService.createUser(dto, user.id, getRequestId(request), getRequestIp(request));
  }

  @Patch('users/:id/status')
  @Permissions('iam.users.manage')
  @ApiOperation({ summary: 'Ativa ou inativa um usuario interno' })
  @ApiOkResponse({ type: IamUserDetailDto })
  updateUserStatus(
    @Param('id') id: string,
    @Body() dto: UpdateIamUserStatusDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.iamService.updateUserStatus(
      id,
      dto,
      user.id,
      getRequestId(request),
      getRequestIp(request),
    );
  }

  @Put('users/:id/roles')
  @Permissions('iam.users.manage')
  @ApiOperation({ summary: 'Substitui os perfis atribuídos a um usuario interno' })
  @ApiOkResponse({ type: IamUserDetailDto })
  replaceUserRoles(
    @Param('id') id: string,
    @Body() dto: ReplaceIamUserRolesDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.iamService.replaceUserRoles(
      id,
      dto,
      user.id,
      getRequestId(request),
      getRequestIp(request),
    );
  }
}
