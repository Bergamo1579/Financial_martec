import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { AppRole, CreateIamUserRequest } from '@financial-martec/contracts';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

const appRoles: AppRole[] = ['owner', 'admin_financeiro', 'analista_financeiro', 'auditor'];
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

  @ApiProperty({ enum: appRoles, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(4)
  @IsIn(appRoles, { each: true })
  roles!: AppRole[];

  @ApiPropertyOptional({ enum: assignableStatuses })
  @IsOptional()
  @IsIn(assignableStatuses)
  status?: 'ACTIVE' | 'INACTIVE';
}
