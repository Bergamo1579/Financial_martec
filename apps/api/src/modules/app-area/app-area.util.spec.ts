import {
  canArchiveCadastro,
  canDeleteCadastro,
  deriveCadastroStatus,
  isCompanyIndicacaoOpen,
  isIndicacaoDuplicateBlocking,
  normalizeCpf,
} from './app-area.util';

describe('app-area util', () => {
  it('normalizes CPF to digits only', () => {
    expect(normalizeCpf('123.456.789-00')).toBe('12345678900');
  });

  it('derives cadastro status by operational precedence', () => {
    expect(deriveCadastroStatus(null, [])).toBe('ARQUIVADO');
    expect(deriveCadastroStatus(null, ['ENVIADA'])).toBe('ENVIADO');
    expect(deriveCadastroStatus(null, ['ENVIADA', 'ACEITA'])).toBe('ACEITO');
    expect(deriveCadastroStatus(null, ['ACEITA', 'CONTRATO_GERADO'])).toBe('CONTRATO');
    expect(deriveCadastroStatus('student-1', ['CONTRATO_GERADO'])).toBe('MATRICULADO');
  });

  it('tracks duplicate-blocking and company-open indication states independently', () => {
    expect(isIndicacaoDuplicateBlocking('ENVIADA')).toBe(true);
    expect(isIndicacaoDuplicateBlocking('ACEITA')).toBe(true);
    expect(isIndicacaoDuplicateBlocking('CONTRATO_GERADO')).toBe(true);
    expect(isIndicacaoDuplicateBlocking('RECUSADA')).toBe(false);
    expect(isCompanyIndicacaoOpen('ENVIADA')).toBe(true);
    expect(isCompanyIndicacaoOpen('ACEITA')).toBe(true);
    expect(isCompanyIndicacaoOpen('CONTRATO_GERADO')).toBe(false);
  });

  it('allows delete only for records without operational history and not deleted', () => {
    expect(canDeleteCadastro(0, null, null)).toBe(true);
    expect(canDeleteCadastro(1, null, null)).toBe(false);
    expect(canDeleteCadastro(0, 'student-1', null)).toBe(false);
    expect(canDeleteCadastro(0, null, new Date())).toBe(false);
  });

  it('blocks archive for deleted or already matriculated cadastros', () => {
    expect(canArchiveCadastro(null, null)).toBe(true);
    expect(canArchiveCadastro('student-1', null)).toBe(false);
    expect(canArchiveCadastro(null, new Date())).toBe(false);
  });
});
