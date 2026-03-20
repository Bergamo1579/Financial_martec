import { ApiPropertyOptional } from '@nestjs/swagger';
import type { RoleScope, UpdateRoleRequest } from '@financial-martec/contracts';
import { roleScopes } from '@financial-martec/contracts';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

function trimString(value: unknown) {
  return typeof value === 'string' ? value.trim() : value;
}

export class UpdateRoleDto implements UpdateRoleRequest {
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

  @ApiPropertyOptional({ enum: roleScopes })
  @IsOptional()
  @IsIn(roleScopes)
  scope?: RoleScope;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
