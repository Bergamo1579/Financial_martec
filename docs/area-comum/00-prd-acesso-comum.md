# PRD - Acesso Comum do Sistema Financeiro

## Objetivo
Definir a regra de negocio base da area comum do sistema financeiro, isto e, a area usada pelos operadores que vao conduzir o fluxo do candidato ate a matricula e, futuramente, ate a operacao financeira.

Este documento e a fonte de verdade para:
- implementacao visual no `web`
- modelagem futura de backend
- alinhamento entre fluxo operacional, permissao e navegacao

## Contexto do negocio
A Martec recebe candidatos para programas de jovem aprendiz. Antes da matricula no sistema pedagogico, o aluno passa por um fluxo interno de pre-cadastro e indicacao para empresas.

Fluxo resumido:
1. O operador cria um `Cadastro` local no sistema financeiro.
2. O cadastro pode ser indicado para uma ou varias empresas.
3. Cada empresa pode aceitar ou recusar a indicacao.
4. Quando uma empresa avanca para contrato, as demais indicacoes abertas sao encerradas.
5. Quando o processo e concluido, o sistema cria a matricula no pedagogico via API.
6. O cadastro passa a status `MATRICULADO` e fica vinculado ao aluno criado no pedagogico.

## Atores
- Operador da area comum
  Responsavel por criar cadastros, indicar candidatos, acompanhar empresas e concluir o fluxo operacional.
- Empresa parceira
  Nao acessa este sistema nesta fase. Seu comportamento e representado pelas acoes do operador.
- Sistema pedagogico
  Fonte de verdade para `Matriculas` e `Empresas`, e destino final da criacao da matricula.

## Escopo desta fase
As telas documentadas neste pacote sao:
- `Cadastro`
- `Matriculas`
- `Empresas`
- `Planos de pagamento`

Fora de escopo nesta fase:
- emissao de boleto
- cobranca
- geracao detalhada de parcelas
- conciliacao financeira
- portal externo para empresas
- modulo proprio de contratos com lifecycle documental completo

## Navegacao da area comum
Labels esperados no menu:
- `Cadastro`
- `Matriculas`
- `Empresas`
- `Planos de pagamento`

Paths esperados:
- `Cadastro` -> `/app/cadastros`
- `Matriculas` -> `/app/matriculas`
- `Empresas` -> `/app/empresas`
- `Planos de pagamento` -> `/app/planos-pagamento`

Keys esperadas de screen para o IAM:
- `app-cadastros`
- `app-matriculas`
- `app-empresas`
- `app-planos-pagamento`

## Mapa de permissoes
Permissoes iniciais propostas:

| Permissao | Area | Uso |
| --- | --- | --- |
| `app.cadastros.view` | APP | Ver lista e detalhe de cadastros |
| `app.cadastros.manage` | APP | Criar, editar, indicar, arquivar e excluir cadastro quando permitido |
| `app.matriculas.view` | APP | Ver lista e detalhe de matriculas vindas do pedagogico |
| `app.empresas.view` | APP | Ver lista e detalhe de empresas vindas do pedagogico |
| `app.empresas.manage-indicacoes` | APP | Indicar cadastro para empresa e operar aceite, recusa e contrato |
| `app.planos-pagamento.view` | APP | Ver catalogo de planos de pagamento |
| `app.planos-pagamento.manage` | APP | Criar, editar, ativar e inativar planos de pagamento |

Mapeamento screen -> permissao minima:
- `app-cadastros` -> `app.cadastros.view`
- `app-matriculas` -> `app.matriculas.view`
- `app-empresas` -> `app.empresas.view`
- `app-planos-pagamento` -> `app.planos-pagamento.view`

## Entidades canonicas

### 1. Cadastro
Entidade local do financeiro. Nao vem do pedagogico.

Campos minimos desta fase:
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

Regras:
- `cpf` deve ser unico entre cadastros ativos nao deletados.
- `status` e derivado do fluxo, nao editado livremente no formulario.
- `deletedAt` representa soft delete tecnico e nao substitui o status funcional.

### 2. Indicacao
Entidade local que liga `Cadastro` e `Empresa`.

Campos minimos esperados:
- `id`
- `cadastroId`
- `empresaSourceId`
- `status`
- `sentAt`
- `acceptedAt`
- `rejectedAt`
- `contractGeneratedAt`
- `closedAt`
- `closedReason`
- `createdAt`
- `updatedAt`

Status de indicacao:
- `ENVIADA`
- `ACEITA`
- `RECUSADA`
- `CONTRATO_GERADO`
- `ENCERRADA_POR_OUTRA_EMPRESA`

### 3. Matricula do pedagogico
Entidade remota, apenas lida do pedagogico nesta fase.

Uso na area comum:
- exibir os alunos matriculados
- exibir turma, empresa e dados principais
- servir de destino final do fluxo do cadastro quando houver criacao da matricula via API

### 4. Empresa do pedagogico
Entidade remota, lida do pedagogico.

Uso na area comum:
- listar empresas
- consultar seus alunos matriculados
- usar a empresa como alvo das indicacoes locais

### 5. Plano de pagamento
Catalogo local do financeiro.

Campos minimos desta fase:
- `id`
- `nome`
- `valorTotal`
- `quantidadeMeses`
- `diaVencimento`
- `status`
- `createdAt`
- `updatedAt`

Status:
- `ATIVO`
- `INATIVO`

## Estados e derivacao de status do cadastro
Status funcionais do cadastro:
- `ARQUIVADO`
- `ENVIADO`
- `ACEITO`
- `CONTRATO`
- `MATRICULADO`

Regra de derivacao:
- `MATRICULADO`
  Quando a matricula do aluno ja foi criada no pedagogico com sucesso.
- `CONTRATO`
  Quando existe uma indicacao em `CONTRATO_GERADO` e ainda nao existe matricula no pedagogico.
- `ACEITO`
  Quando existe pelo menos uma indicacao em `ACEITA` e nenhuma indicacao em contrato ou matricula.
- `ENVIADO`
  Quando existe pelo menos uma indicacao em `ENVIADA` e nenhuma indicacao em aceite, contrato ou matricula.
- `ARQUIVADO`
  Quando nao existe nenhuma indicacao ativa para o cadastro.

O status principal do cadastro nunca deve ser digitado manualmente pelo operador. Ele muda pelas acoes do fluxo.

## Regras transversais do fluxo

### Indicacoes
- Um cadastro pode ser indicado para varias empresas ao mesmo tempo.
- A indicacao pode ser criada a partir de `Cadastro` e de `Empresas`.
- Ao criar uma nova indicacao, o sistema cria um registro de `Indicacao` e recalcula o status do cadastro.
- A empresa recusar uma indicacao nao altera imediatamente o status principal do cadastro se ainda existir outra indicacao ativa.
- Se todas as indicacoes forem recusadas ou encerradas sem contrato, o cadastro volta para `ARQUIVADO`.
- Uma empresa aceitar a indicacao nao encerra automaticamente as demais.
- Quando uma empresa avancar para `CONTRATO_GERADO`, todas as demais indicacoes abertas desse cadastro devem virar `ENCERRADA_POR_OUTRA_EMPRESA`.

### Exclusao e arquivamento
- `Arquivado` e status funcional de negocio.
- `Soft delete` e um mecanismo tecnico de exclusao logica.
- Cadastro sem historico operacional pode ser excluido via soft delete.
- Cadastro com indicacao, aceite, contrato ou matricula nao deve sofrer soft delete; o comportamento destrutivo passa a ser `Arquivar`.

### Integracao com o pedagogico
- `Matriculas` e `Empresas` leem dados vindos do pedagogico.
- `Cadastro` e `Indicacao` sao locais do financeiro.
- A transicao para `MATRICULADO` depende de uma chamada write-side futura para o pedagogico.
- O retorno dessa chamada deve registrar o vinculo entre cadastro local e aluno criado no pedagogico.

### Separacao de dados
- Dado do pedagogico:
  empresas, alunos matriculados, turma, vinculos academicos e demais dados sincronizados.
- Dado local do financeiro:
  cadastro, indicacao, status derivado, catalogo de planos e futuros dados de cobranca.

## Fluxo ponta a ponta
1. Operador cria um `Cadastro`.
2. O cadastro nasce em `ARQUIVADO`.
3. Operador indica o cadastro para uma ou mais empresas.
4. O cadastro passa para `ENVIADO`.
5. Uma ou mais empresas podem aceitar.
6. Enquanto houver aceite sem contrato, o cadastro fica em `ACEITO`.
7. Quando uma empresa entra em contrato, a indicacao vencedora vira `CONTRATO_GERADO` e as demais sao encerradas.
8. O cadastro passa para `CONTRATO`.
9. Apos conclusao operacional, o sistema cria a matricula no pedagogico via API.
10. O cadastro passa para `MATRICULADO` e fica vinculado ao aluno remoto.

## Contratos e endpoints esperados
Os endpoints abaixo sao referencia funcional para a futura implementacao. Os nomes podem ser mantidos, salvo impedimento tecnico forte.

Recursos locais esperados:
- `GET /v1/app/cadastros`
- `POST /v1/app/cadastros`
- `GET /v1/app/cadastros/:id`
- `PATCH /v1/app/cadastros/:id`
- `DELETE /v1/app/cadastros/:id`
- `POST /v1/app/cadastros/:id/indicacoes`
- `GET /v1/app/cadastros/:id/indicacoes`
- `PATCH /v1/app/indicacoes/:id/accept`
- `PATCH /v1/app/indicacoes/:id/reject`
- `PATCH /v1/app/indicacoes/:id/contract`
- `POST /v1/app/cadastros/:id/matricular`
- `GET /v1/app/planos-pagamento`
- `POST /v1/app/planos-pagamento`
- `PATCH /v1/app/planos-pagamento/:id`

Recursos de leitura remota esperados:
- `GET /v1/app/matriculas`
- `GET /v1/app/matriculas/:id`
- `GET /v1/app/empresas`
- `GET /v1/app/empresas/:id`
- `GET /v1/app/empresas/:id/matriculados`
- `GET /v1/app/empresas/:id/indicacoes`

## Evolucao futura
Entradas previstas para fases seguintes:
- vincular `Plano de pagamento` a relacao `matricula + empresa`
- armazenar dados financeiros locais da matricula
- introduzir contratos com arquivo, assinatura e anexos
- gerar parcelas e boletos a partir do plano
- compor visao unica de matricula com dados do pedagogico + financeiro

## Fora de escopo desta documentacao
- detalhamento de layout pixel a pixel
- regras de emissao de boleto
- regras de multa, juros e desconto
- fluxo de renegociacao
- portal ou aprovacao automatica pela empresa
