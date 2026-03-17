# Arquitetura Base

## Monorepo
- `apps/api`: `NestJS` com autenticação, auditoria, integração e snapshots locais.
- `apps/web`: `Next.js` para backoffice interno.
- `apps/worker`: agenda e consome jobs de reconciliação diária.
- `packages/config`: base compartilhada de ESLint e TS.
- `packages/contracts`: tipos e contratos comuns de papéis, auditoria, filas e integração.
- `packages/ui`: stub inicial para compartilhamento futuro de UI.

## Backend
- Banco principal em `Postgres`.
- ORM em `Prisma` com migration inicial versionada.
- `Redis` para sessão, cache da integração pedagógica e fila leve.
- `auth` próprio do financeiro com cookies `httpOnly`, `access token` curto e `refresh token` rotativo.
- `audit` persistente em tabela própria.
- `integration/pedagogical` com cliente HTTP tipado e projeção local mínima.
- `sync` com enfileiramento manual e execução interna acionada pelo worker.

## Fluxo de leitura
1. O backoffice consulta o `api`.
2. O `api` lê snapshots locais.
3. Se o snapshot estiver vazio ou `forceRefresh=true`, o `api` consulta a API pedagógica.
4. O snapshot local é atualizado.
5. A leitura é auditada.

## Fluxo de reconciliação
1. O worker agenda um job diário.
2. O job entra na fila `pedagogical-sync`.
3. O worker consome o job e chama o endpoint interno do `api`.
4. O `api` executa a reconciliação completa, grava `sync run` e `sync issues`.
