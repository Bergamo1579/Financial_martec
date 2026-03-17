import {
  Body,
  Controller,
  Get,
  HttpCode,
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
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from './auth.types';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Autentica usuário interno do backoffice' })
  @ApiOkResponse({ description: 'Sessão autenticada com cookies httpOnly' })
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
  @ApiOperation({ summary: 'Encerra a sessão atual' })
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.authService.logout(user);

    response.clearCookie(
      this.authService.getAccessCookieName(),
      this.authService.getAccessCookieConfig(),
    );
    response.clearCookie(
      this.authService.getRefreshCookieName(),
      this.authService.getRefreshCookieConfig(),
    );

    return {
      message: 'Sessão encerrada.',
    };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth('fm_access_token')
  @ApiOperation({ summary: 'Retorna o usuário autenticado' })
  async me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getMe(user);
  }
}
