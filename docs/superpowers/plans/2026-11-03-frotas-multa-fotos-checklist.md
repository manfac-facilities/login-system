# Plano — Frotas terceira bateria: Multa, Pendências, fotos/avaria e histórico do checklist (03/11/2026)

Spec: `docs/superpowers/specs/2026-11-03-frotas-multa-fotos-checklist-design.md` (o SQL completo dos dois arquivos está
nas §3.8 e §3.9 dela). Mockup: `docs/frotas/mockups/2026-11-03-mockup-multa-fotos-checklist.html`. Decisões:
`docs/frotas/2026-11-03-decisoes-terceira-bateria.md`.

Branch/worktree próprio a partir de `master`: `feat/frotas-multa-fotos-checklist`. Território de exceção (autorização,
dinheiro, RLS, dado de cliente): **revisão independente obrigatória** do SQL e das actions de multa antes do merge; quem
implementa não revisa.

## Divisão de arquivos com a frente paralela (Manutenção/bases)

**Dona exclusiva desta frente:** `lib/sofia/pendencias.ts` (+ teste) e `app/(operacoes)/sofia/multas/**`.
**Também desta frente** (fora das pastas declaradas da outra; conferir com o coordenador antes de começar):
`app/(operacoes)/sofia/checklist/**`, `app/(operacoes)/sofia/sinistros/novo/_form.tsx`,
`app/(operacoes)/sofia/sinistros/_actions.ts` (+ testes), `components/sofia/CameraCapture.tsx`,
`lib/sofia/uploadFotos.ts`, arquivos novos listados abaixo.
**Só leitura:** `lib/sofia/permissoes.ts`, `lib/sofia/types.ts`, `lib/sofia/queries.ts`,
`lib/sofia/bases/responsabilidade.ts`, `components/sofia/Sidebar.tsx` (não muda).
**Compartilhados → só na Tarefa 9 (INTEGRAÇÃO):** `app/(operacoes)/sofia/pendencias/page.tsx`,
`app/(operacoes)/sofia/descontos/{page.tsx,_actions.ts,__tests__/_actions.test.ts}`,
`lib/sofia/alertas/{leitura.ts,blocos.ts}` (+ testes) — o e-mail de `app/api/frotas/alertas-diarios` —,
`app/(operacoes)/sofia/veiculos/[id]/page.tsx`, `.claude/rules/sofia.md`, `.claude/rules/sql.md`, `docs/DIVIDAS.md`.

## LISTA DE ARQUIVOS QUE A FRENTE TOCA

| Arquivo | Novo/alterado | Tarefa | Compartilhado? |
|---|---|---|---|
| `sdd-sql-sofia-multa-avaria.sql` | novo | 1 | não |
| `sdd-sql-sofia-multa-avaria-teste.sql` | novo | 1 | não |
| `lib/sofia/multaEtapas.ts` + `lib/sofia/__tests__/multaEtapas.test.ts` | novos | 2 | não |
| `lib/sofia/multaPermissoes.ts` + `lib/sofia/__tests__/multaPermissoes.test.ts` | novos | 2 | não |
| `app/(operacoes)/sofia/multas/_actions.ts` | alterado | 3 | dono |
| `app/(operacoes)/sofia/multas/__tests__/_actions.test.ts` | alterado | 3 | dono |
| `app/(operacoes)/sofia/multas/__tests__/_actions.etapas.test.ts` | novo | 3 | dono |
| `app/(operacoes)/sofia/multas/page.tsx`, `_table.tsx` | alterados | 4 | dono |
| `app/(operacoes)/sofia/multas/nova/_form.tsx` | alterado | 4 | dono |
| `app/(operacoes)/sofia/multas/[id]/page.tsx`, `[id]/_fluxo.tsx` | novos | 4 | dono |
| `lib/sofia/pendencias.ts` + `lib/sofia/__tests__/pendencias.test.ts` | alterados | 5 | **dono** (a outra frente não edita) |
| `lib/sofia/fotosChecklist.ts` + `lib/sofia/__tests__/fotosChecklist.test.ts` | novos | 6 | não |
| `components/sofia/CameraCapture.tsx` | alterado | 6 | não |
| `components/sofia/FotosAdicionais.tsx`, `components/sofia/RegistrarAvaria.tsx` | novos | 6 | não |
| `lib/sofia/uploadFotos.ts` + `lib/sofia/__tests__/uploadFotos.test.ts` | alterados | 6 | não |
| `app/(operacoes)/sofia/checklist/_validation.ts` + `__tests__/_validation.test.ts` | alterados | 7 | não |
| `app/(operacoes)/sofia/checklist/_actions.ts` | alterado | 7, 8 | não |
| `app/(operacoes)/sofia/checklist/__tests__/_actions.avarias.test.ts` | novo | 7 | não |
| `app/(operacoes)/sofia/checklist/__tests__/_actions.exclusao.test.ts` | alterado | 7 | não |
| `app/(operacoes)/sofia/checklist/novo/_form.tsx` | alterado | 7, 8 | não |
| `app/(operacoes)/sofia/checklist/[id]/page.tsx` | alterado | 7 | não |
| `app/(operacoes)/sofia/sinistros/novo/_form.tsx` | alterado | 7 | conferir (a outra frente faz a base de Sinistros na listagem, não no formulário) |
| `app/(operacoes)/sofia/sinistros/_actions.ts` + `__tests__/_actions.fotos.test.ts` (novo), `__tests__/_actions.test.ts` | alterados | 7 | conferir (idem) |
| `lib/sofia/checklistHistorico.ts` + `lib/sofia/__tests__/checklistHistorico.test.ts` | novos | 8 | não |
| `components/sofia/CompararFotos.tsx` | novo | 8 | não |
| `app/(operacoes)/sofia/checklist/veiculo/[veiculoId]/page.tsx` | novo | 8 | não |
| `app/(operacoes)/sofia/checklist/page.tsx` | alterado | 8 | não |
| `app/(operacoes)/sofia/checklist/__tests__/_actions.historico.test.ts` | novo | 8 | não |
| `app/(operacoes)/sofia/pendencias/page.tsx` | alterado | 9 | **SIM** |
| `app/(operacoes)/sofia/descontos/page.tsx`, `_actions.ts`, `__tests__/_actions.test.ts` | alterados | 9 | **SIM** (fora das pastas de dono) |
| `lib/sofia/alertas/leitura.ts`, `blocos.ts` + `lib/sofia/alertas/__tests__/*` | alterados | 9 | **SIM** (e-mail diário) |
| `app/(operacoes)/sofia/veiculos/[id]/page.tsx` | alterado | 9 | **SIM** |
| `.claude/rules/sofia.md`, `.claude/rules/sql.md`, `docs/DIVIDAS.md` | alterados | 9 | **SIM** |

Ordem e paralelismo: 1 → (2 ‖ 5 ‖ 6) → 3 → 4; 6 → 7 → 8; tudo → 9 → 10. Tarefas que tocam
`checklist/_actions.ts` e `checklist/novo/_form.tsx` (7 e 8) são **sequenciais**.

---

## Tarefa 1 — SQL da migration e do teste (território de exceção)

Arquivos: `sdd-sql-sofia-multa-avaria.sql`, `sdd-sql-sofia-multa-avaria-teste.sql` (raiz), copiados **literalmente** da
spec §3.8 e §3.9.

1. Criar os dois arquivos com o texto da spec.
2. Rodar localmente em PGlite com stubs (padrão de `sdd-sql-sofia-extratos.sql`: stubs de `auth.jwt()`, `auth.users`,
   `storage.objects`/`storage.buckets`, `hub_user_roles`, `hub_system_access`, `sofia_gestores`, as 3 funções de
   autorização e as tabelas do Sofia nas colunas medidas na spec §1): migration → verificação → **reaplicar** a migration
   (idempotência) → verificação de novo → teste.
3. Se algum caso do teste falhar, corrigir a **migration**, nunca afrouxar o caso. Se o caso estiver errado (premissa do
   teste errada), registrar o porquê no commit.
4. Revisão independente (agente diferente) lendo só a spec §2.1, §3 e os dois arquivos, com a pergunta explícita: "existe
   caminho para gestor autorizar, descontar sem autorização, ou alguém apagar/trocar foto?".

**Não aplicar em produção** nesta tarefa. Aplicação só na Tarefa 10, com autorização escrita do João citando os 2 arquivos.

Pronto quando: PGlite dá verificação 19 `OK` + v04 `AVISO`, reaplicação idem, teste `RESUMO: 42/42 OK`; revisão
independente sem bloqueante.

## Tarefa 2 — Domínio puro da multa

Arquivos: `lib/sofia/multaEtapas.ts`, `lib/sofia/multaPermissoes.ts` + testes em `lib/sofia/__tests__/`.

1. `multaEtapas.ts` conforme spec §4.1 e tabela §2.1 (rótulos, atores, tags e textos "como é hoje / como fica" copiados do
   `ETAPAS` do mockup; `contestada` a mais). `proximasAcoes(etapa, { podeGerir, ehAdmin })` devolve as ações da próxima
   etapa e as de voltar (Cancelar solicitação, Revogar, Desfazer desconto), cada uma com `permitida` e `motivo`.
2. `classePrazo` igual ao `prazoPill` do mockup; `prazoPadrao('2026-11-03') === '2026-12-03'` (data local, sem UTC).
3. `multaPermissoes.ts`: `podeAutorizarDescontoMulta(supabase)` = RPC `sofia_is_admin`, só `data === true`.

Testes (`multaEtapas.test.ts`): derivação status/autorização para as 10 etapas (tabela da spec, igual às funções SQL);
transições permitidas/negadas (gestor não autoriza, não revoga; ninguém vai a `descontada` sem `autorizado`; contestada
só antes de `validada`; voltar só nos 3 casos); `classePrazo` nas 5 faixas e "indicado" a partir de `indicado`;
`prazoPadrao` na virada de mês/ano. (`multaPermissoes.test.ts`): `true` libera; `false`, `null`, erro de RPC e exceção
negam.

Pronto quando: jest dos dois arquivos verde; `sem-admin-do-hub.test.ts` verde.

## Tarefa 3 — Actions da multa

Arquivos: `app/(operacoes)/sofia/multas/_actions.ts`, `__tests__/_actions.test.ts` (ajustar),
`__tests__/_actions.etapas.test.ts` (novo).

1. `criarMultaAction`: novos campos (spec §4.2); `prazo_indicacao` vazio → `prazoPadrao(data_recebimento)`; `pontos`
   inteiro ≥ 0 ou nulo.
2. `registrarEtapaMultaAction(id, etapa, formData)`: valida `etapa` contra a lista; `requireGestorFrotas`; para
   `autorizado` e para revogar, também `podeAutorizarDescontoMulta` (mensagem "Só o administrador autoriza o desconto");
   monta `p_dados` só com as chaves da etapa (spec §3.5); chama `sofia_multa_registrar_etapa`; erro da RPC → mensagem fixa
   por etapa (nunca `error.message`); `logAudit('multas','atualizou', id, 'Etapa: <rótulo>')`; `revalidatePath` de
   multas, multas/[id], descontos, pendencias, motoristas.
3. `editarPrazoMultaAction`, `registrarDobroAction` (`empresa`|`motorista`), `marcarBoletoContestadaAction`:
   `requireGestorFrotas` + UPDATE.
4. `atualizarAutorizacaoMultaAction`: mesma assinatura, agora via `registrarEtapaMultaAction` (mapa da spec §4.2).
5. Remover `enviarParaDescontoEmMassaAction`.

Testes (mock do client como nos testes existentes): comum é negado antes de chamar a RPC; gestor chama a RPC com
`p_dados` certo por etapa; **gestor pedindo `autorizado` é negado sem chamar a RPC**; admin pede `autorizado` e a RPC é
chamada; erro da RPC vira mensagem fixa; `criarMultaAction` preenche prazo padrão; payload não leva chave fora da lista.

Pronto quando: jest de `multas/` verde; `tsc` sem erro nos arquivos da tarefa (Descontos ainda importa
`atualizarAutorizacaoMultaAction` — assinatura mantida).

## Tarefa 4 — Telas da multa

Arquivos: `multas/page.tsx`, `multas/_table.tsx`, `multas/nova/_form.tsx`, `multas/[id]/page.tsx`, `multas/[id]/_fluxo.tsx`.

1. Lista: colunas Etapa e Prazo (pill), linha abre o detalhe, sem "Enviar para desconto"; "Excluir"/"Excluir
   selecionadas" continuam só para gestor/admin.
2. Formulário: campos novos; prazo preenchido ao escolher o recebimento, editável.
3. Detalhe: layout do mockup aba 1 (cartão + stepper + painel da etapa + cartões de condutor sugerido, modo por locadora,
   prazo vencido/dobro; o relógio simulado e o bloco "Decisões em aberto" são só do mockup e não entram); botões desabilitados com o motivo; histórico de
   `multa_etapas` (quando, quem, em nome de, canal, observação). Condutor sugerido via `resolverNaData` sobre
   `veiculo_responsabilidade_historico` na `multas.data`. Termo: upload no cliente para `sofia-anexos`
   `multas/<id>/termo-<Date.now()>.<ext>` (PDF ou imagem; imagem passa por `comprimirImagem`), depois a action.
4. 375 px: stepper vira lista vertical.

Pronto quando: `tsc` e `lint` limpos; conferência manual (`npm run dev`) com os três perfis contra o mockup — gestor vê
"Autorizar desconto" desabilitado com "Só administrador pode."; comum só registra.

## Tarefa 5 — Pendências B8 (`lib/sofia/pendencias.ts`)

Arquivos: `lib/sofia/pendencias.ts`, `lib/sofia/__tests__/pendencias.test.ts`.

1. Entrada de multa nova (spec §4.2) e texto/grupo/prazo pela tabela da spec §2.11; função exportada
   `pendenciaDaMulta(m)` (reusada pelo e-mail na Tarefa 9).
2. `PendenciaAutomatica.grupo`. Sinistro, revisão, documento e termo de uso **inalterados** (só tocar o laço de multas).

Testes: um caso por etapa (texto literal da spec, grupo, prazo); `descontada` e `contestada` não aparecem; prazo nulo a
partir de `indicado`; `termo` sem prazo usa o texto sem data; fallback sem placa/sem tipo nunca mostra "null"; os testes
de revisão/sinistro/KPI continuam passando sem mudança. Os 3 testes antigos de multa por `status` são substituídos.

Pronto quando: jest de `pendencias.test.ts` verde. (`tsc` acusa `pendencias/page.tsx` até a Tarefa 9 — esperado e
anotado no commit.)

## Tarefa 6 — Fotos: componentes e domínio

Arquivos: `lib/sofia/fotosChecklist.ts` (+ teste), `components/sofia/CameraCapture.tsx`,
`components/sofia/FotosAdicionais.tsx`, `components/sofia/RegistrarAvaria.tsx`, `lib/sofia/uploadFotos.ts` (+ teste).

1. `CameraCapture`: prop `permitirGaleria` (default `true`); `false` esconde "ou escolher da galeria".
2. `FotosAdicionais`: miniaturas, "+ Mais fotos (ângulo livre)", "x" só antes de salvar, some ao atingir `TETO_FOTOS`
   contando tudo o que o formulário já tem (prop `totalAtual`), texto "Limite de 30 fotos".
3. `RegistrarAvaria`: as duas abas do mockup; validação de `validarAvariaRascunho` com a mensagem "Falta: …".
4. `uploadFotos`: índice no caminho; campos opcionais `tipo_foto`/`avaria_id` repassados no resultado.

Testes: `fotosChecklist.test.ts` (contagem, teto, "Falta: peça, tamanho, foto da peça, foto da avaria"); `uploadFotos.test.ts`
(dois arquivos com a mesma posição-base no mesmo ms geram caminhos diferentes; falha de um upload continua devolvendo
`ok: false` sem caminhos).

Pronto quando: jest verde; `tsc` limpo.

## Tarefa 7 — Checklist e sinistro com fotos extras e avarias

Arquivos: `checklist/_validation.ts` (+ teste), `checklist/_actions.ts`, `checklist/__tests__/_actions.avarias.test.ts`
(novo), `checklist/__tests__/_actions.exclusao.test.ts`, `checklist/novo/_form.tsx`, `checklist/[id]/page.tsx`,
`sinistros/novo/_form.tsx`, `sinistros/_actions.ts`, `sinistros/__tests__/_actions.fotos.test.ts` (novo),
`sinistros/__tests__/_actions.test.ts`.

1. Validação: fotos com `tipo_foto`; avarias (peça, tamanho válidos; ≥1 `avaria_peca` e ≥1 `avaria_dano` por avaria);
   teto 30; posições obrigatórias continuam.
2. Action do checklist: checklist → avarias → fotos; `avaria_identificada`/`avaria_descricao` derivados; erro em avaria
   → "Checklist salvo, mas as avarias não foram registradas. Contate o suporte." com `checklistId`.
3. `excluirChecklistAction`/`excluirSinistroAction`: se o delete falhar, mensagem da spec §2.7 (sem tentar apagar foto).
4. Formulário do checklist: `CameraCapture permitirGaleria={false}` nas 5 posições, `FotosAdicionais`, `RegistrarAvaria`;
   sai o par "Avaria identificada? / texto".
5. Detalhe do checklist: fotos por tipo + bloco Avarias.
6. Sinistro: lista + "Mais fotos" com galeria; action rejeita > 30.

Testes: `_actions.avarias.test.ts` (ordem das inserções; avaria sem foto de dano rejeitada antes de gravar; 31 fotos
rejeitadas; `avaria_identificada` true com 1 avaria); `_actions.exclusao.test.ts` (erro do banco ao excluir vira a mensagem
de prova); `_validation.test.ts` (casos novos); sinistro: 31 fotos rejeitadas, 3 fotos gravadas.

Pronto quando: jest de `checklist/` e `sinistros/` verde; `tsc` limpo; conferência manual no celular (375 px) do fluxo de
fotos e avaria contra a aba 3 do mockup.

## Tarefa 8 — Histórico do checklist e painel da troca

Arquivos: `lib/sofia/checklistHistorico.ts` (+ teste), `components/sofia/CompararFotos.tsx`,
`checklist/veiculo/[veiculoId]/page.tsx`, `checklist/page.tsx`, `checklist/_actions.ts`,
`checklist/__tests__/_actions.historico.test.ts`, `checklist/novo/_form.tsx`.

1. Funções puras da spec §2.9 (sem KM).
2. Página por veículo: tabela, seletores Antes/Depois, Lado a lado/Sobrepor, atalho "Comparar com a entrada (base)",
   aviso de reordenação, "Escolha dois checklists diferentes.", diff, avarias abertas com "Marcar como reparada"
   (desabilitado com motivo para comum). Parâmetros de URL validados (uuid do mesmo veículo; senão, padrão).
3. Actions: `marcarAvariaReparadaAction(id, data)` e `definirAcaoAvariaAction(id, acao)` com `requireGestorFrotas`;
   `ultimoChecklistAction(veiculoId)` com URLs assinadas (3600 s).
4. Lista de checklists: link "Histórico do veículo".
5. Formulário: painel "Último: <posição> · dd/mm/aaaa" na troca, "Primeiro checklist deste veículo." sem anterior. **Não
   tocar a trava D1.**

Testes: `checklistHistorico.test.ts` (item piorou/melhorou, null ignorado; avaria nova/resolvida/continua pela regra de
data incluindo reparada depois da data de B; antes/depois reordenados; base = mais antigo); `_actions.historico.test.ts`
(comum não dá baixa; gestor dá baixa com a data; último checklist devolve URLs assinadas e vazio sem anterior).

Pronto quando: jest verde; `tsc` limpo; conferência manual contra a aba 4 do mockup.

## Tarefa 9 — INTEGRAÇÃO — arquivo compartilhado

Só depois de 2–8 mergeadas no branch e **da frente Manutenção/bases ter mergeado as dela** nos mesmos arquivos (rebase
antes; resolver conflito preservando as duas mudanças).

1. `app/(operacoes)/sofia/pendencias/page.tsx`: select de multas com `etapa, prazo_indicacao, tipo_infracao, descricao,
   veiculos(placa)` e `etapa not in (descontada, contestada)`; grupo → status (`em_andamento` para aguardando terceiros);
   bloco "Aguardando terceiros (não conta como atrasada)" e o texto da regra do mockup.
2. `app/(operacoes)/sofia/descontos/page.tsx` + `_actions.ts` + teste: spec §4.3 (multas só com etapa + link; remover as 3
   actions de multa e seus casos de teste; sinistro/KM intactos).
3. `lib/sofia/alertas/leitura.ts` e `blocos.ts` (+ testes): bloco de multas = antes da indicação com prazo vencido ou
   ≤ 10 dias, "vence em N dias"/"prazo vencido"; caminho `/sofia/multas/<id>`.
4. `app/(operacoes)/sofia/veiculos/[id]/page.tsx`: link "Histórico do checklist".
5. Docs: `.claude/rules/sofia.md` (trigger `trg_multas_etapa`, RPC `sofia_multa_registrar_etapa`, só admin autoriza,
   fotos imutáveis, storage restrito, avarias), `.claude/rules/sql.md` (linha `sofia-multa-avaria` **NÃO APLICADO**),
   `docs/DIVIDAS.md` (os 11 itens da spec §7, com âncora e data).

Pronto quando: `tsc --noEmit` limpo no projeto inteiro; jest do Sofia (`lib/sofia`, `app/(operacoes)/sofia`,
`app/api/frotas`, `components/sofia`) verde; `npm run lint` sem erro novo; `npm run build` ok.

## Tarefa 10 — Revisão, aplicação e deploy

1. Revisão independente do diff inteiro (agente que não implementou), régua do projeto: só bloqueia dano de dado
   alcançável; foco em autorização/dinheiro (gestor autorizando, desconto sem autorização, foto apagada, mensagem crua de
   erro, `searchParams` renderizado).
2. Autorização **escrita** do João citando `sdd-sql-sofia-multa-avaria.sql` e `sdd-sql-sofia-multa-avaria-teste.sql`.
3. Antes de aplicar: conferir de novo no banco a distribuição de `multas` (spec §1) e anotar.
4. Aplicar a migration pelo PAT; verificação 19 `OK` + v04 `AVISO n`; rodar o teste: `42/42 OK`; conferir as 5 contagens
   do fim do teste = 0. Qualquer `FALHOU` → parar, não deployar.
5. Atualizar `.claude/rules/sql.md` (aplicado em <data>, resultados) no mesmo commit.
6. Merge no `master`, build, push; João clica Deploy; conferir `Last-Modified` dos chunks.
7. Avisar o João dos dois efeitos visíveis: exclusão de checklist/sinistro com foto bloqueada; multas antigas aparecendo
   com "prazo vencido" até o Igor avançar as já indicadas.

Pronto quando: produção com o SQL aplicado e verificado, deploy confirmado pelos chunks, `sql.md` atualizado.

---

## Fora do escopo / dívidas

Lista completa e justificativa na spec §7 (vai para `docs/DIVIDAS.md` na Tarefa 9): aceite digital do termo (motoristas
sem login), comprovante da indicação, reabrir multa contestada, valor extra do dobro, atomicidade checklist/avarias/fotos,
KM e "feito por" no histórico, `avaria_origem_id` sem uso, linha avulsa em `multa_etapas` por gestor, teto 30 só no app,
alerta "≤ 10 dias" em vez de 10/5/2, arquivos órfãos no storage. Também fora: sinistro em Pendências (decisão 3 de
pendências), avarias em Pendências (decisão 4 de fotos), trava D1, integração do boleto com o Financeiro.
