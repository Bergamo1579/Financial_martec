import { ApiProperty } from '@nestjs/swagger';
import type { AdminResetPasswordRequest } from '@financial-martec/contracts';
import { IsString, MinLength } from 'class-validator';

export class AdminResetPasswordDto implements AdminResetPasswordRequest {
  @ApiProperty()
  @IsString()
  @MinLength(8)
  temporaryPassword!: string;
}
