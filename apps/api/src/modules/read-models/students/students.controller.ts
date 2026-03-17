import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import type { AuthenticatedUser } from '@/modules/auth/auth.types';
import { QueryStudentsDto } from '@/modules/integration/pedagogical/dto/query-students.dto';
import { StudentsService } from './students.service';

@ApiTags('Alunos')
@ApiCookieAuth('fm_access_token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('owner', 'admin_financeiro', 'analista_financeiro', 'auditor')
@Controller('alunos')
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Get()
  @ApiOperation({ summary: 'Lista alunos sincronizados do pedagógico' })
  async list(
    @Query() query: QueryStudentsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.studentsService.list(query, user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalha aluno sincronizado do pedagógico' })
  async findOne(
    @Param('id') id: string,
    @Query('forceRefresh') forceRefresh: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.studentsService.findOne(id, user.id, forceRefresh === 'true');
  }
}
