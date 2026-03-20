import { ApiProperty } from '@nestjs/swagger';
import type {
  AppCompanyDetail,
  AppCompanyIndicacaoItem,
  AppCompanyListItem,
  AppMatriculaClassSummary,
  AppMatriculaCompanySummary,
  AppMatriculaDetail,
  AppMatriculaListItem,
  AppMatriculaUnitSummary,
  CadastroDetail,
  CadastroListItem,
  IndicacaoItem,
  PaginatedResponse,
  PlanoPagamentoDetail,
  PlanoPagamentoListItem,
} from '@financial-martec/contracts';
import {
  cadastroStatuses,
  indicacaoStatuses,
  matriculaSituacoes,
  planoPagamentoStatuses,
  studyPeriods,
} from '@financial-martec/contracts';

export class CadastroListItemDto implements CadastroListItem {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  nomeCompleto!: string;

  @ApiProperty()
  telefone!: string;

  @ApiProperty()
  cpf!: string;

  @ApiProperty()
  nomeResponsavel!: string;

  @ApiProperty({ enum: studyPeriods })
  periodoEstudo!: (typeof studyPeriods)[number];

  @ApiProperty({ enum: cadastroStatuses })
  status!: (typeof cadastroStatuses)[number];

  @ApiProperty({ nullable: true })
  deletedAt!: string | null;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;

  @ApiProperty()
  hasOperationalHistory!: boolean;

  @ApiProperty()
  canDelete!: boolean;

  @ApiProperty()
  canArchive!: boolean;
}

export class IndicacaoItemDto implements IndicacaoItem {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  cadastroId!: string;

  @ApiProperty()
  empresaSourceId!: string;

  @ApiProperty({ nullable: true })
  empresaNome!: string | null;

  @ApiProperty({ enum: indicacaoStatuses })
  status!: (typeof indicacaoStatuses)[number];

  @ApiProperty()
  sentAt!: string;

  @ApiProperty({ nullable: true })
  acceptedAt!: string | null;

  @ApiProperty({ nullable: true })
  rejectedAt!: string | null;

  @ApiProperty({ nullable: true })
  contractGeneratedAt!: string | null;

  @ApiProperty({ nullable: true })
  closedAt!: string | null;

  @ApiProperty({ nullable: true })
  closedReason!: string | null;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}

export class CadastroDetailDto extends CadastroListItemDto implements CadastroDetail {
  @ApiProperty({ nullable: true })
  pedagogicalStudentSourceId!: string | null;

  @ApiProperty({ type: IndicacaoItemDto, isArray: true })
  indicacoes!: IndicacaoItemDto[];
}

export class CadastrosPageDto implements PaginatedResponse<CadastroListItemDto> {
  @ApiProperty({ type: CadastroListItemDto, isArray: true })
  items!: CadastroListItemDto[];

  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;

  @ApiProperty()
  total!: number;

  @ApiProperty()
  totalPages!: number;
}

export class AppCompanyListItemDto implements AppCompanyListItem {
  @ApiProperty()
  id!: string;

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

  @ApiProperty()
  totalMatriculados!: number;

  @ApiProperty()
  totalIndicacoesAbertas!: number;

  @ApiProperty({ nullable: true })
  sourceUpdatedAt!: string | null;

  @ApiProperty()
  lastSyncedAt!: string;
}

export class AppCompanyIndicacaoItemDto implements AppCompanyIndicacaoItem {
  @ApiProperty()
  indicacaoId!: string;

  @ApiProperty()
  cadastroId!: string;

  @ApiProperty()
  cadastroNomeCompleto!: string;

  @ApiProperty()
  cadastroCpf!: string;

  @ApiProperty()
  empresaSourceId!: string;

  @ApiProperty({ enum: indicacaoStatuses })
  statusIndicacao!: (typeof indicacaoStatuses)[number];

  @ApiProperty({ enum: cadastroStatuses })
  statusCadastro!: (typeof cadastroStatuses)[number];

  @ApiProperty()
  sentAt!: string;

  @ApiProperty({ nullable: true })
  acceptedAt!: string | null;

  @ApiProperty({ nullable: true })
  rejectedAt!: string | null;

  @ApiProperty({ nullable: true })
  contractGeneratedAt!: string | null;

  @ApiProperty()
  updatedAt!: string;

  @ApiProperty({ nullable: true })
  closedAt!: string | null;

  @ApiProperty({ nullable: true })
  closedReason!: string | null;
}

export class AppCompanyDetailDto extends AppCompanyListItemDto implements AppCompanyDetail {
  @ApiProperty({ nullable: true })
  address!: string | null;

  @ApiProperty({ nullable: true })
  city!: string | null;

  @ApiProperty({ nullable: true })
  neighborhood!: string | null;

  @ApiProperty({ nullable: true })
  state!: string | null;

  @ApiProperty({ nullable: true })
  postalCode!: string | null;

  @ApiProperty({ nullable: true })
  representativeName!: string | null;

  @ApiProperty({ nullable: true })
  representativeRole!: string | null;

  @ApiProperty({ nullable: true })
  username!: string | null;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: {
      type: 'number',
    },
  })
  indicacoesPorStatus!: Partial<Record<(typeof indicacaoStatuses)[number], number>>;
}

export class AppCompaniesPageDto implements PaginatedResponse<AppCompanyListItemDto> {
  @ApiProperty({ type: AppCompanyListItemDto, isArray: true })
  items!: AppCompanyListItemDto[];

  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;

  @ApiProperty()
  total!: number;

  @ApiProperty()
  totalPages!: number;
}

export class AppMatriculaCompanySummaryDto implements AppMatriculaCompanySummary {
  @ApiProperty()
  sourceId!: string;

  @ApiProperty()
  name!: string;
}

export class AppMatriculaClassSummaryDto implements AppMatriculaClassSummary {
  @ApiProperty()
  sourceId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ nullable: true })
  description!: string | null;
}

export class AppMatriculaUnitSummaryDto implements AppMatriculaUnitSummary {
  @ApiProperty()
  sourceId!: string;

  @ApiProperty()
  name!: string;
}

export class AppMatriculaListItemDto implements AppMatriculaListItem {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  sourceId!: string;

  @ApiProperty()
  nome!: string;

  @ApiProperty()
  cpf!: string;

  @ApiProperty({ type: AppMatriculaCompanySummaryDto, nullable: true })
  empresa!: AppMatriculaCompanySummaryDto | null;

  @ApiProperty({ type: AppMatriculaClassSummaryDto, nullable: true })
  turma!: AppMatriculaClassSummaryDto | null;

  @ApiProperty({ type: AppMatriculaUnitSummaryDto, nullable: true })
  unidade!: AppMatriculaUnitSummaryDto | null;

  @ApiProperty({ enum: matriculaSituacoes })
  situacao!: (typeof matriculaSituacoes)[number];

  @ApiProperty()
  lastSyncedAt!: string;
}

export class AppMatriculaDetailDto extends AppMatriculaListItemDto implements AppMatriculaDetail {
  @ApiProperty({ nullable: true })
  email!: string | null;

  @ApiProperty({ nullable: true })
  telefone!: string | null;

  @ApiProperty({ nullable: true })
  dataNascimento!: string | null;

  @ApiProperty({ nullable: true })
  nomeResponsavel!: string | null;

  @ApiProperty({ nullable: true })
  sexo!: string | null;

  @ApiProperty({ nullable: true })
  rg!: string | null;

  @ApiProperty({ nullable: true })
  endereco!: string | null;

  @ApiProperty({ nullable: true })
  numero!: string | null;

  @ApiProperty({ nullable: true })
  complemento!: string | null;

  @ApiProperty({ nullable: true })
  bairro!: string | null;

  @ApiProperty({ nullable: true })
  cidade!: string | null;

  @ApiProperty({ nullable: true })
  cep!: string | null;

  @ApiProperty({ nullable: true })
  celularRecado!: string | null;

  @ApiProperty({ nullable: true })
  escola!: string | null;

  @ApiProperty({ nullable: true })
  serie!: string | null;

  @ApiProperty({ nullable: true })
  periodo!: string | null;

  @ApiProperty({ nullable: true })
  pedagogicalCreatedAt!: string | null;

  @ApiProperty({ nullable: true })
  pedagogicalUpdatedAt!: string | null;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}

export class AppMatriculasPageDto implements PaginatedResponse<AppMatriculaListItemDto> {
  @ApiProperty({ type: AppMatriculaListItemDto, isArray: true })
  items!: AppMatriculaListItemDto[];

  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;

  @ApiProperty()
  total!: number;

  @ApiProperty()
  totalPages!: number;
}

export class PlanoPagamentoListItemDto implements PlanoPagamentoListItem {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  nome!: string;

  @ApiProperty()
  valorTotal!: number;

  @ApiProperty()
  quantidadeMeses!: number;

  @ApiProperty()
  diaVencimento!: number;

  @ApiProperty({ enum: planoPagamentoStatuses })
  status!: (typeof planoPagamentoStatuses)[number];

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}

export class PlanoPagamentoDetailDto
  extends PlanoPagamentoListItemDto
  implements PlanoPagamentoDetail
{
  @ApiProperty({ type: String, isArray: true })
  usoFuturoEsperado!: string[];
}

export class PlanosPagamentoPageDto implements PaginatedResponse<PlanoPagamentoListItemDto> {
  @ApiProperty({ type: PlanoPagamentoListItemDto, isArray: true })
  items!: PlanoPagamentoListItemDto[];

  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;

  @ApiProperty()
  total!: number;

  @ApiProperty()
  totalPages!: number;
}
