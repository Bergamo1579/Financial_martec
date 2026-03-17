# Financial Martec

Base do sistema financeiro da Martec em formato monorepo, com foco inicial em backend robusto, autenticação própria, auditoria leve e forte, projeção local de dados do sistema pedagógico e backoffice interno.

## Stack
- `pnpm` workspaces
- `NestJS` no `apps/api`
- `Next.js` no `apps/web`
- `BullMQ` + `cron` no `apps/worker`
- `Postgres` + `Prisma`
- `Redis`

## Estrutura
```text
apps/
  api/       API financeira, auth, audit, sync, snapshots
  web/       Backoffice interno
  worker/    Reconciliação diária e consumo de fila
packages/
  config/    Configs compartilhadas
  contracts/ Tipos e contratos comuns
  ui/        Stub inicial de UI compartilhada
docs/
  architecture.md
  operations.md
```

## Objetivo deste MVP
- Criar login próprio do financeiro com cookies `httpOnly`
- Isolar segurança e auditoria do domínio financeiro
- Visualizar empresas e alunos do pedagógico a partir de snapshots locais
- Enfileirar e executar reconciliação manual e diária
- Preparar a base para o módulo financeiro real sem acoplar regra de negócio ao pedagógico

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
1. Copie `.env.example` para `.env`.
2. Ajuste segredos, `DATABASE_URL`, `REDIS_URL` e credenciais da API pedagógica.
3. Instale dependências:
   ```bash
   pnpm install
   ```
4. Gere o Prisma client:
   ```bash
   pnpm --filter @financial-martec/api prisma:generate
   ```
5. Aplique migrations e seed:
   ```bash
   pnpm db:deploy
   pnpm db:seed
   ```
6. Suba o ambiente:
   ```bash
   pnpm dev
   ```

## Docker
```bash
docker compose up --build
```

## CI
A pipeline valida:
- `typecheck`
- `lint`
- `build`
- `test`
- geração do Prisma client

## Documentação complementar
- [Arquitetura](./docs/architecture.md)
- [Operação](./docs/operations.md)
