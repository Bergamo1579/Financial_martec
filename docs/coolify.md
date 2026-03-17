# Deploy no Coolify

Este repositorio ja esta preparado para subir no Coolify usando `Dockerfile` por servico.

## Recursos para criar

Crie estes 5 recursos no projeto:

1. `Database_Financial`
   - Tipo: `PostgreSQL`
   - Versao recomendada: `16`
   - Banco: `financial_martec`
2. `Redis`
   - Tipo: `Redis`
   - Versao recomendada: `7`
3. `financial-martec-api`
   - Tipo: `Application`
   - Fonte: `GitHub`
   - Repositorio: `Bergamo1579/Financial_martec`
   - Branch: `main`
   - Build pack: `Dockerfile`
   - Dockerfile: `apps/api/Dockerfile`
   - Porta exposta: `4000`
4. `financial-martec-web`
   - Tipo: `Application`
   - Fonte: `GitHub`
   - Repositorio: `Bergamo1579/Financial_martec`
   - Branch: `main`
   - Build pack: `Dockerfile`
   - Dockerfile: `apps/web/Dockerfile`
   - Porta exposta: `3000`
5. `financial-martec-worker`
   - Tipo: `Application`
   - Fonte: `GitHub`
   - Repositorio: `Bergamo1579/Financial_martec`
   - Branch: `main`
   - Build pack: `Dockerfile`
   - Dockerfile: `apps/worker/Dockerfile`
   - Sem exposicao publica

## Contexto de build

Para os tres apps:

- Build context: raiz do repositorio
- Dockerfile: caminho especifico do app
- Branch: `main`

## Variaveis de ambiente

Arquivos de referencia:

- `deploy/coolify/api.env.example`
- `deploy/coolify/web.env.example`
- `deploy/coolify/worker.env.example`

Regras importantes:

- `DATABASE_URL` deve vir do `Database_Financial`
- `REDIS_URL` deve vir do `Redis`
- `INTERNAL_SYNC_SECRET` precisa ser exatamente o mesmo no `api` e no `worker`
- `NEXT_PUBLIC_API_BASE_URL` deve apontar para a URL publica do `api`
- `INTERNAL_API_BASE_URL` e `WORKER_API_BASE_URL` podem usar a URL interna do servico `api` no Coolify; se preferir simplicidade, use a URL publica do `api`
- `COOKIE_DOMAIN` pode ficar vazio se voce usar IP puro. Se usar dominio, configure com o host compartilhado entre `web` e `api`

## Ordem de deploy

1. Suba `Database_Financial`
2. Suba `Redis`
3. Configure variaveis no `api`
4. Faca o primeiro deploy do `api`
5. Rode a migration:
   - `corepack pnpm db:deploy`
6. Rode a seed inicial:
   - `corepack pnpm db:seed`
7. Configure e suba `web`
8. Configure e suba `worker`

## Exposicao publica

Exponha publicamente apenas:

- `financial-martec-web`
- `financial-martec-api`

O `worker`, o `Postgres` e o `Redis` devem ficar internos.

## O que cada servico faz

- `api`: auth, auditoria, integracao com pedagogico, snapshots e sync
- `web`: backoffice interno
- `worker`: agenda e executa reconciliacao diaria
- `Database_Financial`: banco principal do financeiro
- `Redis`: fila BullMQ, cache e dados operacionais leves
