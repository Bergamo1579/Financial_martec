import { ApiProperty } from '@nestjs/swagger';
import type {
  CompanyDetail,
  CompanyListItem,
  PaginatedResponse,
} from '@financial-martec/contracts';

export class CompanyListItemDto implements CompanyListItem {
  @ApiProperty()
  sourceId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ nullable: true })
  legalName!: string | null;

  @ApiProperty({ nullable: true })
  taxId!: string | null;

  @ApiProperty({ nullable: true })
  email!: string | null;

  @ApiProperty({ nullable: true })
  phone!: string | null;

  @ApiProperty({ nullable: true })
  sourceUpdatedAt!: string | null;

  @ApiProperty()
  lastSyncedAt!: string;
}

export class CompanyDetailDto extends CompanyListItemDto implements CompanyDetail {
  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}

export class CompaniesPageDto implements PaginatedResponse<CompanyListItemDto> {
  @ApiProperty({ type: CompanyListItemDto, isArray: true })
  items!: CompanyListItemDto[];

  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;

  @ApiProperty()
  total!: number;

  @ApiProperty()
  totalPages!: number;
}
