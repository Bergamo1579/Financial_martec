import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Permissions } from '@/common/decorators/permissions.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { getRequestId } from '@/common/lib/request.util';
import type { AuthenticatedUser } from '@/modules/auth/auth.types';
import { QueryStudentsDto } from '@/modules/integration/pedagogical/dto/query-students.dto';
import { StudentDetailDto, StudentsPageDto } from './dto/student-response.dto';
import { StudentsService } from './students.service';

@ApiTags('Alunos')
@ApiCookieAuth('fm_access_token')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('students.read')
@Controller('alunos')
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Get()
  @ApiOperation({ summary: 'Lista alunos do snapshot local do pedagogico' })
  @ApiOkResponse({ type: StudentsPageDto })
  async list(
    @Query() query: QueryStudentsDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.studentsService.list(query, user.id, getRequestId(request));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalha aluno do snapshot local do pedagogico' })
  @ApiOkResponse({ type: StudentDetailDto })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.studentsService.findOne(id, user.id, getRequestId(request));
  }
}
