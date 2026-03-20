# Tela - Empresas

## Objetivo da tela
Exibir a base de empresas do sistema pedagogico e permitir operar as indicacoes locais de cadastros para cada empresa.

`Empresas` e a tela de consulta do parceiro e tambem um ponto contextual para indicar candidatos.

## Quem usa
- Operador da area comum

## Screen e permissoes
- Screen key: `app-empresas`
- Path: `/app/empresas`
- Permissao minima para ver: `app.empresas.view`
- Permissao minima para operar indicacoes: `app.empresas.manage-indicacoes`

## Origem dos dados
- Empresa base: pedagogico
- Matriculados da empresa: pedagogico
- Cadastros indicados para a empresa: banco local do financeiro

## Estrutura da listagem
Tabela principal com colunas iniciais:
- `Empresa`
- `CNPJ`
- `Total de matriculados`
- `Total de indicacoes abertas`
- `Ultimo sync`
- `Acoes`

## Filtros e busca
Filtros minimos:
- busca textual por `nome` e `cnpj`
- filtro por situacao da empresa, se o pedagogico expuser
- filtro por empresa com indicacoes abertas

## Acoes da lista
Por linha:
- `Visualizar`
- `Indicar cadastro`

## Tela de detalhe
O detalhe da empresa deve ser organizado em 3 abas:

### 1. Visao geral
- dados da empresa
- contagem de matriculados
- contagem de indicacoes por status

### 2. Matriculados
Tabela com alunos do pedagogico vinculados a empresa.

Colunas minimas:
- nome
- cpf
- turma
- situacao

### 3. Cadastros indicados
Tabela local com os cadastros enviados a empresa.

Colunas minimas:
- nome do cadastro
- cpf
- status da indicacao
- status atual do cadastro
- data de envio
- ultima atualizacao
- acoes

## Acoes dentro da aba "Cadastros indicados"
Acoes por linha:
- `Visualizar cadastro`
- `Marcar como aceita`
- `Marcar como recusada`
- `Marcar contrato gerado`

Regras:
- `Marcar como aceita` muda a indicacao para `ACEITA` e recalcula o status do cadastro.
- `Marcar como recusada` muda a indicacao para `RECUSADA`.
- `Marcar contrato gerado` muda a indicacao para `CONTRATO_GERADO` e encerra todas as outras indicacoes abertas do mesmo cadastro.

## Fluxo de indicar cadastro pela empresa
Ao usar `Indicar cadastro` a partir da empresa:
1. Abrir seletor de cadastros locais elegiveis.
2. Mostrar apenas cadastros nao deletados e nao matriculados.
3. Ocultar cadastros ja com indicacao aberta para a mesma empresa.
4. Ao confirmar, criar `Indicacao` com status `ENVIADA`.

## Regras de negocio da tela
- Empresas nao sao criadas nem editadas aqui; sao lidas do pedagogico.
- A empresa pode ter varios cadastros indicados ao mesmo tempo.
- O mesmo cadastro pode estar indicado para varias empresas ao mesmo tempo.
- A recusa da empresa remove apenas aquela oportunidade; nao apaga o cadastro.
- Se a empresa aceitar um cadastro, outras empresas ainda podem continuar com aceite aberto.
- O encerramento automatico das demais empresas so acontece quando uma empresa entra em contrato.

## Edge cases obrigatorios
- empresa sem matriculados
- empresa com muitos matriculados e nenhuma indicacao
- empresa com muitos cadastros indicados de status mistos
- tentativa de indicar o mesmo cadastro duas vezes para a mesma empresa
- recusa da ultima indicacao ativa do cadastro
- contrato gerado para empresa com outras indicacoes ainda abertas

## Backend esperado
Recursos esperados:
- `GET /v1/app/empresas`
- `GET /v1/app/empresas/:id`
- `GET /v1/app/empresas/:id/matriculados`
- `GET /v1/app/empresas/:id/indicacoes`
- `POST /v1/app/cadastros/:id/indicacoes`
- `PATCH /v1/app/indicacoes/:id/accept`
- `PATCH /v1/app/indicacoes/:id/reject`
- `PATCH /v1/app/indicacoes/:id/contract`

Payload minimo esperado da aba de indicacoes:
- `indicacaoId`
- `cadastroId`
- `empresaSourceId`
- `statusIndicacao`
- `statusCadastro`
- `sentAt`
- `acceptedAt`
- `rejectedAt`
- `contractGeneratedAt`

## Fora de escopo nesta fase
- cadastro ou edicao de empresa
- portal da empresa
- upload de contrato pela empresa
- automacao de aceite externo
