import { ApiPropertyOptional } from '@nestjs/swagger';
import type { UnlockUserRequest } from '@financial-martec/contracts';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UnlockUserDto implements UnlockUserRequest {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(240)
  note?: string;
}
