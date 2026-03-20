import { ApiProperty } from '@nestjs/swagger';
import type { CreateCadastroRequest } from '@financial-martec/contracts';
import { studyPeriods } from '@financial-martec/contracts';
import { Transform } from 'class-transformer';
import { IsIn, IsString } from 'class-validator';
import { trimString } from './transforms';

export class CreateCadastroDto implements CreateCadastroRequest {
  @ApiProperty()
  @Transform(({ value }) => trimString(value))
  @IsString()
  nomeCompleto!: string;

  @ApiProperty()
  @Transform(({ value }) => trimString(value))
  @IsString()
  telefone!: string;

  @ApiProperty()
  @Transform(({ value }) => trimString(value))
  @IsString()
  cpf!: string;

  @ApiProperty()
  @Transform(({ value }) => trimString(value))
  @IsString()
  nomeResponsavel!: string;

  @ApiProperty({ enum: studyPeriods })
  @IsIn(studyPeriods)
  periodoEstudo!: (typeof studyPeriods)[number];
}
