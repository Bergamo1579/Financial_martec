import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { getRequestId } from '@/common/lib/request.util';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from './auth.types';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import {
  AuthPayloadDto,
  AuthUserDto,
  MessageResponseDto,
  SessionItemDto,
} from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Autentica usuario interno do backoffice' })
  @ApiOkResponse({
    description: 'Sessao autenticada com cookies httpOnly',
    type: AuthPayloadDto,
  })
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const auth = await this.authService.login(dto, request);

    response.cookie(
      this.authService.getAccessCookieName(),
      auth.accessToken,
      this.authService.getAccessCookieConfig(),
    );
    response.cookie(
      this.authService.getRefreshCookieName(),
      auth.refreshToken,
      this.authService.getRefreshCookieConfig(),
    );

    return {
      user: auth.user,
    };
  }

  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Rotaciona refresh token e emite novo access token' })
  @ApiOkResponse({ type: AuthPayloadDto })
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const auth = await this.authService.refresh(
      request.cookies?.fm_refresh_token as string | undefined,
      request,
    );

    response.cookie(
      this.authService.getAccessCookieName(),
      auth.accessToken,
      this.authService.getAccessCookieConfig(),
    );
    response.cookie(
      this.authService.getRefreshCookieName(),
      auth.refreshToken,
      this.authService.getRefreshCookieConfig(),
    );

    return {
      user: auth.user,
    };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  @ApiCookieAuth('fm_access_token')
  @ApiOperation({ summary: 'Encerra a sessao atual' })
  @ApiOkResponse({ type: MessageResponseDto })
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.authService.logout(user, getRequestId(request));
    this.clearAuthCookies(response);

    return {
      message: 'Sessao encerrada.',
    };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth('fm_access_token')
  @ApiOperation({ summary: 'Retorna o usuario autenticado' })
  @ApiOkResponse({ type: AuthUserDto })
  async me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getMe(user);
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth('fm_access_token')
  @ApiOperation({ summary: 'Lista as sessoes do usuario autenticado' })
  @ApiOkResponse({ type: SessionItemDto, isArray: true })
  async listSessions(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.listSessions(user);
  }

  @Delete('sessions/:sessionId')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth('fm_access_token')
  @ApiOperation({ summary: 'Revoga uma sessao especifica do usuario autenticado' })
  @ApiOkResponse({ type: MessageResponseDto })
  async revokeSession(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (sessionId === user.sessionId) {
      await this.authService.logout(user, getRequestId(request));
      this.clearAuthCookies(response);

      return {
        message: 'Sessao encerrada.',
      };
    }

    await this.authService.revokeSession(user, sessionId, getRequestId(request));

    return {
      message: 'Sessao revogada.',
    };
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  @ApiCookieAuth('fm_access_token')
  @ApiOperation({ summary: 'Troca a senha atual e revoga as outras sessoes do usuario' })
  @ApiOkResponse({ type: MessageResponseDto })
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
    @Req() request: Request,
  ) {
    return this.authService.changePassword(user, dto, request);
  }

  private clearAuthCookies(response: Response) {
    response.clearCookie(
      this.authService.getAccessCookieName(),
      this.authService.getAccessCookieConfig(),
    );
    response.clearCookie(
      this.authService.getRefreshCookieName(),
      this.authService.getRefreshCookieConfig(),
    );
  }
}
