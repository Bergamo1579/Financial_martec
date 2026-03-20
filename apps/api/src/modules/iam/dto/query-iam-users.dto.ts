import { ApiPropertyOptional } from '@nestjs/swagger';
import type { UserStatus } from '@financial-martec/contracts';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { PageQueryDto } from '@/common/dto/page-query.dto';

const userStatuses: UserStatus[] = ['ACTIVE', 'INACTIVE', 'LOCKED'];

function trimString(value: unknown) {
  return typeof value === 'string' ? value.trim() : value;
}

export class QueryIamUsersDto extends PageQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: userStatuses })
  @IsOptional()
  @IsIn(userStatuses)
  status?: UserStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  role?: string;
}
