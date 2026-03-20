import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { CreatePlanoPagamentoRequest } from '@financial-martec/contracts';
import { planoPagamentoStatuses } from '@financial-martec/contracts';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { toNumber, trimString } from './transforms';

export class CreatePlanoPagamentoDto implements CreatePlanoPagamentoRequest {
  @ApiProperty()
  @Transform(({ value }) => trimString(value))
  @IsString()
  nome!: string;

  @ApiProperty()
  @Transform(({ value }) => toNumber(value))
  @IsNumber()
  @Min(0.01)
  valorTotal!: number;

  @ApiProperty()
  @Transform(({ value }) => toNumber(value))
  @IsInt()
  @Min(1)
  quantidadeMeses!: number;

  @ApiProperty()
  @Transform(({ value }) => toNumber(value))
  @IsInt()
  @Min(1)
  @Max(31)
  diaVencimento!: number;

  @ApiPropertyOptional({ enum: planoPagamentoStatuses })
  @IsOptional()
  @IsIn(planoPagamentoStatuses)
  status?: (typeof planoPagamentoStatuses)[number];
}
