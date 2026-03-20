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
import { MessageResponseDto } from '@/modules/auth/dto/auth-response.dto';
import { AdminResetPasswordDto } from './dto/admin-reset-password.dto';
import { CreateIamUserDto } from './dto/create-iam-user.dto';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { CreateRoleDto } from './dto/create-role.dto';
import {
  AppScreenItemDto,
  IamPermissionItemDto,
  IamRoleItemDto,
  IamUserDetailDto,
  IamUsersPageDto,
  PermissionDetailDto,
  RoleDetailDto,
} from './dto/iam-response.dto';
import { QueryIamUsersDto } from './dto/query-iam-users.dto';
import { ReplaceIamUserRolesDto } from './dto/replace-iam-user-roles.dto';
import { ReplacePermissionScreensDto } from './dto/replace-permission-screens.dto';
import { ReplaceRolePermissionsDto } from './dto/replace-role-permissions.dto';
import { UnlockUserDto } from './dto/unlock-user.dto';
import { UpdateIamUserStatusDto } from './dto/update-iam-user-status.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import { IamService } from './iam.service';

@ApiTags('IAM')
@ApiCookieAuth('fm_access_token')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('iam')
export class IamController {
  constructor(private readonly iamService: IamService) {}

  @Get('roles')
  @Permissions('iam.roles.read')
  @ApiOperation({ summary: 'Lista roles administrativas e de aplicacao' })
  @ApiOkResponse({ type: IamRoleItemDto, isArray: true })
  listRoles() {
    return this.iamService.listRoles();
  }

  @Get('roles/:id')
  @Permissions('iam.roles.read')
  @ApiOperation({ summary: 'Detalha uma role' })
  @ApiOkResponse({ type: RoleDetailDto })
  getRole(@Param('id') id: string) {
    return this.iamService.getRole(id);
  }

  @Post('roles')
  @Permissions('iam.roles.manage')
  @ApiOperation({ summary: 'Cria uma nova role' })
  @ApiOkResponse({ type: RoleDetailDto })
  createRole(
    @Body() dto: CreateRoleDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.iamService.createRole(dto, user.id, getRequestId(request), getRequestIp(request));
  }

  @Patch('roles/:id')
  @Permissions('iam.roles.manage')
  @ApiOperation({ summary: 'Atualiza uma role existente' })
  @ApiOkResponse({ type: RoleDetailDto })
  updateRole(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.iamService.updateRole(id, dto, user.id, getRequestId(request), getRequestIp(request));
  }

  @Put('roles/:id/permissions')
  @Permissions('iam.roles.manage')
  @ApiOperation({ summary: 'Substitui as permissoes de uma role' })
  @ApiOkResponse({ type: RoleDetailDto })
  replaceRolePermissions(
    @Param('id') id: string,
    @Body() dto: ReplaceRolePermissionsDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.iamService.replaceRolePermissions(
      id,
      dto,
      user.id,
      getRequestId(request),
      getRequestIp(request),
    );
  }

  @Get('permissions')
  @Permissions('iam.permissions.read')
  @ApiOperation({ summary: 'Lista o catalogo de permissoes' })
  @ApiOkResponse({ type: IamPermissionItemDto, isArray: true })
  listPermissions() {
    return this.iamService.listPermissions();
  }

  @Get('permissions/:id')
  @Permissions('iam.permissions.read')
  @ApiOperation({ summary: 'Detalha uma permissao' })
  @ApiOkResponse({ type: PermissionDetailDto })
  getPermission(@Param('id') id: string) {
    return this.iamService.getPermission(id);
  }

  @Post('permissions')
  @Permissions('iam.permissions.manage')
  @ApiOperation({ summary: 'Cria uma nova permissao' })
  @ApiOkResponse({ type: PermissionDetailDto })
  createPermission(
    @Body() dto: CreatePermissionDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.iamService.createPermission(
      dto,
      user.id,
      getRequestId(request),
      getRequestIp(request),
    );
  }

  @Patch('permissions/:id')
  @Permissions('iam.permissions.manage')
  @ApiOperation({ summary: 'Atualiza uma permissao existente' })
  @ApiOkResponse({ type: PermissionDetailDto })
  updatePermission(
    @Param('id') id: string,
    @Body() dto: UpdatePermissionDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.iamService.updatePermission(
      id,
      dto,
      user.id,
      getRequestId(request),
      getRequestIp(request),
    );
  }

  @Put('permissions/:id/screens')
  @Permissions('iam.permissions.manage')
  @ApiOperation({ summary: 'Substitui o mapa de telas associado a uma permissao' })
  @ApiOkResponse({ type: PermissionDetailDto })
  replacePermissionScreens(
    @Param('id') id: string,
    @Body() dto: ReplacePermissionScreensDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.iamService.replacePermissionScreens(
      id,
      dto,
      user.id,
      getRequestId(request),
      getRequestIp(request),
    );
  }

  @Get('screens')
  @Permissions('iam.permissions.read')
  @ApiOperation({ summary: 'Lista o catalogo de telas registradas pelo sistema' })
  @ApiOkResponse({ type: AppScreenItemDto, isArray: true })
  listScreens() {
    return this.iamService.listScreens();
  }

  @Get('users')
  @Permissions('iam.users.read')
  @ApiOperation({ summary: 'Lista usuarios com filtros basicos' })
  @ApiOkResponse({ type: IamUsersPageDto })
  listUsers(@Query() query: QueryIamUsersDto) {
    return this.iamService.listUsers(query);
  }

  @Get('users/:id')
  @Permissions('iam.users.read')
  @ApiOperation({ summary: 'Detalha um usuario' })
  @ApiOkResponse({ type: IamUserDetailDto })
  getUser(@Param('id') id: string) {
    return this.iamService.getUser(id);
  }

  @Post('users')
  @Permissions('iam.users.manage')
  @ApiOperation({ summary: 'Cria um novo usuario' })
  @ApiOkResponse({ type: IamUserDetailDto })
  createUser(
    @Body() dto: CreateIamUserDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.iamService.createUser(dto, user.id, getRequestId(request), getRequestIp(request));
  }

  @Patch('users/:id')
  @Permissions('iam.users.manage')
  @ApiOperation({ summary: 'Atualiza dados basicos de um usuario' })
  @ApiOkResponse({ type: IamUserDetailDto })
  updateUser(
    @Param('id') id: string,
    @Body() dto: UpdateUserProfileDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.iamService.updateUser(id, dto, user.id, getRequestId(request), getRequestIp(request));
  }

  @Patch('users/:id/status')
  @Permissions('iam.users.manage')
  @ApiOperation({ summary: 'Ativa ou inativa um usuario' })
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

  @Patch('users/:id/lock')
  @Permissions('iam.users.manage')
  @ApiOperation({ summary: 'Bloqueia manualmente um usuario e revoga suas sessoes' })
  @ApiOkResponse({ type: IamUserDetailDto })
  lockUser(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.iamService.lockUser(id, user.id, getRequestId(request), getRequestIp(request));
  }

  @Patch('users/:id/unlock')
  @Permissions('iam.users.manage')
  @ApiOperation({ summary: 'Desbloqueia um usuario' })
  @ApiOkResponse({ type: IamUserDetailDto })
  unlockUser(
    @Param('id') id: string,
    @Body() dto: UnlockUserDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.iamService.unlockUser(
      id,
      dto,
      user.id,
      getRequestId(request),
      getRequestIp(request),
    );
  }

  @Post('users/:id/reset-password')
  @Permissions('iam.users.manage')
  @ApiOperation({ summary: 'Redefine a senha temporaria de um usuario' })
  @ApiOkResponse({ type: MessageResponseDto })
  resetPassword(
    @Param('id') id: string,
    @Body() dto: AdminResetPasswordDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.iamService.resetUserPassword(
      id,
      dto,
      user.id,
      getRequestId(request),
      getRequestIp(request),
    );
  }

  @Put('users/:id/roles')
  @Permissions('iam.users.manage')
  @ApiOperation({ summary: 'Substitui as roles atribuidas a um usuario' })
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
