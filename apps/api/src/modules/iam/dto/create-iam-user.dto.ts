import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { CreateIamUserRequest } from '@financial-martec/contracts';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

const assignableStatuses = ['ACTIVE', 'INACTIVE'] as const;

function trimString(value: unknown) {
  return typeof value === 'string' ? value.trim() : value;
}

function normalizeEmail(value: unknown) {
  const trimmed = trimString(value);
  return typeof trimmed === 'string' ? trimmed.toLowerCase() : trimmed;
}

export class CreateIamUserDto implements CreateIamUserRequest {
  @ApiProperty()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty()
  @Transform(({ value }) => normalizeEmail(value))
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ type: String, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @Matches(/^[a-z0-9._-]+$/i, { each: true })
  roles!: string[];

  @ApiPropertyOptional({ enum: assignableStatuses })
  @IsOptional()
  @IsIn(assignableStatuses)
  status?: 'ACTIVE' | 'INACTIVE';
}
