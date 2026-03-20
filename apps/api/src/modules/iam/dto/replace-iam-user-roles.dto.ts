import { ApiProperty } from '@nestjs/swagger';
import type { ReplaceIamUserRolesRequest } from '@financial-martec/contracts';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsString,
  Matches,
} from 'class-validator';

export class ReplaceIamUserRolesDto implements ReplaceIamUserRolesRequest {
  @ApiProperty({ type: String, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @Matches(/^[a-z0-9._-]+$/i, { each: true })
  roles!: string[];
}
