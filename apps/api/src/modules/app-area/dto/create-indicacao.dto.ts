import { ApiProperty } from '@nestjs/swagger';
import type { CreateIndicacaoRequest } from '@financial-martec/contracts';
import { Transform } from 'class-transformer';
import { IsString } from 'class-validator';
import { trimString } from './transforms';

export class CreateIndicacaoDto implements CreateIndicacaoRequest {
  @ApiProperty()
  @Transform(({ value }) => trimString(value))
  @IsString()
  empresaSourceId!: string;
}
