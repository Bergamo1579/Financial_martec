# Tela - Matriculas

## Objetivo da tela
Exibir a base de alunos ja matriculados no sistema pedagogico, funcionando como leitura operacional confiavel para a area comum.

Nesta fase, `Matriculas` e uma tela read-only.

## Quem usa
- Operador da area comum

## Screen e permissoes
- Screen key: `app-matriculas`
- Path: `/app/matriculas`
- Permissao minima: `app.matriculas.view`

## Origem dos dados
- Fonte unica nesta fase: sistema pedagogico via backend do financeiro
- O backend deve expor um read model estavel para a area comum

## Estrutura da listagem
Tabela principal com colunas iniciais:
- `Nome`
- `CPF`
- `Empresa`
- `Turma`
- `Situacao no pedagogico`
- `Ultimo sync`
- `Acoes`

## Filtros e busca
Filtros minimos:
- busca textual por `nome` e `cpf`
- filtro por `empresa`
- filtro por `turma`
- filtro por `situacao no pedagogico`

## Acoes da lista
Por linha:
- `Visualizar`

Nao ha acoes de escrita nesta fase.

## Tela de detalhe
O detalhe da matricula deve exibir:
- identificadores do aluno no pedagogico
- dados cadastrais vindos do pedagogico
- empresa vinculada
- turma vinculada
- dados complementares expostos pelo read model do backend

Blocos esperados:
### 1. Dados do aluno
- nome
- cpf
- email
- telefone, se houver
- data de nascimento, se houver

### 2. Dados academicos
- turma
- status academico
- datas relevantes expostas pelo pedagogico

### 3. Vinculo empresarial
- empresa atual
- dados basicos da empresa

## Regras de negocio da tela
- A tela lista todos os alunos do pedagogico, nao apenas os que vieram do fluxo local de cadastro.
- Nesta fase nao existe edicao financeira na matricula.
- No futuro, a tela passara a mesclar leitura do pedagogico com dados locais do financeiro.
- Se uma matricula tiver origem em um cadastro local, isso pode virar um badge futuro, mas nao e obrigatorio nesta primeira especificacao.

## Edge cases obrigatorios
- aluno sem empresa vinculada
- aluno sem turma vinculada
- inconsistencias temporarias de sync entre aluno e empresa
- paginacao grande de alunos sem degradar a tabela

## Backend esperado
Recursos esperados:
- `GET /v1/app/matriculas`
- `GET /v1/app/matriculas/:id`

Payload minimo esperado da listagem:
- `id`
- `sourceId`
- `nome`
- `cpf`
- `empresa`
- `turma`
- `situacao`
- `lastSyncedAt`

## Fora de escopo nesta fase
- editar dados do aluno no pedagogico
- movimentar turma
- gerar cobranca
- anexar dados financeiros na tela
