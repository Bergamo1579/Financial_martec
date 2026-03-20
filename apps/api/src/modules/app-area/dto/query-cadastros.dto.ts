import { ApiPropertyOptional } from '@nestjs/swagger';
import type { QueryCadastrosRequest } from '@financial-martec/contracts';
import { cadastroStatuses, studyPeriods } from '@financial-martec/contracts';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';
import { PageQueryDto } from '@/common/dto/page-query.dto';
import { toBoolean, trimString } from './transforms';

export class QueryCadastrosDto extends PageQueryDto implements QueryCadastrosRequest {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: cadastroStatuses })
  @IsOptional()
  @IsIn(cadastroStatuses)
  status?: (typeof cadastroStatuses)[number];

  @ApiPropertyOptional({ enum: studyPeriods })
  @IsOptional()
  @IsIn(studyPeriods)
  periodoEstudo?: (typeof studyPeriods)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  includeDeleted?: boolean;
}
