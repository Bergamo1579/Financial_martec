# Tela - Planos de Pagamento

## Objetivo da tela
Cadastrar e administrar o catalogo base de planos de pagamento que sera usado futuramente na relacao entre matricula e empresa.

Nesta fase, o plano de pagamento ainda nao gera boleto nem parcela. Ele so define a base comercial/financeira do acordo.

## Quem usa
- Operador da area comum
- Perfis com responsabilidade financeira futura

## Screen e permissoes
- Screen key: `app-planos-pagamento`
- Path: `/app/planos-pagamento`
- Permissao minima para ver: `app.planos-pagamento.view`
- Permissao minima para operar: `app.planos-pagamento.manage`

## Origem dos dados
- Fonte unica nesta fase: banco local do financeiro

## Estrutura da listagem
Tabela principal com colunas iniciais:
- `Nome`
- `Valor total`
- `Quantidade de meses`
- `Dia de vencimento`
- `Status`
- `Ultima atualizacao`
- `Acoes`

## Filtros e busca
Filtros minimos:
- busca por `nome`
- filtro por `status`

## Formulario de criacao e edicao
Campos minimos:
- `nome`
- `valorTotal`
- `quantidadeMeses`
- `diaVencimento`
- `status`

Regras documentais:
- `quantidadeMeses` deve ser inteiro positivo
- `valorTotal` deve ser monetario positivo
- `diaVencimento` deve aceitar `1` a `31`
- meses curtos e ajuste de calendario ficam para a fase de boleto

Status permitidos:
- `ATIVO`
- `INATIVO`

## Acoes da lista
Por linha:
- `Visualizar`
- `Editar`
- `Ativar`
- `Inativar`

Nao existe exclusao fisica ou logica nesta fase. O lifecycle do catalogo e `ATIVO/INATIVO`.

## Tela de detalhe
O detalhe do plano deve exibir:
- nome
- valor total
- quantidade de meses
- dia de vencimento
- status
- data de criacao
- ultima atualizacao

Pode incluir um bloco textual chamado `Uso futuro esperado` com a explicacao:
- este plano sera vinculado futuramente a uma relacao entre matricula e empresa
- a empresa sera a pagadora dos boletos
- a geracao de parcelas e boletos nao faz parte desta fase

## Regras de negocio da tela
- Plano de pagamento nasce como catalogo reutilizavel.
- Ele nao nasce ligado a empresa ou matricula nesta fase.
- Planos inativos nao devem aparecer como opcao selecionavel em fluxos futuros, mas continuam historicos.
- Edicao de plano nao implica recalculo automatico de contratos futuros nesta fase, porque ainda nao existe modulo contratual completo.

## Edge cases obrigatorios
- tentativa de cadastrar plano com nome duplicado
- valor total igual ou menor que zero
- quantidade de meses invalida
- dia de vencimento fora da faixa 1..31
- inativacao de plano que futuramente ja venha a ser usado

## Backend esperado
Recursos esperados:
- `GET /v1/app/planos-pagamento`
- `POST /v1/app/planos-pagamento`
- `GET /v1/app/planos-pagamento/:id`
- `PATCH /v1/app/planos-pagamento/:id`

Payload minimo esperado:
- `id`
- `nome`
- `valorTotal`
- `quantidadeMeses`
- `diaVencimento`
- `status`
- `createdAt`
- `updatedAt`

## Relacao com fases futuras
Futuras entidades ou fluxos que vao consumir este catalogo:
- contrato comercial entre empresa e aluno
- vinculo financeiro de matricula
- geracao de parcelas
- geracao de boletos
- acompanhamento de inadimplencia

## Fora de escopo nesta fase
- boleto
- parcela detalhada
- multa
- juros
- desconto
- renegociacao
- cobranca automatica
