export type DocumentationHighlight = {
  label: string;
  value: string;
  description: string;
};

export type DocumentationSection = {
  id: string;
  kicker: string;
  title: string;
  summary: string;
  bullets: string[];
};

export type DocumentationEndpoint = {
  method: string;
  path: string;
  detail: string;
};

export type DocumentationLink = {
  label: string;
  href: string;
  detail: string;
  external?: boolean;
};

export const documentationHighlights: DocumentationHighlight[] = [
  {
    label: 'Estado da base',
    value: 'Pronta para evoluir',
    description:
      'Auth, IAM minimo, sync atomico, auditoria e testes integrados ja sustentam o proximo ciclo.',
  },
  {
    label: 'Leitura',
    value: 'Snapshot-first',
    description:
      'Empresas, alunos e dashboard leem apenas o batch CURRENT para evitar parcial em falha.',
  },
  {
    label: 'Referencia',
    value: 'Scalar + OpenAPI',
    description:
      'A API reference fica no proprio web e acompanha os contratos reais publicados pela API.',
  },
];

export const documentationSections: DocumentationSection[] = [
  {
    id: 'overview',
    kicker: 'Bem-vindo(a)',
    title: 'Bem-vindo(a) ao Financial Martec',
    summary:
      'Esta pagina resume o estado atual do produto, o que ja esta pronto para uso real e onde a documentacao sera atualizada conforme o dominio financeiro entrar.',
    bullets: [
      'Backend modular em Nest com Prisma, Redis, BullMQ e contratos compartilhados no monorepo.',
      'Sessao com cookies httpOnly, refresh rotativo, revogacao e contexto autenticado com roles e permissions.',
      'Read models de empresas e alunos servindo apenas snapshots publicados e paginados.',
      'Dashboard, auditoria, sync e IAM minimo ja estao prontos para o backoffice.',
    ],
  },
  {
    id: 'architecture',
    kicker: 'Arquitetura do Sistema',
    title: 'Fronteiras que organizam a base',
    summary:
      'A plataforma separa operacao, integracao externa e futuro dominio financeiro para reduzir acoplamento e evitar regressao estrutural.',
    bullets: [
      'O fluxo financeiro nao depende da autenticacao nem da sessao do sistema pedagogico.',
      'O sync externo escreve em STAGING e publica em CURRENT apenas quando o reconcile conclui.',
      'O worker opera com lease, heartbeat, timeout e healthcheck proprio.',
      'A documentacao vive no frontend para acompanhar a evolucao funcional do produto.',
    ],
  },
  {
    id: 'services',
    kicker: 'Backend & Services',
    title: 'Servicos que ja sustentam a operacao',
    summary:
      'Os servicos centrais ja entregam leitura consistente, operacao rastreavel e pontos de acesso estaveis para o frontend.',
    bullets: [
      'Auth expoe login, refresh, logout, me, sessoes e troca de senha.',
      'IAM minimo cobre usuarios, roles, permissao e auditoria das mutacoes.',
      'Dashboard, empresas e alunos leem somente read models estabilizados.',
      'A API reference mostra rotas reais sem acoplar o frontend ao Prisma.',
    ],
  },
  {
    id: 'operations',
    kicker: 'Operacao e Sync',
    title: 'Fluxos criticos endurecidos para producao',
    summary:
      'O processamento ganhou atomo, lock distribuido, retry e estado operacional de issues para evitar falhas silenciosas.',
    bullets: [
      'Sync com retry controlado, lock distribuido no enqueue e stale-run recovery.',
      'Issue state com abertura automatica, reabertura e resolucao manual.',
      'Shutdown consistente de API e worker para deploy e reinicio limpos.',
      'Suite integrada contra Postgres e Redis isolados no Coolify.',
    ],
  },
  {
    id: 'governance',
    kicker: 'Governanca',
    title: 'Como manter a documentacao viva',
    summary:
      'A doc precisa acompanhar o produto. Cada regra nova deve atualizar a visao, os contratos e a referencia da API na mesma entrega.',
    bullets: [
      'Mudancas de contrato, status operacional ou modelo de dados precisam refletir aqui.',
      'A pagina serve como fonte rapida para onboarding, produto, frontend e operacao.',
      'Quando o financeiro entrar, esta area vira o indice dos fluxos e rotas do dominio.',
      'A proxima fase deve acrescentar wireframes, exemplos de payload e guias de uso.',
    ],
  },
];

export const documentationEndpoints: DocumentationEndpoint[] = [
  {
    method: 'GET',
    path: '/v1/auth/me',
    detail: 'Retorna o contexto autenticado com roles e permissions.',
  },
  {
    method: 'GET',
    path: '/v1/empresas?page=1&pageSize=20',
    detail: 'Read model paginado de empresas publicado pelo snapshot.',
  },
  {
    method: 'GET',
    path: '/v1/alunos?page=1&pageSize=20',
    detail: 'Read model paginado de alunos com vinculo resumido.',
  },
  {
    method: 'POST',
    path: '/v1/sync/pedagogical/run',
    detail: 'Dispara o sync em fila com deduplicacao e retry.',
  },
  {
    method: 'GET',
    path: '/v1/sync/pedagogical/issues',
    detail: 'Lista pendencias abertas e resolvidas por fingerprint.',
  },
];

export const documentationLinks: DocumentationLink[] = [
  {
    label: 'Abrir API Reference',
    href: '/docs/reference',
    detail: 'Visualizacao interativa da API em Scalar com o OpenAPI atual.',
  },
  {
    label: 'Ver OpenAPI bruto',
    href: '/docs/openapi',
    detail: 'Proxy server-side do schema OpenAPI atual da API.',
  },
  {
    label: 'Entrar no backoffice',
    href: '/login',
    detail: 'Acesso ao front protegido atual para operacao.',
  },
];

export const documentationSignals = [
  'Auth, sessao e permissions prontos para uso real.',
  'IAM minimo suficiente para o proximo ciclo de backoffice.',
  'Sync robusto, snapshot atomico e leitura consistente.',
  'Base pronta para abrir o dominio financeiro sem improviso.',
];
