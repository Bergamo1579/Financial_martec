import { ApiPropertyOptional } from '@nestjs/swagger';
import type { UpdatePlanoPagamentoRequest } from '@financial-martec/contracts';
import { planoPagamentoStatuses } from '@financial-martec/contracts';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { toNumber, trimString } from './transforms';

export class UpdatePlanoPagamentoDto implements UpdatePlanoPagamentoRequest {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  nome?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => toNumber(value))
  @IsNumber()
  @Min(0.01)
  valorTotal?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => toNumber(value))
  @IsInt()
  @Min(1)
  quantidadeMeses?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => toNumber(value))
  @IsInt()
  @Min(1)
  @Max(31)
  diaVencimento?: number;

  @ApiPropertyOptional({ enum: planoPagamentoStatuses })
  @IsOptional()
  @IsIn(planoPagamentoStatuses)
  status?: (typeof planoPagamentoStatuses)[number];
}
