import { ApiProperty } from '@nestjs/swagger';
import type { AppRole, ReplaceIamUserRolesRequest } from '@financial-martec/contracts';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn } from 'class-validator';

const appRoles: AppRole[] = ['owner', 'admin_financeiro', 'analista_financeiro', 'auditor'];

export class ReplaceIamUserRolesDto implements ReplaceIamUserRolesRequest {
  @ApiProperty({ enum: appRoles, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(4)
  @IsIn(appRoles, { each: true })
  roles!: AppRole[];
}
