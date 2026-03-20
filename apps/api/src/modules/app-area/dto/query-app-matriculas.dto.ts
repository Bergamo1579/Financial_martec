import { ApiPropertyOptional } from '@nestjs/swagger';
import type { QueryAppMatriculasRequest } from '@financial-martec/contracts';
import { Transform } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';
import { PageQueryDto } from '@/common/dto/page-query.dto';
import { trimString } from './transforms';

export class QueryAppMatriculasDto extends PageQueryDto implements QueryAppMatriculasRequest {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  empresaSourceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  turmaSourceId?: string;
}
