import { ApiProperty } from '@nestjs/swagger';
import type { UpdateIamUserStatusRequest } from '@financial-martec/contracts';
import { IsIn } from 'class-validator';

const assignableStatuses = ['ACTIVE', 'INACTIVE'] as const;

export class UpdateIamUserStatusDto implements UpdateIamUserStatusRequest {
  @ApiProperty({ enum: assignableStatuses })
  @IsIn(assignableStatuses)
  status!: 'ACTIVE' | 'INACTIVE';
}
