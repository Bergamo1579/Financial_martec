import { ApiPropertyOptional } from '@nestjs/swagger';
import type { PermissionScope, UpdatePermissionRequest } from '@financial-martec/contracts';
import { permissionScopes } from '@financial-martec/contracts';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

function trimString(value: unknown) {
  return typeof value === 'string' ? value.trim() : value;
}

export class UpdatePermissionDto implements UpdatePermissionRequest {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(3)
  @Matches(/^[a-z0-9._-]+$/i)
  name?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(({ value }) => (value === null ? null : trimString(value)))
  @IsString()
  @MaxLength(240)
  description?: string | null;

  @ApiPropertyOptional({ enum: permissionScopes })
  @IsOptional()
  @IsIn(permissionScopes)
  scope?: PermissionScope;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
