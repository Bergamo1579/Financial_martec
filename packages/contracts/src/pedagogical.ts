export interface PedagogicalCompany {
  id: string;
  nome: string;
  criado_em?: string;
  razao_social?: string;
  cnpj?: string;
  inscricao_estadual?: string | null;
  endereco?: string | null;
  numero?: string | null;
  cidade?: string | null;
  bairro?: string | null;
  estado?: string | null;
  cep?: string | null;
  telefone?: string | null;
  email?: string | null;
  representante_nome?: string | null;
  representante_cargo?: string | null;
  username?: string | null;
}

export interface PedagogicalStudent {
  id: string;
  nome: string;
  cpf: string;
  data_nascimento: string;
  unidade_id?: string | null;
  turma_id?: string | null;
  empresa_id: string;
  criado_em?: string;
  atualizado_em?: string;
  responsavel_nome?: string | null;
  sexo?: 'M' | 'F' | null;
  rg?: string | null;
  endereco?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  cep?: string | null;
  celular?: string | null;
  celular_recado?: string | null;
  email?: string | null;
  escola?: string | null;
  serie?: string | null;
  periodo?: 'manha' | 'tarde' | 'noite' | null;
}

export interface PedagogicalClass {
  id: string;
  nome: string;
  descricao?: string | null;
  criado_em?: string;
  id_unidade?: string | null;
}

export interface PedagogicalUnit {
  id: string;
  nome: string;
  localizacao?: string | null;
}
