# Revisão independente — código do cancelamento de obra

**Data:** 23/09/2026 · **Revisor:** subagente revisor (não escreveu o código) ·
**Alvo:** branch `feat/cancelamento-obra` (14 commits sobre `795bbc1`), worktree
`.claude/worktrees/agent-a73c4514889f2aba3`.
**Referências:** spec, plano e mockup aprovado do cancelamento (23/09), `sdd-sql-obras-cancelamento.sql`
(aplicado), AGENTS.md, `.claude/rules/obras.md`. **Régua:** só bloqueia dano de dado alcançável,
falha de validação/autorização no servidor, ou algo que o cliente veria errado.

**Como foi verificado:** leitura do diff inteiro; grep de todo leitor/escritor de `obras_obra`,
`faseDe`, `ETAPAS[`, `Record<Etapa`; leitura da migration (CHECK, trigger, RPC).
`npx tsc --noEmit` limpo; `npx eslint` nos arquivos alterados limpo; `npx jest app/obras`:
796 passam, 1 falha (o teste intermitente A30, ver item 6). Nada foi editado, commitado ou pushado;
o banco não foi acessado.

---

## Veredito

**Aprovado com 2 bloqueantes pequenos, ambos de texto/tela (régua b), nenhum de dado.** Servidor,
autorização, RPC, histórico, sincronização e actions existentes estão corretos. As duas correções
somam ~4 linhas em `_ficha.tsx` / `_bloco-autorizacao.tsx`, sem mexer em servidor.

---

## BLOQUEANTES

### B1 — A28: a obra cancelada esconde as fotos que a janela promete manter (confirmado)

- **Onde:** `app/obras/obra/[id]/_ficha.tsx:884` (`pedeFoto(obra) && diario.length > 0` → caixa
  "Evolução em fotos") e `:956` (linha "Foto da evolução recebida / A foto deste dia não veio").
  `pedeFoto` = `faseDe(o) === 'campo'` (`_lib/tipos.ts:504-506`), e `faseDe` devolve `null` para
  `cancelado` (`tipos.ts:453-457`).
- **Cenário:** obra em Andamento com diário e fotos → "Cancelar obra". A janela diz, com texto do
  **mockup aprovado** (`mockup-cancelamento…html:651`, `_cancelar-obra.tsx:187`): *"Nada é apagado:
  diário, fotos, tarefas e histórico continuam na ficha."* O passo congelado diz *"Parou aqui. O
  diário e as fotos continuam abaixo, só leitura."* (`_ficha.tsx:258`). Ao re-renderizar, a caixa de
  fotos some. As fotos já são carregadas em `page.tsx:201-214` independente da etapa — só a
  condição de exibição esconde.
- **Correção (a que casa com o mockup aprovado — mostrar, não mudar o texto):** o texto da janela é
  do mockup e não se reescreve; então mostrar as fotos em só leitura:
  `_ficha.tsx:884` → `(pedeFoto(obra) || cancelada(obra)) && diario.length > 0`
  (e o mesmo em `:956`, opcional). As fotos são leitura; nada de cobrança é disparado pela tela.
  Opcional: alinhar o passo congelado ao texto do mockup (`:726` do mockup: *"Últimos registros do
  diário continuam abaixo, só leitura."*).
- **Como confirmei:** leitura das três pontas (condição `:884`, carga `page.tsx:201`, texto
  `:258`/`:187`) e do mockup. O próprio implementador registrou em `docs/DIVIDAS.md` (A28) que as
  fotos não aparecem. Com a correção, retirar A28 do DIVIDAS.

### B2 — Bloco Autorização da cancelada diz que a obra "está sendo executada" e conta dias

- **Onde:** `app/obras/obra/[id]/_bloco-autorizacao.tsx:185-189` e `:212-225` (leitura), alimentado
  por `_ficha.tsx` com `diasSemOS={dSemOS}` (`diasSemOS`, `tipos.ts:704-710`, não olha etapa).
- **Cenário:** fluxo do mockup "Cancelada pela Manfac na Triagem" (OS aberta por engano: sem OS
  aprovada, sem liberação). A ficha cancelada mostra os três blocos só leitura (divergência 4 da
  spec) e o Autorização escreve, em vermelho: *"Nem uma coisa nem outra. A obra está sendo executada
  sem OS e sem ninguém nomeado que tenha autorizado."* — e *"esperando a aprovação da OS há N
  dias"*, com N crescendo. Contradiz o comportamento (nunca foi executada) e o aviso da própria
  Base: *"Canceladas não contam dias"* (`_visao.tsx`). Antes do cancelamento, obra em `definir`
  nunca renderizava este bloco (ia para a Triagem), então é texto novo na frente do cliente.
- **Correção (1-3 linhas):** em `_ficha.tsx`, passar `diasSemOS={cancelada(obra) ? null : dSemOS}`
  ao `BlocoAutorizacao`; no `_bloco-autorizacao.tsx`, no ramo final (`Nem uma coisa nem outra…`),
  não renderizar quando `etapa === 'cancelado'` (o bloco já recebe `etapa`).
- **Como confirmei:** leitura do bloco (os ramos do parágrafo não dependem de etapa) e de
  `diasSemOS`; o `BlocoAutorizacao` recebe `etapa` (`:87`). Não rodei render dedicado.

---

## Pontos obrigatórios — o que foi verificado e está OK

1. **A28** — é B1 acima.
2. **Actions cancelar/desfazer** (`_actions.ts:529-608`): `abrirSessao()` com `hasSystemAccess(...)
   !== true` (mesmo padrão das outras); `por` validado contra `CANCELADO_POR` antes de ler;
   obra lida do banco; `cancelada` → recusa; `!podeCancelar` (lista `definir, levantamento,
   andamento, paralisado` = exatamente a do CHECK; `definir` na Triagem está na spec C2 e na
   migration) → recusa com mensagem legível. Gravação só pela RPC via `gravarComHistorico`, com
   linha `Cancelamento`/`etapa` e `motivo`; `desde_etapa` não entra em nenhum dos dois; desfazer
   volta a `cancelado_etapa_anterior` e limpa as cinco colunas (casa com a trigger e com o CHECK).
   `etapa_por`/`etapa_em`/`atualizacao` estão na lista da RPC e não são rastreados pela trava de
   `gravarComHistorico`. Tudo o que o CHECK/trigger recusariam é recusado antes com mensagem; o
   único caso que chega ao banco é a corrida (outra pessoa mudou a etapa entre a leitura e a
   gravação) — a trigger recusa e a tela mostra "Nada mudou — tente de novo", verdade por ser
   atômico. Testes cobrem sessão, acesso, `por`, 2B nas cinco etapas, já cancelada, RPC com erro,
   revalidações, desfazer exato.
3. **Guardas nas actions existentes:** `mudarEtapaAction` (`:375`), `corrigirDataFechamentoAction`
   (`:466`), `salvarAutorizacao/Identificacao/Cronograma` (`:767, :822, :887`) só retornam cedo
   quando `cancelada(obra)`; obra não cancelada segue o caminho de antes (só troca de tipo
   `Etapa`→`EtapaCiclo` nos casts). Remarcação está dentro de `salvarCronogramaAction` (guardada);
   `liberarObraAction`/`salvarDadosTriagemAction` já exigem `definir`.
4. **`faseDe` → `Fase | null` e `'cancelado'`:** usos restantes são comparações por igualdade
   (`_kanban.tsx:90`, `_regras.ts:196`, `posCampo`, `pedeFoto`) — `null` só exclui, não quebra.
   `ETAPAS[...]` só é indexado com chaves de `ESTEIRA` (`_ficha.tsx:262,288`) ou após tratar
   `cancelado` (`donoDa`, `nomeEtapa`). `COR_ETAPA` ganhou `cancelado`. `kpisDaBase`: `velhas` com
   `!encerrada`; os demais já excluem. **Diário** busca só três etapas (`diario/page.tsx:31,62`).
   **Sincronização do Field** nunca escreve `etapa` em obra existente (`_sincronizacao.ts:329-368`
   monta só `loja/descricao/fonte/field_id/os/field_ausente_*`; `etapa` só no insert de obra nova,
   `:323`) e a trigger é `before update of etapa, cancelado_*` — não dispara nessas escritas.
   **Importação** descarta `etapa` no update (`importacao.ts:684`). Nenhum caminho ressuscita a
   cancelada.
5. **`tarefas/page.tsx`:** exatamente a mudança da spec §11 — `etapa` no `select` e o `filter` com
   `tarefaVisivelNaLista`, mais um comentário. Nada além.
6. **A30 é pré-existente:** o teste que falha é `autorizacao: editar, erro do servidor, cancelar`
   (`_blocos-editaveis.test.tsx:35`), que a branch não toca (o diff do arquivo só acrescenta testes
   a partir da linha 158). A instabilidade já estava documentada **antes** da branch, em
   `docs/onboarding-duda/02-FRENTES-DO-DUDA.md` ("O teste instável de `_blocos-editaveis.test.tsx`",
   commit `51c7e0c`, presente em `795bbc1`). Nas minhas rodadas: 2 falhas em 3 execuções logo após a
   suíte completa, depois 6/6 verdes na branch e 11/11 verdes em `795bbc1` (worktree temporário,
   já removido) — não reproduzi a falha no código de antes, mas o teste falho é antigo, sem
   dependência do código novo, e a instabilidade sob carga já estava registrada.

---

## BACKLOG (não bloqueia)

- **"— dias" no lugar de "—"**: `BadgeDias` na tabela/Kanban mostra `— dias` e, no cabeçalho da
  ficha, `— dias desde a entrada` (`_etiquetas.tsx:99-100`, `sufixoDias` não sabe da cancelada). O
  mockup mostra só "—". Cosmético.
- **A29 (já registrado):** "Caminho: com desvio — vai parar em …" na cancelada.
- **Tarefa aberta de obra cancelada** aparece na ficha com cor "vencida" (vermelho) na seção
  "Tarefas que as faltas geraram". É registro, não cobrança; o mockup diz que continuam na ficha.
- **Linha da executada** (`_ficha.tsx`): só aparece com `posCampo`; uma etapa desconhecida (nem
  cancelável nem pós-campo) fica sem faixa e sem linha. Teórico — o CHECK de etapa impede.
- `SeloCancelada` recebe `em={obra.cancelado_em ?? ''}`; com `''`, `Intl.formatToParts(new
  Date(''))` lança. Inalcançável (CHECK exige `cancelado_em`), só anotar.
- A22–A27 do DIVIDAS conferidas: bordas coerentes com a spec §9.

## Não verificado

- Render real no navegador (dev server) do fluxo cancelar → selo → desfazer; julguei pelo código e
  pelos testes de componente.
- Banco de produção (fora do escopo): assumido que a migration aplicada é a do repositório
  (`795bbc1` registra 11/11 + teste 11/11).
- B2 não tem teste de render dedicado; confirmado por leitura.
