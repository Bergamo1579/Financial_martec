# Tela - Cadastro

## Objetivo da tela
Permitir que o operador cadastre e acompanhe candidatos antes da matricula no sistema pedagogico.

`Cadastro` e a porta de entrada operacional do candidato no sistema financeiro.

## Quem usa
- Operador da area comum

## Screen e permissoes
- Screen key: `app-cadastros`
- Path: `/app/cadastros`
- Permissao minima para ver: `app.cadastros.view`
- Permissao minima para operar: `app.cadastros.manage`

## Origem dos dados
- Fonte principal: banco local do financeiro
- Dependencias relacionadas:
  - empresas do pedagogico para o fluxo de indicacao
  - indicacoes locais para compor historico e status derivado

## Estrutura da listagem
Tabela principal com colunas iniciais:
- `Nome completo`
- `Telefone`
- `CPF`
- `Nome do responsavel`
- `Periodo de estudo`
- `Status`
- `Ultima atualizacao`
- `Acoes`

## Filtros e busca
Filtros minimos:
- busca textual por `nomeCompleto`, `cpf`, `telefone` e `nomeResponsavel`
- filtro por `status`
- filtro por `periodoEstudo`
- filtro por `deletedAt`:
  - default: ocultar deletados
  - opcional: mostrar deletados em visao administrativa

## Formulario de criacao e edicao
Campos obrigatorios:
- `nomeCompleto`
- `telefone`
- `cpf`
- `nomeResponsavel`
- `periodoEstudo`

Valores permitidos para `periodoEstudo`:
- `MANHA`
- `TARDE`
- `NOITE`
- `INTEGRAL`

Regras do formulario:
- `status` nao e campo editavel; ele e derivado.
- novo cadastro nasce em `ARQUIVADO`.
- `cpf` nao pode duplicar outro cadastro ativo nao deletado.

## Acoes da lista
Por linha:
- `Visualizar`
- `Editar`
- `Indicar para empresa`
- `Arquivar`
- `Excluir`

Regra da acao destrutiva:
- se o cadastro nunca entrou no fluxo operacional, `Excluir` faz soft delete com `deletedAt`
- se o cadastro ja teve indicacao, aceite, contrato ou matricula, a acao destrutiva disponivel passa a ser `Arquivar`

## Tela de detalhe
O detalhe do cadastro deve conter pelo menos 3 blocos:

### 1. Dados do cadastro
- dados cadastrais
- status atual
- timestamps principais

### 2. Historico de indicacoes
Lista das empresas para as quais o cadastro foi indicado, com:
- empresa
- status da indicacao
- data de envio
- data de aceite, se houver
- data de recusa, se houver
- data de contrato, se houver
- motivo de encerramento, se houver

### 3. Acoes operacionais
- indicar para nova empresa
- abrir empresa relacionada
- arquivar cadastro
- excluir por soft delete quando permitido

## Estados e transicoes
Status do cadastro:
- `ARQUIVADO`
- `ENVIADO`
- `ACEITO`
- `CONTRATO`
- `MATRICULADO`

Transicoes validas:
- criacao -> `ARQUIVADO`
- criar uma indicacao -> `ENVIADO`
- pelo menos uma indicacao aceita -> `ACEITO`
- uma indicacao em contrato -> `CONTRATO`
- matricula criada no pedagogico -> `MATRICULADO`
- todas as indicacoes encerradas/recusadas sem contrato -> `ARQUIVADO`

## Regras de negocio da tela
- O operador pode indicar o mesmo cadastro para varias empresas.
- O status principal do cadastro nao e editado manualmente.
- Ao indicar para uma empresa, o sistema cria uma `Indicacao` com status `ENVIADA`.
- A recusa de uma empresa remove o cadastro apenas da visao daquela empresa; outras indicacoes continuam validas.
- Se todas as indicacoes ativas forem perdidas, o cadastro volta para `ARQUIVADO`.
- Quando uma empresa avancar para contrato, as demais indicacoes abertas devem ser encerradas automaticamente.
- O soft delete e reservado para registros sem relevancia historica operacional.

## Edge cases obrigatorios
- tentar criar cadastro com CPF ja existente
- tentar excluir cadastro com historico operacional
- indicar para a mesma empresa duas vezes ao mesmo tempo
- recusa da ultima empresa ativa
- aceite em mais de uma empresa simultaneamente
- contrato gerado para uma empresa com outras indicacoes ainda abertas

## Backend esperado
Recursos esperados:
- `GET /v1/app/cadastros`
- `POST /v1/app/cadastros`
- `GET /v1/app/cadastros/:id`
- `PATCH /v1/app/cadastros/:id`
- `DELETE /v1/app/cadastros/:id`
- `GET /v1/app/cadastros/:id/indicacoes`
- `POST /v1/app/cadastros/:id/indicacoes`

Payload minimo esperado do cadastro:
- `id`
- `nomeCompleto`
- `telefone`
- `cpf`
- `nomeResponsavel`
- `periodoEstudo`
- `status`
- `deletedAt`
- `createdAt`
- `updatedAt`

## Fora de escopo nesta fase
- upload de curriculo
- anexos de contrato
- timeline auditavel completa na UI
- conciliacao com dados financeiros
