import { ApiPropertyOptional } from '@nestjs/swagger';
import type { QueryAppCompaniesRequest } from '@financial-martec/contracts';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { PageQueryDto } from '@/common/dto/page-query.dto';
import { toBoolean, trimString } from './transforms';

export class QueryAppCompaniesDto extends PageQueryDto implements QueryAppCompaniesRequest {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  hasOpenIndicacoes?: boolean;
}
