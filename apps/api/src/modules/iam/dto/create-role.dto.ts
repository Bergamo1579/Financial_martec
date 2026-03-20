import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { CreateRoleRequest, RoleScope } from '@financial-martec/contracts';
import { roleScopes } from '@financial-martec/contracts';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

function trimString(value: unknown) {
  return typeof value === 'string' ? value.trim() : value;
}

export class CreateRoleDto implements CreateRoleRequest {
  @ApiProperty()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(3)
  @Matches(/^[a-z0-9._-]+$/i)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(240)
  description?: string;

  @ApiProperty({ enum: roleScopes })
  @IsIn(roleScopes)
  scope!: RoleScope;
}
