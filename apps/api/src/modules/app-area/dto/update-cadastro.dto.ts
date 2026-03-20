import { ApiPropertyOptional } from '@nestjs/swagger';
import type { UpdateCadastroRequest } from '@financial-martec/contracts';
import { studyPeriods } from '@financial-martec/contracts';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';
import { toBoolean, trimString } from './transforms';

export class UpdateCadastroDto implements UpdateCadastroRequest {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  nomeCompleto?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  telefone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  cpf?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  nomeResponsavel?: string;

  @ApiPropertyOptional({ enum: studyPeriods })
  @IsOptional()
  @IsIn(studyPeriods)
  periodoEstudo?: (typeof studyPeriods)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  archive?: boolean;
}
