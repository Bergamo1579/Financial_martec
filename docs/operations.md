# Operação

## Ambientes
- `api`: porta `4000`
- `web`: porta `3000`
- `postgres`: porta `5432`
- `redis`: porta `6379`

## Primeira subida
1. Copiar `.env.example` para `.env`.
2. Ajustar segredos e credenciais do pedagógico.
3. Rodar `pnpm install`.
4. Rodar `pnpm --filter @financial-martec/api prisma:generate`.
5. Rodar `pnpm db:deploy`.
6. Rodar `pnpm db:seed`.
7. Subir `pnpm dev` ou `docker compose up --build`.

## Seed inicial
- Usa `ADMIN_BOOTSTRAP_EMAIL`, `ADMIN_BOOTSTRAP_PASSWORD` e `ADMIN_BOOTSTRAP_NAME`.
- Cria perfis padrão e vincula o usuário inicial ao papel `owner`.

## Coolify
- Recursos esperados: `api`, `web`, `worker`, `Database_Financial` em Postgres e `Redis`.
- O worker depende do `INTERNAL_SYNC_SECRET` para disparar a execução interna do sync.
