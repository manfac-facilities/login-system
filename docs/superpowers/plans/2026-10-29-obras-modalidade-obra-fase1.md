# OBRAS — Fase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separar SPOT/OBRA no Gestão de Obras e pôr no ar, para Macaé 3, cronograma com base e versões, diário de obra no celular, impedimentos com responsável e o e-mail diário (cliente e interno) validado pelo engenheiro.

**Architecture:** OBRA continua sendo uma linha de `obras_obra` (`modalidade = 'obra'`); tudo o que é novo pendura nela em tabelas `obras_*` novas com RLS `obras_has_access()`. Cálculo de cronograma/sinal é uma biblioteca pura em `app/obras/obras/_lib/` (testada sem banco); telas são Server Components + Server Actions sob `app/obras/obras/`. E-mail pelo mesmo SMTP Locaweb (nodemailer) do relatório diário.

**Tech Stack:** Next 16.3.8 (App Router, ler `node_modules/next/dist/docs/` antes de codar), React 19, supabase-js + `@supabase/ssr`, Tailwind v4, nodemailer, Jest 30 + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-29-obras-modalidade-obra-design.md` (seções 5 e 7.1/7.2 mandam). Dados de seed: `docs/cliente/2026-10-29-sgo-especificacao-eduardo.md` §10.1 e §10.5.

## Global Constraints

- Branch `feat/obras-modalidade-obra` a partir de `master`. Commits pequenos, mensagem em pt-BR, com o rodapé de atribuição da sessão.
- SQL num único arquivo novo na raiz: `sdd-sql-obras-modalidade-obra.sql`, idempotente (`if not exists`, `on conflict do nothing`), **aplicado à mão pelo José** no SQL Editor do projeto `iyytcavcgukfjnjjrerx`. Nenhum agente escreve no banco de produção.
- Datas como string ISO `YYYY-MM-DD` (mesmo padrão de `hojeISO()` de `app/obras/_lib/tipos.ts`). Percentuais guardados como fração 0–1.
- Cores do tema: fundo `#0a1628`, navy `#0d2050`, laranja `#f05a28`, texto secundário `#94a3b8`, bordas `#1e3a5f`. Sem shadcn.
- Nunca `export type` num arquivo `'use server'` (derruba a tela em runtime).
- Acesso: `hasSystemAccess(supabase, email, 'obras')` ou `isAdmin(supabase, email)` em toda página e action; guarda falha **fechada**.
- O cliente **nunca** recebe custo, `peso_valor`, valor, fornecedor ou área interna. Impedimento com responsável `manfac` aparece ao cliente só como "Manfac".
- SPOT intocado: sincronização do Field, faturamento e conciliação seguem iguais; a sync nunca grava `modalidade`.

## Review Focus

1. **E-mail vazando dado interno** — um impedimento `exibir_ao_cliente = false` ou um `peso_valor` aparecendo no HTML do lado cliente. Teste em Task 9 (`html do cliente não contém impedimento oculto nem R$`).
2. **Versão salva do cronograma sendo alterada** — update/delete numa atividade de versão já salva tem de falhar no banco (trigger) e na action. Teste em Task 7 + consulta de verificação em Task 1.
3. **Atividade travada indo para Em andamento** — por diário ou pela tabela. Teste em Task 3 (`podeIniciar`) e Task 7/8 (action recusa).
4. **Validar/enviar por quem não é engenheiro da obra nem admin** — action recusa. Teste em Task 9.
5. **OBRA sem cronograma (transferida, legada)** — lista, painel e ficha não quebram e não cobram diário. Teste em Task 5/6 (`obra sem versão salva mostra "sem cronograma"`).

---

### Task 1: Migration SQL + seed de Macaé 3 + carga da classificação

**Files:**
- Create: `sdd-sql-obras-modalidade-obra.sql`
- Create: `docs/obras/2026-10-29-verificacao-modalidade-obra.sql` (consultas que o José roda depois de aplicar)

**Interfaces:**
- Produces (schema que todas as tasks usam):
  - `obras_obra`: `+ modalidade text not null default 'spot' check (modalidade in ('spot','obra'))`, `+ data_base date`, `+ engenheiro_email text`, `+ atividade_trava int`. Índice parcial em `modalidade = 'obra'`.
  - `obras_feriado(data date pk, descricao text not null, abrangencia text check in ('nacional','estadual','municipal','facultativo'))`.
  - `obras_cronograma_versao(id uuid pk, obra_id uuid fk obras_obra, numero int not null, motivo text, criada_por text not null, criada_em timestamptz default now(), salva_em timestamptz, salva_por text, unique(obra_id, numero))`. **Versão 1 = base.** `salva_em is null` = rascunho editável; vigente = maior `numero` com `salva_em` não nulo.
  - `obras_atividade(id uuid pk, versao_id uuid fk, obra_id uuid fk, numero int, frente text, etapa text, descricao text, saida_trava text, pred1 int, pred2 int, duracao int check (duracao >= 1), responsavel_funcao text, bloqueia_por_trava bool default false, peso_valor numeric(14,2) default 0, unique(versao_id, numero))`.
  - **Trigger** `obras_atividade_imutavel`: `before update or delete` (e `insert`) em `obras_atividade` levanta exceção `OBRAS_VERSAO_SALVA` se a versão tem `salva_em` não nulo. Trigger em `obras_cronograma_versao` impede limpar `salva_em` e apagar versão salva.
  - `obras_atividade_exec(obra_id uuid, numero int, status text check in ('nao_iniciado','em_andamento','concluido','bloqueado') default 'nao_iniciado', percentual numeric(5,4) check between 0 and 1 default 0, inicio_real date, fim_real date, atualizado_em timestamptz, atualizado_por text, pk(obra_id, numero))` — execução é da obra, não da versão.
  - `obras_rdo(id uuid pk, obra_id uuid fk, data date, estado text check in ('rascunho','validado','enviado') default 'rascunho', sem_execucao bool default false, motivo_sem_execucao text, efetivo int, equipe_texto text, clima text check in ('sol','nublado','chuva','impraticavel'), programacao_amanha text, registrado_por text, atualizado_em timestamptz, validado_por text, validado_em timestamptz, unique(obra_id, data))`.
  - `obras_rdo_avanco(rdo_id uuid fk on delete cascade, numero int, de numeric(5,4), para numeric(5,4), concluida bool default false, causa text check in ('cliente','material','equipe','clima','projeto','outro'), pk(rdo_id, numero))`.
  - `obras_rdo_foto(id uuid pk, rdo_id uuid fk on delete cascade, path text not null, legenda text, ordem int)`.
  - `obras_impedimento(id uuid pk, obra_id uuid fk, categoria text check in ('impedimento','orientacao'), tipo text, responsavel text check in ('cliente','manfac','terceiro','clima'), atividade_numero int, descricao text not null, pessoa_cliente text, foto_path text, trava_atividade bool default false, impacto_dias numeric(5,1), exibir_ao_cliente bool not null, aberto_em date not null, encerrado_em date, rdo_id uuid, orientacao_id uuid references obras_impedimento, criado_por text, criado_em timestamptz default now())`. `responsavel` obrigatório quando `categoria = 'impedimento'`.
  - `obras_destinatario(id uuid pk, obra_id uuid fk, email text not null, nome text, funcao text, lado text check in ('cliente','interno'), tipos text[] not null check (tipos <@ array['diario','semanal','mensal','imediato']), ativo bool default true, unique(obra_id, lower(email)))`.
  - `obras_envio(id uuid pk, obra_id uuid fk, tipo text, referencia date, rdo_id uuid, lado text, enviado_por text, enviado_em timestamptz default now(), destinatarios text[], resultado text check in ('ok','falha'), detalhe text)` — sem policy de delete/update.
  - RLS habilitada em todas; `select/insert/update` com `obras_has_access()`; `obras_destinatario` insert/update/delete só administrador (`exists hub_user_roles where lower(user_email) = lower(auth.jwt()->>'email') and nivel = 'administrador'`); `obras_envio` só insert/select.
- Seed (mesmo arquivo, bloco final):
  - feriados da §10.5 do Eduardo (10 linhas, abrangências: Finados/Proclamação/Consciência/Natal/Confraternização/Sexta Santa/Tiradentes = nacional; São Jorge = estadual; Carnaval 08 e 09/02/2027 = facultativo).
  - Macaé 3 (`obras_obra.id = 'a6271663-d342-4669-8c32-f9dd97e8aa7c'`, OS `1026-014683`): `modalidade='obra'`, `data_base='2026-10-26'`, `atividade_trava=6`; versão 1 **rascunho** (`salva_em` nulo, `criada_por='seed'`); as 28 atividades da §10.1 (frente, etapa, descrição, saída/trava, pred1, pred2, dias úteis; `bloqueia_por_trava` em 11, 12, 13, 14, 21); `obras_atividade_exec` com nº 6 `em_andamento`, demais `nao_iniciado`.
  - `peso_valor` por atividade (soma dos itens do orçamento do Eduardo, §10.2; conferido: total 506.340,41, indiretos/imposto 68.568,00 fora): 1=6650.00, 2=4500.00, 3=17869.20, 4=5851.00, 5=0, 6=15200.00, 7=11500.00, 8=38000.00, 9=16293.44, 10=0, 11=2100.00, 12=1729.00, 13=438.68, 14=23415.86, 15=49000.00, 16=19500.00, 17=9426.00, 18=28000.00, 19=20000.00, 20=13656.00, 21=2122.50, 22=38254.25, 23=22042.60, 24=24917.60, 25=35648.08, 26=14246.20, 27=13620.00, 28=3792.00 (Σ = 437.772,41).
  - Classificação das obras grandes já existentes como `modalidade='obra'` (sem cronograma): OS `1026-014683`, `PLK-NORTESHOP`, `CDRJ-TELHADO` (lista aprovada pelo José em 29/10; `0426-012516` DP MACAE 2 fica SPOT — só falta faturar a pendência).
  - Histórico: inserir em `obras_historico` uma linha por obra reclassificada (bloco `Classificação`, campo `modalidade`, de `spot` para `obra`, quem `seed`).

- [ ] **Step 1:** Escrever o arquivo SQL conforme acima, em transação, idempotente.
- [ ] **Step 2:** Escrever `docs/obras/2026-10-29-verificacao-modalidade-obra.sql` com: contagem de colunas novas em `obras_obra`; `select count(*) from obras_atividade where obra_id = 'a627…'` = 28; `select sum(peso_valor)` = 437772.41; feriados = 10; lista de OS com `modalidade='obra'`; teste do trigger dentro de `begin … rollback` (salvar a versão 1 e tentar `update obras_atividade set duracao = 9` → erro `OBRAS_VERSAO_SALVA`); RLS ligada em todas as tabelas novas (`pg_class.relrowsecurity`).
- [ ] **Step 3:** Ensaiar o arquivo inteiro dentro de `begin; … rollback;` (o `rollback` final garante que nada fica gravado), pela sessão principal via `execute_sql`. Se o modo de permissão barrar, o José ensaia no SQL Editor. Esperado: sem erro e as consultas do Step 2 com os valores certos antes do `rollback`.
- [ ] **Step 4:** Commit `feat(obras): migration da modalidade OBRA + seed Macaé 3`.

---

### Task 2: Calendário de dias úteis

**Files:**
- Create: `app/obras/obras/_lib/calendario.ts`
- Test: `app/obras/obras/_lib/__tests__/calendario.test.ts`

**Interfaces:**
- Produces:
  - `ehDiaUtil(data: string, feriados: ReadonlySet<string>): boolean`
  - `proximoDiaUtil(data: string, feriados): string` — a própria data se útil, senão o próximo útil.
  - `somarDiasUteis(data: string, n: number, feriados): string` — `WORKDAY` do Excel (n pode ser 0 → devolve `data`; n negativo não é usado).
  - `diasUteisEntre(a: string, b: string, feriados): number` — `NETWORKDAYS` inclusivo; `b < a` → 0.

- [ ] **Step 1: testes** — `ehDiaUtil('2026-10-31')` false (sábado); `ehDiaUtil('2026-11-02', F)` false (Finados); `proximoDiaUtil('2026-10-31', F)` = `'2026-11-03'`; `somarDiasUteis('2026-10-30', 1, F)` = `'2026-11-03'`; `diasUteisEntre('2026-10-26','2026-10-30', F)` = 5; `diasUteisEntre('2026-10-30','2026-11-03', F)` = 2; `diasUteisEntre('2026-11-05','2026-11-04', F)` = 0. Usar `F` = feriados da §10.5.
- [ ] **Step 2:** `npx jest app/obras/obras/_lib/__tests__/calendario.test.ts` → FAIL (módulo não existe).
- [ ] **Step 3:** Implementar com aritmética em UTC (`Date.UTC`) para não sofrer fuso.
- [ ] **Step 4:** Rodar → PASS.
- [ ] **Step 5:** Commit `feat(obras): calendário de dias úteis`.

---

### Task 3: Motor do cronograma (previsto, projetado, situação, desvio, sinal, atribuição)

**Files:**
- Create: `app/obras/obras/_lib/cronograma.ts`
- Test: `app/obras/obras/_lib/__tests__/cronograma.test.ts`

**Interfaces:**
- Consumes: Task 2.
- Produces (todos exportados de `cronograma.ts`):
  ```ts
  type StatusAtividade = 'nao_iniciado' | 'em_andamento' | 'concluido' | 'bloqueado'
  type Responsavel = 'cliente' | 'manfac' | 'terceiro' | 'clima'
  type Situacao = 'concluida' | 'bloqueada' | 'aguardando_cliente' | 'atrasada' | 'inicio_atrasado' | 'no_prazo'
  type AtividadePlano = { numero: number; etapa: string; descricao: string; pred1: number | null; pred2: number | null; duracao: number; bloqueiaPorTrava: boolean; pesoValor: number }
  type AtividadeExec = { numero: number; status: StatusAtividade; percentual: number; inicioReal: string | null; fimReal: string | null }
  type ImpedimentoCalc = { atividadeNumero: number | null; responsavel: Responsavel; travaAtividade: boolean; abertoEm: string; encerradoEm: string | null; impactoDias: number | null }
  type AtividadeCalculada = AtividadePlano & AtividadeExec & { inicioPrevisto: string; fimPrevisto: string; inicioProjetado: string; fimProjetado: string; peso: number; percentualPrevisto: number; situacao: Situacao; travada: boolean }
  type ResultadoCronograma = { atividades: AtividadeCalculada[]; previsto: number; realizado: number; desvioPP: number; terminoPrevisto: string; terminoProjetado: string }
  class CicloNasPredecessoras extends Error {}
  function calcularCronograma(p: { plano: AtividadePlano[]; exec: AtividadeExec[]; dataBase: string; hoje: string; feriados: ReadonlySet<string>; atividadeTrava: number | null; impedimentos: ImpedimentoCalc[] }): ResultadoCronograma
  function podeIniciar(numero: number, plano: AtividadePlano[], exec: AtividadeExec[], atividadeTrava: number | null): { ok: true } | { ok: false; motivo: string }
  function diasDeImpacto(imps: ImpedimentoCalc[], hoje: string, feriados): Record<Responsavel, number>
  function atrasoPorResponsavel(p: { terminoBase: string; terminoProjetado: string; impacto: Record<Responsavel, number>; feriados }): { total: number } & Record<Responsavel, number>
  type Sinal = 'verde' | 'amarelo' | 'vermelho'
  function sinalDaObra(p: { desvioPP: number; terminoProjetado: string; terminoBase: string | null; impedimentoClienteAberto: boolean }): Sinal
  ```
- Regras (spec §5.2 + Eduardo §5 + spec §7.1):
  - **Previsto:** sem predecessoras → `proximoDiaUtil(dataBase)`; com → `somarDiasUteis(max(fimPrevisto pred1, pred2), 1)`; `fimPrevisto = somarDiasUteis(inicio, max(duracao,1) - 1)`. Ciclo → `throw new CicloNasPredecessoras(...)`.
  - **Projetado** (o que move a entrega): concluída → `inicioReal`/`fimReal`; em andamento → início = `inicioReal ?? inicioPrevisto`, fim = `max(fimPrevisto, somarDiasUteis(proximoDiaUtil(hoje), max(ceil(duracao × (1 − percentual)), 1) − 1))`; não iniciada → início = `max(inicioPrevisto, somarDiasUteis(max(fimProjetado preds), 1), proximoDiaUtil(hoje) se inicioPrevisto < hoje)`, fim = `somarDiasUteis(início, duracao − 1)`. Sucessoras sempre partem do **projetado** das predecessoras. `terminoProjetado = max(fimProjetado)`.
  - **Peso** = `pesoValor / Σ pesoValor`; Σ = 0 → peso 0 para todas e `previsto = realizado = 0`.
  - `%previsto(hoje)`: 0 se hoje < inicioPrevisto; 1 se hoje ≥ fimPrevisto; senão `diasUteisEntre(inicio, hoje) / duracao`.
  - `previsto = Σ peso × %previsto`; `realizado = Σ peso × percentual`; `desvioPP = (realizado − previsto) × 100`, arredondado a 1 casa.
  - **Situação**, nesta precedência: concluida (status concluido) → bloqueada (status bloqueado) → **aguardando_cliente** (há impedimento aberto `responsavel='cliente'` e `travaAtividade` nesta atividade) → atrasada (hoje > fimPrevisto) → inicio_atrasado (hoje ≥ inicioPrevisto e nao_iniciado) → no_prazo. Aguardando cliente **não** zera o desvio: o cálculo de previsto/realizado/projetado é o mesmo.
  - `travada` = `bloqueiaPorTrava` e a atividade-trava não está concluída. `podeIniciar` recusa com motivo `"Travada até a atividade 6 ser concluída"`.
  - `diasDeImpacto`: impedimento com `travaAtividade` conta `diasUteisEntre(abertoEm, encerradoEm ?? hoje)`; sem trava conta `impactoDias ?? 0`.
  - `atrasoPorResponsavel`: `total = max(0, diasUteisEntre(terminoBase, terminoProjetado) − 1)`; reparte o total na ordem cliente → clima → terceiro, cada um `min(restante, impacto)`; `manfac` = restante.
  - `sinalDaObra`: vermelho se `desvioPP < −5` ou (`terminoBase` e `terminoProjetado > terminoBase`); amarelo se `desvioPP < 0` ou `impedimentoClienteAberto`; senão verde.

- [ ] **Step 1: testes** com o seed de Macaé (fixture `__tests__/fixtures/macae3.ts` com as 28 atividades e pesos da Task 1):
  - `fimPrevisto` da atividade 1 = `'2026-10-26'`; atividade 4 (pred 3, 3 dias) = `'2026-10-29'` → `'2026-11-03'` (pula fim de semana e Finados); atividade 6 (pred 5, 3 dias) = `'2026-10-30'` → `'2026-11-04'`.
  - ciclo `1→2→1` lança `CicloNasPredecessoras`.
  - com hoje = `'2026-10-29'`, atividade 1 não iniciada → situação `atrasada`; atividade 3 com impedimento cliente+trava aberto → `aguardando_cliente`.
  - `podeIniciar(11, …)` com nº 6 em andamento → `{ ok: false, motivo: 'Travada até a atividade 6 ser concluída' }`; com nº 6 concluída → `{ ok: true }`.
  - atividade 6 em andamento 70% e duração 3, hoje 2026-11-10 (atrasada) → `fimProjetado` > `fimPrevisto` e sucessora 7 começa no dia útil seguinte ao `fimProjetado` de 6.
  - `atrasoPorResponsavel({ terminoBase:'2027-02-10', terminoProjetado:'2027-02-17', impacto:{cliente:4,clima:0,terceiro:0,manfac:0} })` → `{ total: 5, cliente: 4, clima: 0, terceiro: 0, manfac: 1 }`.
  - `sinalDaObra({desvioPP:-2, terminoProjetado:'2027-02-10', terminoBase:'2027-02-10', impedimentoClienteAberto:false})` → `'amarelo'`; `-6` → `'vermelho'`; `0` sem impedimento → `'verde'`.
  - Σ pesoValor = 0 → `previsto` 0 e sem divisão por zero.
- [ ] **Step 2:** Rodar → FAIL.
- [ ] **Step 3:** Implementar (ordenação topológica para previsto e projetado).
- [ ] **Step 4:** Rodar → PASS.
- [ ] **Step 5:** Commit `feat(obras): motor do cronograma da OBRA`.

---

### Task 4: Leitura da obra (camada de dados compartilhada pelas telas e pelo e-mail)

**Files:**
- Create: `app/obras/obras/_lib/leitura.ts`
- Test: `app/obras/obras/_lib/__tests__/leitura.test.ts`

**Interfaces:**
- Consumes: Task 3.
- Produces:
  ```ts
  type ObraGrande = { obra: ObraRow; versaoBase: VersaoInfo | null; versaoVigente: VersaoInfo | null; rascunho: VersaoInfo | null; plano: AtividadePlano[]; exec: AtividadeExec[]; impedimentos: ImpedimentoRow[]; feriados: Set<string>; calc: ResultadoCronograma | null; terminoBase: string | null; sinal: Sinal | null; atraso: ReturnType<typeof atrasoPorResponsavel> | null }
  type VersaoInfo = { id: string; numero: number; salvaEm: string | null; motivo: string | null }
  async function lerObraGrande(supabase: SupabaseClient, obraId: string, hoje: string): Promise<{ ok: true; dados: ObraGrande } | { ok: false; erro: string }>
  ```
  `plano` = atividades da **vigente**; se não houver vigente, do rascunho; se não houver nenhuma, `[]` e `calc/sinal/atraso = null` ("sem cronograma"). `terminoBase` = `terminoPrevisto` da versão 1 salva (recalculado com o plano da v1). `ImpedimentoRow` = linha de `obras_impedimento` em camelCase.
- [ ] **Step 1: testes** com supabase mockado (padrão `app/obras/diario/__tests__/agendamento-actions.test.ts`): obra sem versão → `calc === null`; obra com v1 salva e v2 salva → plano é da v2 e `terminoBase` vem da v1; erro de qualquer leitura → `{ ok: false }`.
- [ ] **Step 2–4:** FAIL → implementar (leituras em `Promise.all`) → PASS.
- [ ] **Step 5:** Commit `feat(obras): leitura consolidada da OBRA`.

---

### Task 5: Classificação SPOT/OBRA nas telas existentes

**Files:**
- Modify: `app/obras/base/page.tsx:40` — consulta com `.eq('modalidade','spot')`; subtítulo continua.
- Modify: `app/obras/diario/page.tsx:66,83` — `.eq('modalidade','spot')` nas duas consultas.
- Modify: `app/obras/tarefas/page.tsx:68` — idem.
- Modify: `app/obras/_ui/abas-obras.tsx` — nova aba `{ href: '/obras/obras', label: 'OBRAS' }` depois de "Base de obras"; renomear rótulo "Base de obras" para "Base SPOT".
- Modify: `app/obras/_lib/historico.ts` — `BlocoHistorico` + `'Classificação'`; `CampoHistorico` + `'modalidade'`; `ROTULO_CAMPO.modalidade = 'Modalidade'`; `COLUNA_PARA_CAMPO.modalidade = 'modalidade'`.
- Modify: `app/obras/_lib/tipos.ts` — `ObraRow` ganha `modalidade: 'spot' | 'obra'`, `data_base: string | null`, `engenheiro_email: string | null`, `atividade_trava: number | null`.
- Modify: `app/obras/obra/[id]/_actions.ts` — nova action `alterarModalidadeAction(obraId: string, modalidade: 'spot' | 'obra'): Promise<{ ok: true } | { ok: false; erro: string }>`, só admin, via `gravarComHistorico` (bloco `Classificação`), `revalidatePath('/obras/base')`, `('/obras/obras')`, `('/obras/obra/'+id)`.
- Modify: `app/obras/obra/[id]/_ficha.tsx` — no cabeçalho, para admin, botão "Tornar OBRA" / "Voltar para SPOT"; quando `modalidade='obra'`, link "Abrir na aba OBRAS →" para `/obras/obras/<id>`.
- Test: `app/obras/obra/[id]/__tests__/modalidade-actions.test.ts`; ajustar testes existentes que montam `ObraRow` (adicionar os campos novos nas fixtures).

- [ ] **Step 1: testes** — não-admin → `{ ok:false, erro:'Só administrador reclassifica' }` sem chamada ao banco; admin → `gravarComHistorico` chamado com `campos: { modalidade: 'obra' }` e uma linha de histórico `Classificação · modalidade spot → obra`; valor fora de `spot|obra` → erro.
- [ ] **Step 2–4:** FAIL → implementar → PASS; `npm test` inteiro (as 106 suítes do hub verdes; as 7 de `manfac-site/` falham por resolução de módulo e não contam).
- [ ] **Step 5:** Confirmar que `app/obras/sincronizar/_execucao.ts` não inclui `modalidade` nos campos de update/insert (grep); se incluir, remover. Teste existente da sync segue verde.
- [ ] **Step 6:** Commit `feat(obras): classificação SPOT/OBRA e aba OBRAS`.

---

### Task 6: Lista OBRAS e painel da obra

**Files:**
- Create: `app/obras/obras/page.tsx` (lista), `app/obras/obras/[id]/layout.tsx` (cabeçalho da obra + abas internas: Painel · Cronograma · Diário · Impedimentos · Comunicação), `app/obras/obras/[id]/page.tsx` (painel), `app/obras/obras/_ui/sinal.tsx` (selo verde/amarelo/vermelho + rótulos "No prazo"/"Atenção"/"Atrasado").
- Test: `app/obras/obras/__tests__/painel.test.tsx`

**Interfaces:**
- Consumes: Task 4 `lerObraGrande`.
- Lista: obras `modalidade='obra'`, colunas: loja, OS, cliente, sinal (ou "sem cronograma"), % previsto × realizado, previsão de entrega, último diário enviado (`max(obras_envio.referencia)` tipo `diario`).
- Painel (spec §5.6): sinal; previsto/realizado/desvio; previsão de entrega com "(+N dias: X do cliente, Y da Manfac…)" quando `atraso.total > 0`; atividades atrasadas e aguardando cliente; impedimentos abertos agrupados por responsável com "há N dias"; trava ativa ("Demolições travadas até a atividade 6"); estado do diário de hoje (não iniciado/rascunho/validado/enviado) com botão "Preencher diário de hoje"; último envio.
- Obra sem cronograma: painel mostra "Esta OBRA ainda não tem cronograma" + link para a aba Cronograma; nada de diário cobrado.
- [ ] **Step 1: testes** de render (Testing Library) do componente de painel com `ObraGrande` fixture: sem cronograma → texto "ainda não tem cronograma" e nenhum botão de diário; com atraso `{total:5, cliente:4, manfac:1}` → texto `+5 dias: 4 do cliente, 1 da Manfac`.
- [ ] **Step 2–4:** FAIL → implementar → PASS.
- [ ] **Step 5:** Commit `feat(obras): lista OBRAS e painel da obra`.

---

### Task 7: Cronograma — editar rascunho, salvar base, criar revisões

**Files:**
- Create: `app/obras/obras/[id]/cronograma/page.tsx`, `_tabela.tsx` (client), `_actions.ts`
- Test: `app/obras/obras/[id]/cronograma/__tests__/actions.test.ts`

**Interfaces:**
- Actions (todas `'use server'`, sem `export type`; tipos em `_tipos.ts` ao lado):
  - `salvarLinhaRascunhoAction(obraId: string, versaoId: string, linha: LinhaPlano): Promise<Resultado>` — edita descrição, etapa, pred1/2, duração, `bloqueiaPorTrava`; recusa se a versão está salva; recusa se gera ciclo (usa `calcularCronograma` para validar).
  - `salvarVersaoAction(obraId: string, versaoId: string, motivo: string | null): Promise<Resultado>` — grava `salva_em/salva_por`; motivo obrigatório para `numero > 1`.
  - `criarRevisaoAction(obraId: string): Promise<Resultado & { versaoId?: string }>` — copia as atividades da vigente para uma nova versão `numero = vigente + 1` em rascunho; recusa se já existe rascunho.
  - `atualizarExecucaoAction(obraId: string, numero: number, campos: { status?: StatusAtividade; percentual?: number; inicioReal?: string | null; fimReal?: string | null }): Promise<Resultado>` — recusa `em_andamento`/`concluido`/percentual > 0 quando `podeIniciar` é falso; `concluido` força percentual 1 e exige `fimReal`.
  - `Resultado = { ok: true } | { ok: false; erro: string }`. Quem pode: engenheiro da obra (`obras_obra.engenheiro_email`) ou admin.
- Tela: tabela com colunas nº, etapa, atividade, pred., dias úteis, início/fim previsto, início/fim projetado, status, %, situação (cores por situação; cadeado nas travadas). Cabeçalho: "Base (v1) salva em …" / "Vigente: v3 — motivo …" / botões "Salvar base", "Nova revisão", "Salvar revisão". Comparação simples: término da base × término vigente × término projetado.
- [ ] **Step 1: testes** — editar linha de versão salva → `{ ok:false, erro:'Versão salva não se altera — crie uma revisão' }`; salvar v2 sem motivo → erro; criar revisão com rascunho já existente → erro; `atualizarExecucaoAction(…, 11, { status:'em_andamento' })` com 6 não concluída → `{ ok:false, erro:'Travada até a atividade 6 ser concluída' }`; usuário que não é engenheiro nem admin → erro de permissão.
- [ ] **Step 2–4:** FAIL → implementar → PASS.
- [ ] **Step 5:** Commit `feat(obras): cronograma base e revisões`.

---

### Task 8: Diário de obra no celular (rascunho, fotos, avanço, sem execução)

**Files:**
- Create: `app/obras/obras/[id]/diario/page.tsx` (`?data=YYYY-MM-DD`, padrão hoje), `_passos.tsx` (client, os 5 passos do mockup `celular-supervisor.html`), `_fotos.tsx` (client, várias fotos), `_actions.ts`, `_tipos.ts`
- Reuse: compressão de `app/obras/diario/_foto.tsx` / `lib/sofia/comprimirImagem.ts` (1600 px / 0.82).
- Test: `app/obras/obras/[id]/diario/__tests__/actions.test.ts`, `__tests__/passos.test.tsx`

**Interfaces:**
- Actions:
  - `salvarRascunhoAction(obraId: string, data: string, corpo: RascunhoRdo): Promise<Resultado & { rdoId?: string }>` — upsert de `obras_rdo` (estado só `rascunho`), substitui as linhas de `obras_rdo_avanco`; recusa se o diário daquele dia já está `validado`/`enviado`; recusa `para > de` em atividade travada; `para < de` permitido só com `causa`.
  - `RascunhoRdo = { semExecucao: boolean; motivoSemExecucao: string | null; efetivo: number | null; equipeTexto: string | null; clima: 'sol'|'nublado'|'chuva'|'impraticavel' | null; programacaoAmanha: string | null; avancos: { numero: number; de: number; para: number; concluida: boolean; causa: CausaNaoAndou | null }[] }`
  - `registrarFotoAction(rdoId: string, path: string, legenda: string | null): Promise<Resultado>` e `removerFotoAction(fotoId: string)`; upload direto do browser para `obras-fotos` em `${obraId}/rdo/${data}/${crypto.randomUUID()}.jpg`.
- Pré-preenchimento (no server, ao abrir um dia sem rascunho): `efetivo`/`equipeTexto` do último RDO da obra; avanços = atividades `em_andamento` + não iniciadas com `inicioPrevisto ≤ data`, com `de` = percentual atual; `programacaoAmanha` sugerida com as atividades cujo `inicioPrevisto` = próximo dia útil.
- "Sem execução hoje": marca `semExecucao`, exige `motivoSemExecucao`, esconde os passos de equipe/avanço; o passo de impedimento (Task 9b) continua.
- Quem preenche: qualquer usuário com acesso `obras`. Obra sem cronograma → página mostra "Sem cronograma — o diário começa quando a base for salva".
- [ ] **Step 1: testes** — salvar rascunho de dia validado → erro `'Diário já validado'`; avanço em atividade travada → erro de trava; `para < de` sem causa → erro; sem execução sem motivo → erro; render de `_passos` mostra cadeado e desabilita o controle da atividade travada.
- [ ] **Step 2–4:** FAIL → implementar → PASS.
- [ ] **Step 5:** Verificar a policy do bucket `obras-fotos` aceita o caminho `{obra_id}/rdo/...` (ler `sdd-sql-obras-v0.sql:365-383`); se a policy amarrar o formato do path, incluir a alteração no SQL da Task 1 e avisar o José.
- [ ] **Step 6:** Commit `feat(obras): diário de obra no celular`.

---

### Task 9a: Impedimentos e orientações

**Files:**
- Create: `app/obras/obras/[id]/impedimentos/page.tsx`, `_form.tsx`, `_actions.ts`, `_tipos.ts`; o passo 4 do diário (`_passos.tsx`) usa o mesmo `_form.tsx`.
- Test: `app/obras/obras/[id]/impedimentos/__tests__/actions.test.ts`

**Interfaces:**
- `abrirImpedimentoAction(obraId: string, i: NovoImpedimento): Promise<Resultado & { id?: string }>`; `encerrarImpedimentoAction(id: string, encerradoEm: string): Promise<Resultado>`; `registrarOrientacaoAction(obraId: string, o: NovaOrientacao)`; `ligarDescumprimentoAction(impedimentoId: string, orientacaoId: string)`.
- Tipos (chips da tela, rótulos exatos): `'Área não liberada' | 'Cliente no local' | 'Serviço danificado pelo cliente' | 'Orientação descumprida' | 'Decisão pendente do cliente' | 'Material do cliente' | 'Material Manfac' | 'Equipe' | 'Clima' | 'Outro'`. Responsável padrão sugerido pelo tipo (os 6 primeiros → cliente; Material Manfac/Equipe → manfac; Clima → clima); editável.
- `exibir_ao_cliente` padrão: `true` para cliente/clima, `false` para manfac/terceiro.
- Lista: abertos primeiro ("aguardando cliente há N dias úteis"), encerrados depois; filtros por responsável.
- [ ] **Step 1: testes** — sem descrição → erro; impedimento sem responsável → erro; padrão de `exibir_ao_cliente` por responsável; encerrar com data anterior à abertura → erro.
- [ ] **Step 2–4:** FAIL → implementar → PASS.
- [ ] **Step 5:** Commit `feat(obras): impedimentos e orientações`.

---

### Task 9b: E-mail diário (cliente e interno) + validar e enviar

**Files:**
- Create: `app/obras/obras/_lib/email-diario.ts` (puro), `app/obras/obras/_lib/enviar.ts` (nodemailer, padrão de `app/api/obras/relatorio-diario/route.ts:120-146`), `app/obras/obras/[id]/diario/_validar.tsx`
- Modify: `app/obras/obras/[id]/diario/_actions.ts` — `validarEEnviarAction`
- Test: `app/obras/obras/_lib/__tests__/email-diario.test.ts`, `app/obras/obras/[id]/diario/__tests__/validar.test.ts`

**Interfaces:**
- `montarEmailDiario(p: { lado: 'cliente' | 'interno'; obra: ObraGrande; rdo: RdoCompleto; validadoPor: string; validadoEm: string; diaN: number; fotosCid: { cid: string; legenda: string | null }[] }): { assunto: string; html: string; texto: string }` — assunto `"Diário de obra · <loja> · dia <N> · <dd/mm/aaaa>"`. Blocos na ordem da spec §5.4: cabeçalho ("validado por … às hh:mm"), sinal + previsão de entrega (com a quebra por responsável quando houver atraso), três números (% previsto, % realizado, dias de impacto do cliente), "Onde está travado" (impedimentos abertos com `exibirAoCliente` no lado cliente; todos no interno, com o responsável real; trava técnica como item próprio), "O que a Manfac fez hoje" (avanços de→para, concluídas, fotos), "Amanhã". Dia sem execução: frase "Sem execução hoje — <motivo>" no lugar do bloco de avanços. HTML com tabelas e estilos inline (cliente de e-mail), largura 600 px.
- `enviarEmail(p: { para: string[]; assunto: string; html: string; texto: string; anexos: { cid: string; nome: string; conteudo: Buffer }[] }): Promise<{ ok: true } | { ok: false; erro: string }>` — env `SMTP_HOST/USUARIO/SENHA/REMETENTE/PORTA`; um e-mail por destinatário (como o relatório atual); falta de env → erro sem enviar.
- `validarEEnviarAction(obraId: string, data: string): Promise<Resultado & { enviados?: number }>`:
  1. só `engenheiro_email` da obra ou admin;
  2. RDO do dia em `rascunho`; aplica `obras_rdo_avanco.para/concluida` em `obras_atividade_exec` (com `podeIniciar`), marca `validado`;
  3. baixa até 6 fotos do bucket com `createAdminClient()`, redimensiona se > 300 KB, anexa por CID;
  4. destinatários ativos com tipo `diario`: lado cliente recebe `montarEmailDiario({lado:'cliente'})`, lado interno recebe `({lado:'interno'})`;
  5. grava um `obras_envio` por lado (resultado e destinatários) e marca o RDO `enviado` se ao menos um lado foi `ok`;
  6. sem nenhum destinatário cliente cadastrado → valida, não envia, devolve `{ ok:false, erro:'Cadastre os destinatários na aba Comunicação' }`.
- [ ] **Step 1: testes de `montarEmailDiario`** — html do cliente **não** contém impedimento com `exibirAoCliente:false`, nem `R$`, nem `pesoValor`; impedimento `manfac` aparece como "Manfac" sem o tipo interno; html interno contém o impedimento oculto; sinal vermelho mostra "Atrasado"; atraso `{total:5,cliente:4,manfac:1}` → "+5 dias: 4 do cliente, 1 da Manfac"; dia sem execução mostra "Sem execução hoje — Área não liberada pela loja".
- [ ] **Step 2: testes da action** — usuário comum → erro; rascunho inexistente → erro; sucesso chama `enviarEmail` uma vez por destinatário e grava 2 `obras_envio`; falha de SMTP grava `resultado:'falha'` e mantém `validado`.
- [ ] **Step 3–5:** FAIL → implementar → PASS.
- [ ] **Step 6:** Prévia: rota `GET` não; em vez disso, botão "Ver prévia" em `_validar.tsx` renderiza o HTML do lado cliente num `<iframe srcDoc>` antes de enviar.
- [ ] **Step 7:** Commit `feat(obras): e-mail diário da OBRA`.

---

### Task 10: Comunicação e configuração da obra (admin)

**Files:**
- Create: `app/obras/obras/[id]/comunicacao/page.tsx`, `_destinatarios.tsx`, `_config.tsx`, `_actions.ts`
- Test: `app/obras/obras/[id]/comunicacao/__tests__/actions.test.ts`

**Interfaces:**
- `salvarDestinatarioAction(obraId: string, d: { id?: string; email: string; nome: string | null; funcao: string | null; lado: 'cliente'|'interno'; tipos: ('diario'|'semanal'|'mensal'|'imediato')[]; ativo: boolean }): Promise<Resultado>` — só admin; e-mail validado e minúsculo; `tipos` não vazio.
- `salvarConfigObraAction(obraId: string, c: { engenheiroEmail: string | null; dataBase: string | null; atividadeTrava: number | null }): Promise<Resultado>` — só admin; `engenheiroEmail` precisa ter acesso `obras` (`hasSystemAccess`) ou ser admin; `dataBase` só muda enquanto a v1 não foi salva.
- Tela: lista de destinatários (cliente e interno separados), formulário inline; bloco "Configuração" (engenheiro, data-base, atividade-trava); histórico de envios (`obras_envio`, mais recente primeiro: tipo, data de referência, lado, destinatários, resultado, quem enviou).
- [ ] **Step 1: testes** — não-admin → erro; e-mail inválido → erro; `tipos: []` → erro; engenheiro sem acesso `obras` → erro; mudar data-base com v1 salva → erro `'A base já foi salva — a data-base não muda'`.
- [ ] **Step 2–4:** FAIL → implementar → PASS.
- [ ] **Step 5:** Commit `feat(obras): comunicação e configuração da OBRA`.

---

### Task 11: Entrega

**Files:**
- Modify: `.claude/rules/obras.md` — seção curta "OBRAS (modalidade obra) — desde 29/10/2026": onde fica, tabelas, regra da base imutável, onde mora o e-mail.
- Modify: `docs/DIVIDAS.md` — o que ficou de fora de propósito (clima automático, ronda de pontos fixos, PPC, semanal).

- [ ] **Step 1:** `npm run lint`, `npx tsc --noEmit`, `npm test` → verdes (fora as 7 do `manfac-site/`). `npm run build` → sucesso.
- [ ] **Step 2:** Code review do branch inteiro (`superpowers:requesting-code-review`), corrigir o que for confirmado.
- [ ] **Step 3:** Entregar ao José, nesta ordem: (a) confirmar a lista de OS a reclassificar no SQL; (b) ele aplica `sdd-sql-obras-modalidade-obra.sql`; (c) roda `docs/obras/2026-10-29-verificacao-modalidade-obra.sql` e cola o resultado; (d) merge em `master`, push; (e) Deploy no EasyPanel; (f) conferir `Last-Modified` dos chunks em `hub.manfac.com.br`.
- [ ] **Step 4:** Smoke em produção com o José: aba OBRAS lista Macaé 3, PLK, Telhado, Macaé 2; Base SPOT não lista essas; engenheiro salva a base de Macaé; José cadastra o próprio e-mail como destinatário cliente; supervisor preenche um diário de teste; "Ver prévia"; "Validar e enviar" chega no e-mail do José. Só depois cadastrar os e-mails da DPSP.
- [ ] **Step 5:** Commit `docs(obras): estado da modalidade OBRA`.
