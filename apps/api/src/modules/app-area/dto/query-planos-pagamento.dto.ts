import { ApiPropertyOptional } from '@nestjs/swagger';
import type { QueryPlanosPagamentoRequest } from '@financial-martec/contracts';
import { planoPagamentoStatuses } from '@financial-martec/contracts';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { PageQueryDto } from '@/common/dto/page-query.dto';
import { trimString } from './transforms';

export class QueryPlanosPagamentoDto extends PageQueryDto implements QueryPlanosPagamentoRequest {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: planoPagamentoStatuses })
  @IsOptional()
  @IsIn(planoPagamentoStatuses)
  status?: (typeof planoPagamentoStatuses)[number];
}
