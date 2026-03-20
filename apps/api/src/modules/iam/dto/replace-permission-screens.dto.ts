import { ApiProperty } from '@nestjs/swagger';
import type { ReplacePermissionScreensRequest } from '@financial-martec/contracts';
import { ArrayMaxSize, IsArray, IsString } from 'class-validator';

export class ReplacePermissionScreensDto implements ReplacePermissionScreensRequest {
  @ApiProperty({ type: String, isArray: true })
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  screens!: string[];
}
