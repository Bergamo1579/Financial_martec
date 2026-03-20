export function formatDateTime(value?: string | null) {
  if (!value) {
    return '-';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function formatDate(value?: string | null) {
  if (!value) {
    return '-';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
  }).format(new Date(value));
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function formatStudyPeriod(value: string) {
  switch (value) {
    case 'MANHA':
      return 'Manha';
    case 'TARDE':
      return 'Tarde';
    case 'NOITE':
      return 'Noite';
    case 'INTEGRAL':
      return 'Integral';
    default:
      return value;
  }
}

export function formatCadastroStatus(value: string) {
  switch (value) {
    case 'ARQUIVADO':
      return 'Arquivado';
    case 'ENVIADO':
      return 'Enviado';
    case 'ACEITO':
      return 'Aceito';
    case 'CONTRATO':
      return 'Contrato';
    case 'MATRICULADO':
      return 'Matriculado';
    default:
      return value;
  }
}

export function formatIndicacaoStatus(value: string) {
  switch (value) {
    case 'ENVIADA':
      return 'Enviada';
    case 'ACEITA':
      return 'Aceita';
    case 'RECUSADA':
      return 'Recusada';
    case 'CONTRATO_GERADO':
      return 'Contrato gerado';
    case 'ENCERRADA_POR_OUTRA_EMPRESA':
      return 'Encerrada por outra empresa';
    default:
      return value;
  }
}

export function formatPlanoStatus(value: string) {
  switch (value) {
    case 'ATIVO':
      return 'Ativo';
    case 'INATIVO':
      return 'Inativo';
    default:
      return value;
  }
}
