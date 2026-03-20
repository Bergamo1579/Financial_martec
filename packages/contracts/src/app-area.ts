export const studyPeriods = ['MANHA', 'TARDE', 'NOITE', 'INTEGRAL'] as const;
export type StudyPeriod = (typeof studyPeriods)[number];

export const cadastroStatuses = [
  'ARQUIVADO',
  'ENVIADO',
  'ACEITO',
  'CONTRATO',
  'MATRICULADO',
] as const;
export type CadastroStatus = (typeof cadastroStatuses)[number];

export const indicacaoStatuses = [
  'ENVIADA',
  'ACEITA',
  'RECUSADA',
  'CONTRATO_GERADO',
  'ENCERRADA_POR_OUTRA_EMPRESA',
] as const;
export type IndicacaoStatus = (typeof indicacaoStatuses)[number];

export const planoPagamentoStatuses = ['ATIVO', 'INATIVO'] as const;
export type PlanoPagamentoStatus = (typeof planoPagamentoStatuses)[number];

export const matriculaSituacoes = ['MATRICULADO'] as const;
export type MatriculaSituacao = (typeof matriculaSituacoes)[number];

export interface CadastroListItem {
  id: string;
  nomeCompleto: string;
  telefone: string;
  cpf: string;
  nomeResponsavel: string;
  periodoEstudo: StudyPeriod;
  status: CadastroStatus;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  hasOperationalHistory: boolean;
  canDelete: boolean;
  canArchive: boolean;
}

export interface IndicacaoItem {
  id: string;
  cadastroId: string;
  empresaSourceId: string;
  empresaNome: string | null;
  status: IndicacaoStatus;
  sentAt: string;
  acceptedAt: string | null;
  rejectedAt: string | null;
  contractGeneratedAt: string | null;
  closedAt: string | null;
  closedReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CadastroDetail extends CadastroListItem {
  pedagogicalStudentSourceId: string | null;
  indicacoes: IndicacaoItem[];
}

export interface CreateCadastroRequest {
  nomeCompleto: string;
  telefone: string;
  cpf: string;
  nomeResponsavel: string;
  periodoEstudo: StudyPeriod;
}

export interface UpdateCadastroRequest {
  nomeCompleto?: string;
  telefone?: string;
  cpf?: string;
  nomeResponsavel?: string;
  periodoEstudo?: StudyPeriod;
  archive?: boolean;
}

export interface CreateIndicacaoRequest {
  empresaSourceId: string;
}

export interface QueryCadastrosRequest {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: CadastroStatus;
  periodoEstudo?: StudyPeriod;
  includeDeleted?: boolean;
}

export interface AppCompanyListItem {
  id: string;
  sourceId: string;
  name: string;
  legalName: string | null;
  taxId: string | null;
  email: string | null;
  phone: string | null;
  totalMatriculados: number;
  totalIndicacoesAbertas: number;
  sourceUpdatedAt: string | null;
  lastSyncedAt: string;
}

export interface AppCompanyIndicacaoItem {
  indicacaoId: string;
  cadastroId: string;
  cadastroNomeCompleto: string;
  cadastroCpf: string;
  empresaSourceId: string;
  statusIndicacao: IndicacaoStatus;
  statusCadastro: CadastroStatus;
  sentAt: string;
  acceptedAt: string | null;
  rejectedAt: string | null;
  contractGeneratedAt: string | null;
  updatedAt: string;
  closedAt: string | null;
  closedReason: string | null;
}

export interface AppCompanyDetail extends AppCompanyListItem {
  address: string | null;
  city: string | null;
  neighborhood: string | null;
  state: string | null;
  postalCode: string | null;
  representativeName: string | null;
  representativeRole: string | null;
  username: string | null;
  createdAt: string;
  updatedAt: string;
  indicacoesPorStatus: Partial<Record<IndicacaoStatus, number>>;
}

export interface AppMatriculaCompanySummary {
  sourceId: string;
  name: string;
}

export interface AppMatriculaClassSummary {
  sourceId: string;
  name: string;
  description: string | null;
}

export interface AppMatriculaUnitSummary {
  sourceId: string;
  name: string;
}

export interface AppMatriculaListItem {
  id: string;
  sourceId: string;
  nome: string;
  cpf: string;
  empresa: AppMatriculaCompanySummary | null;
  turma: AppMatriculaClassSummary | null;
  unidade: AppMatriculaUnitSummary | null;
  situacao: MatriculaSituacao;
  lastSyncedAt: string;
}

export interface AppMatriculaDetail extends AppMatriculaListItem {
  email: string | null;
  telefone: string | null;
  dataNascimento: string | null;
  nomeResponsavel: string | null;
  sexo: string | null;
  rg: string | null;
  endereco: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  cep: string | null;
  celularRecado: string | null;
  escola: string | null;
  serie: string | null;
  periodo: string | null;
  pedagogicalCreatedAt: string | null;
  pedagogicalUpdatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface QueryAppMatriculasRequest {
  page?: number;
  pageSize?: number;
  search?: string;
  empresaSourceId?: string;
  turmaSourceId?: string;
}

export interface QueryAppCompaniesRequest {
  page?: number;
  pageSize?: number;
  search?: string;
  hasOpenIndicacoes?: boolean;
}

export interface PlanoPagamentoListItem {
  id: string;
  nome: string;
  valorTotal: number;
  quantidadeMeses: number;
  diaVencimento: number;
  status: PlanoPagamentoStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PlanoPagamentoDetail extends PlanoPagamentoListItem {
  usoFuturoEsperado: string[];
}

export interface QueryPlanosPagamentoRequest {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: PlanoPagamentoStatus;
}

export interface CreatePlanoPagamentoRequest {
  nome: string;
  valorTotal: number;
  quantidadeMeses: number;
  diaVencimento: number;
  status?: PlanoPagamentoStatus;
}

export interface UpdatePlanoPagamentoRequest {
  nome?: string;
  valorTotal?: number;
  quantidadeMeses?: number;
  diaVencimento?: number;
  status?: PlanoPagamentoStatus;
}
