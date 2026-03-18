import { ApiProperty } from '@nestjs/swagger';
import type {
  PaginatedResponse,
  StudentCompanySummary,
  StudentDetail,
  StudentListItem,
} from '@financial-martec/contracts';

export class StudentCompanySummaryDto implements StudentCompanySummary {
  @ApiProperty()
  sourceId!: string;

  @ApiProperty()
  name!: string;
}

export class StudentListItemDto implements StudentListItem {
  @ApiProperty()
  sourceId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  cpf!: string;

  @ApiProperty({ nullable: true })
  email!: string | null;

  @ApiProperty({ nullable: true })
  birthDate!: string | null;

  @ApiProperty({ nullable: true })
  sourceUpdatedAt!: string | null;

  @ApiProperty()
  lastSyncedAt!: string;

  @ApiProperty({ type: StudentCompanySummaryDto, nullable: true })
  company!: StudentCompanySummaryDto | null;
}

export class StudentDetailDto extends StudentListItemDto implements StudentDetail {
  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}

export class StudentsPageDto implements PaginatedResponse<StudentListItemDto> {
  @ApiProperty({ type: StudentListItemDto, isArray: true })
  items!: StudentListItemDto[];

  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;

  @ApiProperty()
  total!: number;

  @ApiProperty()
  totalPages!: number;
}
