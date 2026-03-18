import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { ApiError } from '@financial-martec/contracts';

export class ApiErrorDto implements ApiError {
  @ApiProperty()
  code!: string;

  @ApiProperty()
  message!: string;

  @ApiPropertyOptional()
  details?: unknown;
}
