---
paths:
  - "app/(operacoes)/sofia/**"
  - "lib/sofia/**"
---

# Sofia (Gestão de Frotas)

O código diz "sofia" em todo lugar (rotas, `lib/sofia/`, funções SQL `sofia_*`); o
cliente e a UI dizem **Gestão de Frotas**. É o mesmo sistema — já causou confusão.

## Onde fica o quê

- `app/(operacoes)/sofia/` — 15 subrotas, dentro do route group `(operacoes)` cujo
  `layout.tsx` exige sessão e monta `components/sofia/Sidebar.tsx`.
- `lib/sofia/` — domínio: `queries.ts` (leituras `get*`), `types.ts`, `enums.ts`,
  `auditLog.ts`, `autorizacao.ts`, `kmValidation.ts`, `veiculos.ts`, `pendencias.ts`,
  `uploadFotos.ts`, `useVeiculoMotoristaCascade.ts` (hook client que chama
  `app/api/sofia/veiculo-motorista/route.ts`). Testes em `lib/sofia/__tests__/`.
- `components/sofia/` — Sidebar e componentes de UI (câmera, galeria, formulários).
- Server Actions ficam em `_actions.ts` ao lado de cada subrota; testes em `__tests__/`
  ao lado do código testado, nome = arquivo testado + `.test.ts` (ou
  `.<recorte>.test.ts` quando há mais de um teste para o mesmo arquivo, ex.:
  `_actions.criar.test.ts` em sinistros).
- **Subrotas sem teste de `_actions.ts`:** `documentos`, `pendencias`,
  `disponibilidade`, `audit`. São as ações escritas antes do
  `v04-seguranca` (anterior a 2026-08) — não há garantia de cobertura indireta via
  outro teste. `motoristas`, `revisoes` (e `checklist`) têm só a action de
  exclusão/desativação coberta, em `_actions.exclusao.test.ts` (26/10/2026).

## A pegadinha do re-export

`app/(operacoes)/sofia/km/_validation.ts` é só:
```ts
export { validateKmAtual } from '@/lib/sofia/kmValidation'
```
Quem procurar a validação de KM pelo nome do arquivo acha uma casca vazia. A lógica de
verdade (checar `NaN` e valor negativo) está em `lib/sofia/kmValidation.ts`. Ao mexer em
validação de KM, edite lá — o arquivo em `km/` não deve ganhar lógica própria.

## Quem pode gerir frotas: `sofia_pode_gerir()` — nunca o admin do hub direto

Desde 26/10/2026 (branch `feat/frotas-gestor`, decisão D2 em
`docs/frotas/2026-10-26-decisoes-joao.md`; spec e revisão em `docs/frotas/2026-10-26-*gestor*`)
existe o papel **gestor de frotas**: pode, só dentro do Sofia, tudo o que o administrador do hub
pode (inclusive desconto em salário e exclusões), e nada fora dele.

- **Regra, num lugar só:** função `public.sofia_pode_gerir()` = admin do hub **OU** (linha em
  `public.sofia_gestores` **E** `hub_system_access` `sofia`/`has_access = true`). Sempre
  `true`/`false`. Tirar o slug `sofia` em `/admin/acessos` tira o papel junto.
- **App:** toda ação restrita do Sofia pergunta `requireGestorFrotas`/`podeGerirFrotas`
  (`lib/sofia/permissoes.ts`), que chama a RPC `sofia_pode_gerir` — a mesma função dos triggers,
  então app e banco não divergem. Falha fechado: só `data === true` libera. As 5 telas que
  escondem ação (Multas, Equipes, KM, Sinistros, Descontos) usam o mesmo helper.
- **Proibido** importar `@/lib/auth/requireAdmin` ou `@/lib/auth/roles` em qualquer `.ts`/`.tsx`
  do Sofia — `lib/sofia/__tests__/sem-admin-do-hub.test.ts` falha. Action nova restrita nasce com
  `requireGestorFrotas`.
- **Conceder/retirar:** só SQL como `postgres` (PAT ou SQL Editor), comandos na spec §1.4. A tabela
  não tem policy nem grant para `anon`/`authenticated` — nunca criar policy de escrita.
- **Estado:** `sdd-sql-sofia-gestor-frotas.sql` **aplicado em 28/10/2026** (ver `.claude/rules/sql.md`). O
  app novo depende da função: **SQL antes do deploy**, senão a RPC falha e até o admin perde as
  ações do Sofia.

## Autorização e os triggers que bloqueiam escrita

As 18 tabelas do Sofia têm policy `sofia access` (`using (sofia_has_access())`), lida
por `lib/auth/roles.ts`. Além da RLS, há **triggers `before` que rodam para qualquer
role**, inclusive `service_role`/`postgres` — porque são `security definer` e leem
`auth.jwt()`, que é NULL fora de uma sessão de usuário real. Editar as colunas abaixo
pelo SQL Editor ou pela Management API **falha** com "Apenas administradores..." (depois da
migration do gestor de frotas: "Apenas administradores ou gestores de frotas...", e os triggers
passam a checar `sofia_pode_gerir() is not true`).
Contorno documentado: `alter table ... disable trigger ...`, corrigir, reabilitar.

- `sofia_bloquear_autorizacao_nao_admin` (definida em `sdd-sql-v04-seguranca.sql`):
  - `multas`: `autorizacao_status`, `valor_descontado`, `status`.
  - `sinistros`: `autorizacao_status`, `valor_descontado`, `status_desconto`.
  - `km_excedido_desconto`: `autorizacao_status`.
  - Bloqueia também **DELETE** direto em `multas`, `sinistros`, `km_excedido_desconto`
    (achado da security review "Vuln 2" — sem isto, RLS sozinha deixava apagar
    contornando `excluirMultaAction`/`excluirSinistroAction`).
- `sofia_bloquear_escrita_nao_admin` (mesmo arquivo, achado "Vuln 1"):
  - `equipes.ativo` (UPDATE), `veiculos.valor_locacao_mensal` (UPDATE).
  - `centro_custo_historico` (bloqueia INSERT inteiro).
  - `abastecimentos` e `km_diario` (bloqueiam DELETE inteiro).

**Armadilha de PL/pgSQL nessas duas functions:** o `if` de tabela é sempre **externo**
(`if TG_TABLE_NAME = 'equipes' then ... new.ativo ...`), nunca
`if TG_TABLE_NAME = 'x' and new.coluna...` — porque `veiculos` não tem `ativo` e
`equipes` não tem `valor_locacao_mensal`; um `and` na mesma expressão resolve
`new.coluna` mesmo na tabela errada e explode com `42703 record "new" has no field`.
Esse bug passou por dois code reviews e um `/security-review` e só apareceu na
primeira escrita real — ao adicionar uma tabela/coluna nova a uma trigger
compartilhada, replique o `if` externo.

## Functions security definer (Track C)

Em `sdd-sql-track-c-integridade.sql`, todas guardadas com `is not true` (nunca `not`,
porque `sofia_has_access()`/`sofia_is_admin()` podem devolver NULL e `not null` é NULL,
o que deixaria a guarda falhar aberta):

- `lancar_km_atomico(...)` — guardada por `sofia_has_access() is not true`.
- `atribuir_responsabilidade_veiculo(...)` — mesma guarda.
- `excluir_multas_em_massa(uuid[])` — guardada por `sofia_is_admin() is not true` (depois de
  `sdd-sql-sofia-gestor-frotas.sql`: `sofia_pode_gerir() is not true`); usa
  `auth.uid()` do JWT internamente, não parâmetro (é `security definer`, então ignora
  RLS por definição — a guarda dentro da function é a única proteção).

`execute` foi **revogado de `public` e `anon`** nas três, no fim do arquivo — só
`authenticated` chama.

## Extratos Ticketlog/Veloe (Etapas 2 e 3) — só inserção, centro de custo na leitura

Design `docs/superpowers/specs/2026-10-28-frotas-extratos-cadastros-design.md` (E1–E4); SQL
`sdd-sql-sofia-extratos.sql` (**NÃO APLICADO**, ver `.claude/rules/sql.md`). Telas em
`app/(operacoes)/sofia/extratos/{cadastros,enviar,gastos,sem-centro-custo,historico}` (mockup aprovado 28/10; leituras em
`lib/sofia/extratos/leituras.ts`, funções puras em `agrupar.ts`); backend em `lib/sofia/extratos/` (leitura pura dos arquivos) e
`app/(operacoes)/sofia/extratos/_actions.ts`.

- **Nada é atualizado nem apagado.** Linha de extrato: `ON CONFLICT (plataforma, codigo_transacao) DO
  NOTHING`. Ligação cartão/tag→equipe e equipe→centro de custo: linha nova com `vigente_desde`; na
  mesma data, a registrada por último vale (é assim que se corrige).
- **Equipe e centro de custo não são gravados na linha** (E2): a view `sofia_extrato_consumo` resolve
  na data de uso e diz o motivo (`sem_equipe` | `sem_centro_custo`). Mover um cartão de equipe não muda
  o passado dele.
- **Placa da Ticketlog não serve** (vem errada); a chave é o cartão. Na Veloe a chave é a `VeloeTag`.
  Data de uso da Veloe é a de **utilização**, nunca a de processamento.
- **Nome de motorista, CPF/CNPJ e matrícula não são lidos** — não existe coluna para eles.
- O financeiro lê só pelas views `sofia_extrato_*_financeiro` (funções definer, guarda
  `sofia_extrato_pode_ler()`); as tabelas ficam com a RLS do Sofia.

## Functions de correção (F1–F3) — security INVOKER

Em `sdd-sql-sofia-correcoes-f1-f3.sql` (**NÃO APLICADO**; depende do SQL do gestor), as três
guardadas por `sofia_pode_gerir() is not true` e **security invoker** — a RLS `sofia access`
continua valendo e a guarda só estreita para admin/gestor:

- `corrigir_km_atomico(p_km_id, p_km_novo, p_motivo)` — KM entre o lançamento anterior e o
  seguinte do mesmo veículo; recalcula `veiculos.km_atual` = maior lançamento. Trava veículo
  antes do lançamento (mesma ordem de `lancar_km_atomico`). Devolve `{placa, veiculo_id, data,
  km_veiculo_antes, km_veiculo_depois}`. **Não mexe em `km_excedido_desconto`**: a action
  `corrigirKmAction` só avisa quando o mês tem registro (regra pendente do João, `docs/DIVIDAS.md`).
- `corrigir_abastecimento(p_abastecimento_id, p_litros, p_valor, p_km, p_motivo)` — KM só é
  comparado com o vizinho mais próximo **que tem KM** quando muda; não mexe em `km_atual`.
- `editar_equipe_atomico(p_equipe_id, p_codigo, p_motorista_id)` — código e motorista; no máximo
  um motorista ativo por equipe depois de salvar; fecha/reabre `veiculo_responsabilidade_historico`;
  **nunca** troca o carro (só o checklist troca). Trava veículos → equipe → motoristas.

Nenhuma das três usa `logAudit`: o antes/depois vai em `audit_log.dados` (jsonb, `operacao =
'corrigiu'` ou `'atualizou'`) na mesma transação. A aba "Histórico de correções" de `/sofia/audit`
e o chip "corrigido"/"era X km" leem dali (`lib/sofia/correcoes.ts`, `getCorrecoes`).

**Mensagem pós-ação pela URL:** só id + código fixo (`?corrigido=<veiculo_id>&aviso=registro`,
`?editada=<equipe_id>`, `?corrigido=1`); o texto e os números são relidos do banco. Nunca
renderizar texto livre de `searchParams` — link forjado mostraria mensagem falsa dentro do sistema.
