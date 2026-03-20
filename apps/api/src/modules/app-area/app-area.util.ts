import type {
  CadastroStatus,
  IndicacaoStatus,
} from '@financial-martec/contracts';

const duplicateBlockingIndicacaoStatuses = new Set<IndicacaoStatus>([
  'ENVIADA',
  'ACEITA',
  'CONTRATO_GERADO',
]);

const companyOpenIndicacaoStatuses = new Set<IndicacaoStatus>(['ENVIADA', 'ACEITA']);

export function normalizeCpf(value: string) {
  return value.replace(/\D+/g, '');
}

export function isIndicacaoDuplicateBlocking(status: IndicacaoStatus) {
  return duplicateBlockingIndicacaoStatuses.has(status);
}

export function isCompanyIndicacaoOpen(status: IndicacaoStatus) {
  return companyOpenIndicacaoStatuses.has(status);
}

export function deriveCadastroStatus(
  pedagogicalStudentSourceId: string | null | undefined,
  indicacaoStatuses: IndicacaoStatus[],
): CadastroStatus {
  if (pedagogicalStudentSourceId) {
    return 'MATRICULADO';
  }

  if (indicacaoStatuses.includes('CONTRATO_GERADO')) {
    return 'CONTRATO';
  }

  if (indicacaoStatuses.includes('ACEITA')) {
    return 'ACEITO';
  }

  if (indicacaoStatuses.includes('ENVIADA')) {
    return 'ENVIADO';
  }

  return 'ARQUIVADO';
}

export function hasCadastroOperationalHistory(
  indicacoesCount: number,
  pedagogicalStudentSourceId: string | null | undefined,
) {
  return indicacoesCount > 0 || Boolean(pedagogicalStudentSourceId);
}

export function canDeleteCadastro(
  indicacoesCount: number,
  pedagogicalStudentSourceId: string | null | undefined,
  deletedAt: Date | null | undefined,
) {
  return !deletedAt && !hasCadastroOperationalHistory(indicacoesCount, pedagogicalStudentSourceId);
}

export function canArchiveCadastro(
  pedagogicalStudentSourceId: string | null | undefined,
  deletedAt: Date | null | undefined,
) {
  return !deletedAt && !pedagogicalStudentSourceId;
}
