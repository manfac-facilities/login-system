# Revisão independente — dívidas da ficha A1, A13, B5, B7 — 24/09/2026

**Objeto:** branch `feat/dividas-ficha` (8 commits sobre `fed48eb`, HEAD `b604539`), worktree
`.claude/worktrees/agent-ab5251c7ee6ec5602`.
**Referências:** `spec-dividas-ficha-2026-09-23.md` (com "Aprovações do João"), `sdd-sql-obras-cancelamento.sql`
(trigger de transição + RPC `obras_aplicar_alteracao`), `docs/DIVIDAS.md`.
**Revisor:** agente diferente do que implementou. Não editou código, não acessou o banco.

## Veredito

**Aprovado — zero bloqueantes.** As quatro dívidas estão fechadas como a spec manda, as duas mensagens
de tela batem literalmente com o texto aprovado, e nenhuma escrita que funciona hoje regrediu.

Verificação executada no worktree:
- `npx jest --runInBand app/obras` → **39 suites, 870 passaram, 1 todo, 0 falhas** (84 s).
- `npx tsc --noEmit` → nenhum erro em `app/obras`.
- `npx eslint 'app/obras/obra/[id]' app/obras/_lib/ficha-campos.ts` → limpo.

## Pontos obrigatórios — o que foi conferido

### 1. A13 — troca de etapa atômica
- `_actions.ts:387-408`: uma única chamada `gravarComHistorico` com `etapa` (só quando muda),
  `desde_etapa`, `atualizacao`, `etapa_por`, `etapa_em` e os marcos. O `update` direto, o
  `colunaInexistente` e a mensagem "A etapa mudou, mas…" saíram (grep: nenhum `.from('obras_obra').update`
  em `mudarEtapaAction`; teste `_actions.test.ts` "a mensagem de falha parcial não existe mais").
- A RPC aceita todas essas colunas (`sdd-sql-obras-cancelamento.sql:294-302`, `v_colunas_validas`).
- Obra cancelada: recusada na origem (`_actions.ts:363`, `CANCELADA_NAO_MUDA_ETAPA`); `cancelado` não
  está em `CICLO` → `ETAPAS_VALIDAS` recusa como destino (`_actions.ts:357`). A trigger de transição
  (`sdd-sql-obras-cancelamento.sql:222-252`) continua sendo a rede: se a obra for cancelada entre o
  `lerObra` e a RPC com troca real de etapa, o update inteiro é recusado.
- Linha do histórico: `linhasDeAlteracao({ etapa: obra.etapa }, { etapa }, 'Esteira')` vem primeiro;
  `formatarValor` traduz por `nomeEtapa` (`historico.ts:100`); o filtro do Histórico já tem "Esteira"
  (`_historico.tsx:17`). Sai "Esteira · Etapa: A → B", como aprovado.
- Data de fechamento (ajuste de 23/09): validação `aplicavel` + `validarDataFechamentoOS` intacta e antes
  de qualquer escrita (`_actions.ts:370-384`); regra de `desde_etapa` em `pendFat` preservada.
  Remarcação (`salvarCronogramaAction` → `obras_remarcar_inicio`) não foi tocada além da versão.

### 2. A1 — versão do bloco
- `versaoDoBloco` (`_lib/ficha-campos.ts:408-428`) = JSON das colunas cruas do bloco, não `updated_at`.
- Lida no servidor (`_ficha.tsx:752,774,793`, sobre `derivar(linha)`, que espalha a linha de
  `select('*')` sem sobrescrever essas colunas — `tipos.ts:563`), capturada no **Editar** nos três
  blocos (`setVersaoLida(versao)`), devolvida ao salvar, e conferida no servidor antes de validar e de
  gravar nas três actions (`_actions.ts:755, 823, 890`), com `select('*')` dos dois lados (`page.tsx:117`,
  `_actions.ts:113`).
- Sem conflito falso: a sincronização do Field só escreve `loja/descricao/fonte/field_id/os/field_ausente_*`
  (`sincronizar/_sincronizacao.ts:329-360`), o diário só `nao_andou_seguidos/bloqueada_dias/bloqueio`
  (`tipos.ts:900-930`), a troca de etapa só etapa/marcos/controle — nenhuma dessas colunas está em
  `COLUNAS_DO_BLOCO`. Teste "mudança só em coluna de fora do bloco não é conflito".
- Mensagem `CONFLITO_EDICAO` (`_actions.ts:68-70`) idêntica à aprovada.
- A31 (janela entre ler e gravar) registrada no `DIVIDAS.md`, junto com A32–A35 da spec §7.

### 3. B5 — auto-avanço carimba marcos
- `_actions.ts:775-787`: quando `avancou`, `calcularMarcosDaEsteira(obra, 'fecharOS', hoje)` — a mesma
  função do seletor —, linhas "Esteira" depois das da Autorização, tudo numa chamada de `gravarBloco`.
  `marco_os_aprov` continua só pelo trio. Cinco testes novos cobrem os casos (sem marco, já preenchido,
  incoerente, sem avanço, trio).

### 4. B7 — datas da liberação
- `liberarObraAction` (`_actions.ts:624-645`) usa `validarCronograma` (início 2000–2100 e calendário,
  prioridade, duração 1–180) e `validarAutorizacao` só para `libEm`/`aprovadaEm`. Início inválido devolve
  `INICIO_INVALIDO` (`_actions.ts:66`), idêntico ao aprovado.
- **Mudança "data sem nome agora é recusada":** é exatamente o que a spec §4.2 manda. Não quebra fluxo da
  tela: a Triagem roda a MESMA `validarAutorizacao` antes de chamar a action (`_triagem.tsx:209-232`) e
  recusa com a mesma mensagem, então a tela nunca manda data sem nome — nem no caso do pré-preenchimento
  de obra legada com `liberado_em` e sem `liberado_por` (`_triagem.tsx:180-181`), que já era barrado no
  navegador antes desta branch.

### 5. Autorização
Toda action tocada (`mudarEtapaAction`, `liberarObraAction`, `salvarAutorizacaoAction`,
`salvarIdentificacaoAction`, `salvarCronogramaAction`) começa por `abrirSessao()`, que compara
`hasSystemAccess(...) !== true` (`_actions.ts:103`). A checagem de versão vem depois da sessão (teste
"R1 continua primeiro").

## BLOQUEANTES

Nenhum.

## BACKLOG (não bloqueia; não volta ao dev)

1. **Corrida "mesma etapa" com cancelamento.** Se a obra for cancelada entre o `lerObra` e a RPC numa
   troca para a MESMA etapa (sem `etapa` em `p_campos`), a trigger vê `cancelado → cancelado` com os
   dados do cancelamento iguais e deixa passar: `desde_etapa`/`etapa_por`/marcos de reconciliação gravam
   numa obra cancelada. Mesma classe da A31 (milissegundos), e os blocos têm a mesma janela desde antes.
   Registrar junto da A31.
2. **Pós-conflito sem recarregar, o conflito se repete.** Depois de `CONFLITO_EDICAO` não há revalidação,
   então Cancelar → Editar recaptura a versão antiga e recusa de novo. A mensagem já manda recarregar;
   só vira problema se alguém insistir.
3. **Salvou no servidor mas a resposta se perdeu (rede) → "Salvar de novo" dá conflito** com a própria
   gravação. Falha fechada e o histórico mostra o que gravou; aceitável.
4. **Triagem: data de liberação/aprovação que não existe cai na caixa geral como "Data inválida."** sem
   dizer qual campo. Pré-existente no navegador (a tela usa a mesma função); a spec §4.3 afirma que
   "liberação, aprovação já dizem de que campo falam", o que só vale para as mensagens de "depois de hoje"
   e "sem nome".
5. **`_etapa.test.tsx:76` ainda simula a mensagem "A etapa mudou, mas houve erro…"**, que não existe mais.
   Inofensivo (testa só a exibição do erro); trocar por "Erro ao mudar a etapa da obra" quando mexer no arquivo.

## Não verificado

- Comportamento real contra o banco de produção (RPC, trigger, histórico): conferido só por leitura do SQL
  aplicado e pelos testes com mock. O teste manual pós-deploy da spec §8 / plano T9 (dois navegadores no
  mesmo bloco; troca de etapa com linha nova no Histórico; Triagem com data inválida) continua necessário.
- Formato do `numeric` de `valor` devolvido pelo PostgREST: a igualdade da versão depende de a página e a
  action lerem pelo mesmo `select('*')`, o que é o caso — mas não foi observado em produção.
- `npm test` completo na raiz (rodei só `app/obras`).
