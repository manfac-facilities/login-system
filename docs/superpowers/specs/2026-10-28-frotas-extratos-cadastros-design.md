# Design — Frotas: cadastros de cartão/tag/centro de custo e envio de extratos (Etapas 2 e 3)

**Data:** 28/10/2026 · **Fonte literal:** `docs/cliente/2026-10-27-frotas-extratos-ticketlog-veloe.md` (pedido do
José/financeiro) e `docs/cliente/2026-10-27-frotas-cobranca-prazo-jose.md` (pede deploy por etapas).
**Amostras reais (fora do Git, dado pessoal):** `docs/cliente/2026-10-27-frotas-extratos-amostras/`
(Ticketlog `.xlsx` 206 transações / 26 cartões / 1 placa; Veloe `.csv` 403 linhas / 27 tags / 25 placas).

## Decisões do João (27/10/2026, noite — "todas essas sugestões, pode prosseguir")

- E1. Quem envia extrato e mexe nos cadastros: **gestor de frotas** (papel `sofia_gestores`, da rodada 2) **e admin**.
- E2. Centro de custo é **resolvido na leitura** (pela ligação vigente na data de uso), não congelado no envio. Cadastrar
  a ligação de um cartão "sem centro de custo" resolve os gastos antigos dele sozinho.
- E3. O centro de custo por **veículo** que já existe (`centro_custo_historico`, tela Custos) **fica como está**. A
  ligação nova é **equipe → centro de custo do Omie, com data de início** (`vigente_desde`).
- E4. Entrega ao financeiro: **duas views só de leitura** (consumo por linha; saldos digitados), **sem nome de
  motorista**, legíveis só por quem tem papel no módulo Financeiro (ver `manfac-facilities/financeiro`,
  `supabase/hub-install/002_fin_papeis.sql` para a função de papel) — e por admin/gestor de frotas.

## Etapas (pedido do José: deploy por etapa)

- **Etapa 2 — cadastros:** cartão Ticketlog (`NUMERO CARTAO`) → equipe; tag Veloe (`VeloeTag`) → equipe (placa só
  como informação, nunca chave); equipe → centro de custo Omie (código + nome) com `vigente_desde`. Histórico, não
  sobrescrita: trocar o centro de custo cria linha nova com data.
- **Etapa 3 — extratos:** envio de `.xlsx` Ticketlog e `.csv` Veloe a qualquer hora, períodos sobrepostos; chave
  única = (plataforma, código da transação) — repetido é ignorado, nunca duplicado nem sobrescrito; a cada envio o
  usuário digita o **saldo atual** da plataforma; lista **"sem centro de custo"**; as duas views do E4.

## Regras dos arquivos (do pedido, conferidas nas amostras)

- Ticketlog: aba "Transações", cabeçalho na linha 1. Usa `CODIGO TRANSACAO`, `DATA TRANSACAO`, `NUMERO CARTAO`,
  `VALOR EMISSAO`, `SERVICO`; guarda para a tela `LITROS`, `VL/LITRO`, `HODOMETRO OU HORIMETRO`,
  `NOME ESTABELECIMENTO`, `CIDADE`. **Placa não serve.**
- Veloe: `;`, vírgula decimal. Usa `ID Transacao`, `Data de Utilizacao` + `Hora de Untrada` (sic) — **não** a de
  processamento —, `Placa`, `VeloeTag`, `Valor Cobrado`, `Tipo do Movimento`, `Tipo de Transacao`. "REENVIO DENTRO
  SLA" é cobrança real, não duplicata. Ignorar `CPF/CNPJ`.
- Nome de motorista: dado pessoal — não gravar em log, e-mail nem nas views. (Gravar na tabela só se a tela precisar;
  preferir não gravar.)
- Período inicial: extratos desde 01/08/2026.
- **Nada de escrita no Omie** a partir do Frotas.

## Território de exceção (AGENTS.md): dinheiro + RLS

RLS e grants das tabelas e views novas são tratados com borda: escrita só gestor/admin; leitura das views só
financeiro/gestor/admin; nenhuma guarda que falhe aberta com NULL; upsert que nunca sobrescreve linha já gravada.
Valores em `numeric(12,2)`, nunca float.

## Fora

Cruzar com RH/orçamento/PEF, notas fiscais, Ticketlog pós-pago, qualquer escrita no Omie, mudar a tela Custos.
