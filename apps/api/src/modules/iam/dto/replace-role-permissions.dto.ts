import { ApiProperty } from '@nestjs/swagger';
import type { ReplaceRolePermissionsRequest } from '@financial-martec/contracts';
import {
  ArrayMaxSize,
  IsArray,
  IsString,
  Matches,
} from 'class-validator';

export class ReplaceRolePermissionsDto implements ReplaceRolePermissionsRequest {
  @ApiProperty({ type: String, isArray: true })
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @Matches(/^[a-z0-9._-]+$/i, { each: true })
  permissions!: string[];
}
