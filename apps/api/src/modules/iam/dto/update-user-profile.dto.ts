import { ApiProperty } from '@nestjs/swagger';
import type { UpdateUserProfileRequest } from '@financial-martec/contracts';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, MinLength } from 'class-validator';

function trimString(value: unknown) {
  return typeof value === 'string' ? value.trim() : value;
}

function normalizeEmail(value: unknown) {
  const trimmed = trimString(value);
  return typeof trimmed === 'string' ? trimmed.toLowerCase() : trimmed;
}

export class UpdateUserProfileDto implements UpdateUserProfileRequest {
  @ApiProperty()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty()
  @Transform(({ value }) => normalizeEmail(value))
  @IsEmail()
  email!: string;
}
