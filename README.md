# Financial Martec

Base do sistema financeiro da Martec em monorepo, com foco inicial em backend robusto, autenticacao propria, auditoria leve, projecao local do sistema pedagogico e backoffice interno.

## Stack

- `pnpm` workspaces
- `NestJS` em `apps/api`
- `Next.js` em `apps/web`
- `BullMQ` + `cron` em `apps/worker`
- `Postgres` + `Prisma`
- `Redis`

## Estrutura

```text
apps/
  api/       API financeira, auth, audit, sync e snapshots
  web/       Backoffice interno
  worker/    Reconciliacao diaria e fila
packages/
  config/    Configs compartilhadas
  contracts/ Tipos e contratos comuns
  ui/        Stub inicial de UI compartilhada
docs/
  architecture.md
  operations.md
  coolify.md
deploy/
  coolify/
```

## Objetivo deste MVP

- Criar login proprio do financeiro com cookies `httpOnly`
- Isolar seguranca e auditoria do dominio financeiro
- Visualizar empresas e alunos do pedagogico a partir de snapshots locais
- Enfileirar e executar reconciliacao manual e diaria
- Preparar a base para o modulo financeiro real sem acoplar regra de negocio ao pedagogico

## Endpoints iniciais

- `POST /v1/auth/login`
- `POST /v1/auth/refresh`
- `POST /v1/auth/logout`
- `GET /v1/auth/me`
- `GET /v1/empresas`
- `GET /v1/empresas/:id`
- `GET /v1/alunos`
- `GET /v1/alunos/:id`
- `POST /v1/sync/pedagogical/run`
- `GET /v1/audit/events`

## Como rodar localmente

1. Copie `.env.example` para `.env`
2. Ajuste segredos, `DATABASE_URL`, `REDIS_URL` e credenciais da API pedagogica
3. Instale dependencias:

```bash
corepack pnpm install
```

4. Gere o Prisma client:

```bash
corepack pnpm --filter @financial-martec/api prisma:generate
```

5. Aplique migrations e seed:

```bash
corepack pnpm db:deploy
corepack pnpm db:seed
```

6. Suba o ambiente:

```bash
corepack pnpm dev
```

## Docker

Para ambiente local completo:

```bash
docker compose up --build
```

Para Coolify, use os `Dockerfile`s por servico e siga [docs/coolify.md](./docs/coolify.md).

## Windows local

Para rodar no Windows sem Docker local:

1. Instale `Node.js 20.11+`
2. Abra `PowerShell` na raiz do repositorio
3. Habilite o Corepack:

```bash
corepack enable
```

4. Instale as dependencias:

```bash
corepack pnpm install
```

5. Crie o `.env` a partir do `.env.example` ou use conexoes externas de Postgres e Redis
6. Gere Prisma e aplique o banco:

```bash
corepack pnpm db:generate
corepack pnpm db:deploy
corepack pnpm db:seed
```

7. Suba tudo:

```bash
corepack pnpm dev
```

Depois disso:

- `web`: `http://localhost:3000`
- `api`: `http://localhost:4000`
- `swagger`: `http://localhost:4000/reference`

## Servicos para criar no Coolify

- `Database_Financial` em `PostgreSQL 16`
- `Redis` em `Redis 7`
- `financial-martec-api` usando `apps/api/Dockerfile`
- `financial-martec-web` usando `apps/web/Dockerfile`
- `financial-martec-worker` usando `apps/worker/Dockerfile`

## CI

A pipeline valida:

- `typecheck`
- `lint`
- `build`
- `test`
- geracao do Prisma client

## Documentacao complementar

- [Arquitetura](./docs/architecture.md)
- [Operacao](./docs/operations.md)
- [Deploy no Coolify](./docs/coolify.md)
