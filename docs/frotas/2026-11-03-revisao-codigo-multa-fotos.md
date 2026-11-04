# Revisão independente de código: `feat/frotas-multa-fotos-checklist` (03/11/2026)

**Revisor:** agente independente, que não escreveu nada deste branch. **Base:** `git diff master...HEAD` na worktree
`C:\Users\joao-\wt-frotas-multa-fotos-checklist` (10 commits, de `4f2db36` a `5f8774d`, Tarefas 1 a 8 do plano). **Fontes:**
spec `2026-11-03-frotas-multa-fotos-checklist-design.md` (com o "AJUSTE OBRIGATÓRIO pós-spec"), a revisão do SQL
`docs/frotas/2026-11-03-revisao-sql-multa-avaria.md`, o plano, `AGENTS.md`, `.claude/rules/sofia.md` e `sql.md`.

**Execução na worktree:**
- `npx tsc --noEmit`: fora de obras, portal-obra e scripts, só o erro esperado em
  `app/(operacoes)/sofia/pendencias/page.tsx(68,5)`, porque a página ainda passa `status` em vez de `etapa`. A página fica
  para a Tarefa 9.
- `npx jest -i lib/sofia "app/.operacoes./sofia" components/sofia`: **62 suites e 678 testes passaram**, com 1 suite e
  2 testes pulados que já eram pulados antes. Nenhuma falha.

## Veredito

**O código das Tarefas 1 a 8 pode seguir. Não há bloqueante no que foi escrito.** O SQL tem B1, A1 a A6, N2 e N3 aplicados
ao pé da letra, e N1 não foi aplicado, como pedido. As actions checam o papel antes de qualquer escrita, a checagem de admin
falha fechada, e nenhuma action do branch escreve `status`, `autorizacao_status` ou `valor_descontado` direto.

**O branch ainda não pode ser deployado.** A Tarefa 9 (integração) não foi feita e há um item que o plano dela não prevê
(o BLOQUEANTE-D1 abaixo). Sem ele, a parte de multas da tela Descontos para de funcionar logo depois do SQL.

---

## (1) SQL: `sdd-sql-sofia-multa-avaria.sql` e o arquivo de teste

Conferido linha por linha:

| Item | Onde está | Situação |
|---|---|---|
| B1: valor, motorista, condutor, veículo e data congelam a partir de `solicitado` | `.sql:220-227`, antes do ramo "UPDATE sem mudar a etapa"; teste g20/g21; verificação v21 | OK, idêntico ao texto da revisão |
| A1: avaria com `on delete cascade` e DELETE só sem o checklist pai | `.sql:486`, `:523-530` | OK |
| A2: `avaria_id` com `on delete cascade` | `.sql:575` | OK |
| A3: `sofia_fotos_imutaveis` (`security definer`, IF externo por tabela, `return old`) | `.sql:596-637` | OK |
| A4: seção 8b, `sofia_excluir_registro_so_admin` + 2 triggers + audit_log | `.sql:657-701` | OK |
| A5: v22 a v25, "Esperado: 24 OK", ROLLBACK | `.sql:805-823`, `:840-842` | OK |
| A6: p3, u15, n3, g9/g10 só `P0001`, a4 a a7, z2 novo, 51 casos | teste: cabeçalho `51/51`; IDs p1–p3, u1–u15, n1–n3, g1–g14, a1–a3, g15–g21, a4–a7, z1–z2 | OK (51 casos contados) |
| N2: RPC recusa repetir a etapa, exceto `condutor` | `.sql:387-389` | OK |
| N3a: seção 0 só barra `posicao` desconhecida antes de existir `tipo_foto` | `.sql:55-63` | OK |
| N3b: backfill do prazo só antes de `trg_multas_etapa` existir | `.sql:132-141` | OK |
| N1 **não** aplicado | `.sql:125` continua `autorizado → 'autorizado'`; o cabeçalho (`:18`) registra que aguarda o João | OK |

**O gestor não chega a `autorizado` por nenhum caminho:**
- pela RPC (`:380-385`, com `sofia_is_admin() is not true`);
- por UPDATE de `etapa` (`:261-264`; de qualquer outra origem cai em `:274-275`);
- por UPDATE de `status` ou `autorizacao_status` sem mudar a etapa (`:231-234`, recusado para qualquer papel);
- por INSERT (`:201-217`, só `registrada` com os valores derivados);
- pulando de `solicitado` direto para `descontada` (`:276-279`).

O B1 também fecha o desvio "autoriza R$ 100 e desconta R$ 5000".

**Excluir checklist ou sinistro:** só admin (`:667`, com `is not true`). O `audit_log` recebe o registro, as fotos e as
avarias antes da cascata (`:683-689`). Os arquivos ficam no bucket, porque não há policy de DELETE.

**Foto avulsa não pode ser apagada nem alterada por ninguém,** nem pelo admin com papel `postgres` (casos a4 e a5).
UPDATE é sempre recusado. DELETE só passa quando o pai já não existe, ou seja, dentro da cascata.

**Guardas:** todas usam `is not true`, e a v07 confere que não existe `if not v_`.

## (2) Actions: checagem de papel e escrita direta de status

**Actions do branch:**
- Checam o papel antes de escrever: `registrarEtapaMultaAction`, `editarPrazoMultaAction`, `registrarDobroAction`,
  `marcarAvariaReparadaAction` e `definirAcaoAvariaAction` (`requireGestorFrotas`), e `excluirChecklistAction` e
  `excluirSinistroAction` (`ehAdminSofia`).
- `criarMultaAction`, `criarChecklistAction` e `criarSinistroAction` não checam papel. Isso é proposital: qualquer usuário
  do Sofia registra, e a RLS e as triggers cuidam do resto.
- **Admin falha fechada:** `lib/sofia/multaPermissoes.ts:24-34` só aceita `data === true`. Erro e exceção viram `false`.
- **Autorizar ou revogar:** `multas/_actions.ts:178-190` lê a etapa e exige admin antes da RPC. O banco confere de novo.
- **Nenhuma action do branch escreve `status`, `autorizacao_status` ou `valor_descontado` direto.** O
  `enviarParaDescontoEmMassaAction` foi removido e o `atualizarAutorizacaoMultaAction` agora passa pela RPC.

**Busca em todo o repositório.** Estas escritas diretas vão ser **recusadas pela trigger depois do SQL**:

| Arquivo:linha | Escrita | Efeito depois do SQL |
|---|---|---|
| `app/(operacoes)/sofia/descontos/_actions.ts:23` (`atualizarStatusMultaAction`) | `update({ status })` em `multas` | recusada ("derivados da etapa"); usada em `descontos/page.tsx:136` |
| `app/(operacoes)/sofia/descontos/_actions.ts:45-48` (`registrarDescontoMultaAction`) | `update({ valor_descontado, tipo_desconto, autorizacao_assinada, status: 'descontada' })` | recusada; usada em `descontos/page.tsx:138` |
| `app/(operacoes)/sofia/descontos/_actions.ts:60` (`desfazerDescontoMultaAction`) | `update({ status: 'validada' })` | recusada; usada em `descontos/page.tsx:140` |

Os três estão previstos na Tarefa 9, item 2 (remover as actions e os botões de multa da tela).

Não quebram:
- Exclusão em massa (`multas/_actions.ts:110`, RPC `excluir_multas_em_massa`) e exclusão unitária (`:87`). A trigger nova só
  pega INSERT e UPDATE, e `multa_etapas` sai junto pela cascata.
- Alertas (`lib/sofia/alertas/leitura.ts:37`), pendências, custos, visão geral, ficha do motorista e veículo: só leem. O
  `status` continua preenchido, porque é derivado da etapa.
- `km/_actions.ts:187` e `sinistros/_actions.ts:17` escrevem `autorizacao_status` em outras tabelas, que a trigger não pega.

## (3) Seleção ambígua: duas FKs de `multas` para `motoristas`

Com `motorista_condutor_id`, um `motoristas(...)` sem `!coluna` numa seleção a partir de `multas` vira PGRST201:

| Arquivo:linha | Seleção | Situação |
|---|---|---|
| **`app/(operacoes)/sofia/descontos/page.tsx:50`** | `'*, veiculos(placa), motoristas(nome)'` | **AMBÍGUO**: ver BLOQUEANTE-D1 |
| `app/(operacoes)/sofia/multas/page.tsx:15` | `motoristas!motorista_id(nome)` | OK |
| `app/(operacoes)/sofia/multas/[id]/page.tsx:58` | `motoristas!motorista_id(nome)` | OK |

Nenhuma seleção a partir de `motoristas` ou `veiculos` traz `multas(...)` aninhado (procurei `multas(` no repositório e não
há nenhum). As outras leituras de `multas` não trazem motoristas junto.

## (4) Fotos extras, histórico do checklist e Pendências (B8)

- **Teto de 30:** vale na tela (`checklist/novo/_form.tsx:125`, botão desabilitado e `FotosAdicionais` some no teto), na
  validação do servidor (`_validation.ts` `validarFotosEAvarias`) e no sinistro (`sinistros/_actions.ts:49` e no form).
- **Compressão:** continua no `CameraCapture`, que todas as fotos usam (`comprimirImagem`, 1600 px, JPEG 0,85). O termo da
  multa também é comprimido quando é imagem (`_fluxo.tsx:68-74`).
- **`avaria_ref` vira id:** os ids são gerados no servidor (`crypto.randomUUID`), e a ordem de inserção é
  checklist, depois avarias, depois fotos (`checklist/_actions.ts:72-104`). A validação garante que toda foto de avaria
  aponta para uma avaria do mesmo envio e que cada avaria tem pelo menos 1 foto da peça e 1 do dano. O banco reconfere com
  a CHECK de coerência e com a trigger que verifica se a avaria pertence ao checklist.
- **O caminho do arquivo leva o índice** (`uploadFotos.ts:45`). Não há colisão no mesmo milissegundo.
- **Histórico e comparação:**
  - `lib/sofia/checklistHistorico.ts`: o "antes" é sempre o mais antigo; uma avaria conta como aberta na data se foi
    registrada até ela e não reparada até ela; o diff compara itens e avarias.
  - A página só aceita nos parâmetros um uuid de checklist do próprio veículo.
  - As URLs assinadas usam a sessão do usuário.
- **Pendências B8:** `pendenciaDaMulta` segue a tabela da §2.11 ao pé da letra, com o grupo "aguardando terceiros" para
  `solicitado` e `autorizado`. A página (`pendencias/page.tsx`) ainda não foi adaptada (Tarefa 9). Por isso o `tsc` falha e
  o `npm run build` não passa: o branch não sobe sem a Tarefa 9.

## (5) Next desta versão

- `revalidatePath(path, 'layout')`: assinatura `(path, type?: 'page' | 'layout')`, conferida em
  `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidatePath.md`. OK.
- `params` e `searchParams` como `Promise` com `await`: OK.
- `useActionState` vem do React: OK.
- Nada suspeito.

---

## BLOQUEANTES

### BLOQUEANTE-D1: Descontos perde todas as multas depois do SQL (seleção ambígua), e o plano da Tarefa 9 não cobre isso

- **Onde:** `app/(operacoes)/sofia/descontos/page.tsx:50`.
- **Cenário:** o SQL cria `multas.motorista_condutor_id → motoristas`. A seleção `motoristas(nome)` passa a ter duas FKs
  possíveis, e o PostgREST devolve o erro PGRST201. A página faz `(multas ?? [])`, então **a lista de multas some da tela
  Descontos sem nenhum aviso**. Sinistro e KM continuam aparecendo.
- **Por que é bloqueante:** funcionalidade que funcionava quebra. O item 2 da Tarefa 9 manda remover as 3 actions, mas não
  menciona essa seleção.
- **Correção:** na Tarefa 9, trocar para `'*, veiculos(placa), motoristas!motorista_id(nome)'`, junto com o resto do item 2
  (remover `atualizarStatusMultaAction`, `registrarDescontoMultaAction`, `desfazerDescontoMultaAction` e os botões de
  multa, e pôr o link "Abrir no fluxo da multa").
- **Fica bloqueado:** o deploy, até a Tarefa 9 ser feita com essa linha. O código das Tarefas 1 a 8 não fica bloqueado.

Pelo mesmo motivo, as 3 actions de Descontos da seção (2) e a página de Pendências também precisam da Tarefa 9 antes do
deploy. Essas já estão previstas no plano.

## NÃO BLOQUEANTES

1. **`marcarBoletoContestadaAction` não existe.** A spec §4.2 lista essa action e o plano repete na Tarefa 3, item 3. Hoje,
   numa multa `contestada` (etapa final), não há como registrar `boleto_lancado_em`. Correção: criar a action
   (`requireGestorFrotas` + `update({ boleto_lancado_em })`, que a trigger permite a gestor sem mudar a etapa) e um campo no
   detalhe quando `atual === 'contestada'`. Outra opção é registrar a ausência em `docs/DIVIDAS.md`.
2. **O botão "Excluir" do sinistro aparece para todos** (`sinistros/page.tsx:111`). A A7 pede para esconder de quem não é
   admin. O servidor e o banco recusam, então não há dano: quem não é admin vê "Apenas administradores…". Correção: envolver
   o botão em `ehAdmin` (`ehAdminSofia`), como já foi feito em `checklist/page.tsx:80`.
3. **`atualizarAutorizacaoMultaAction` devolve `void` e descarta o erro** (`multas/_actions.ts:247-252`). Na tela Descontos,
   uma recusa (por exemplo, gestor cancelando a partir de `autorizado`, item N5) passa sem nenhum aviso. Resolve-se sozinho
   se a Tarefa 9 tirar os controles de multa da tela Descontos, ou trocando o retorno para `State` e mostrando a mensagem.
4. **Avaria em rascunho se perde em silêncio.** Se o usuário preenche "+ Registrar avaria" (peça, tamanho e fotos) e envia
   o checklist sem clicar em adicionar, a avaria e as fotos dela não são salvas (`RegistrarAvaria.tsx`, o `rascunho` não
   entra em `avarias`). Correção: no `handleSubmit`, recusar o envio quando o rascunho tiver qualquer campo ou foto, com a
   mensagem "Termine ou descarte a avaria em registro".
5. **`avaria_identificada` mudou de significado.** Antes, um item marcado como "Problema" também ligava o selo. Agora o selo
   só depende das avarias registradas (`checklist/_actions.ts:38`). Só a tela de detalhe lê esse campo, e a mudança é
   coerente com a spec ("derivados"). Registro para o João saber que o selo some nesses casos.
6. **`marcarAvariaReparadaAction` diz sucesso mesmo sem atualizar nenhuma linha** (`.eq('status','aberta')` numa avaria já
   reparada, `_actions.ts:219-225`). Não há dano, porque o banco não deixa voltar nem alterar a baixa. Também falta
   recusar data de reparo anterior ao checklist da avaria. Fica para backlog.
7. **Qualquer usuário do Sofia pode inserir avaria ou foto em checklist antigo pelo PostgREST** (as policies de INSERT são
   só `sofia_has_access`). Não apaga nem altera prova, só acrescenta. Fica registrado em `docs/DIVIDAS.md` se o João quiser
   travar por janela de tempo.
8. **Erro intermediário no checklist** ("Checklist salvo, mas as avarias não foram registradas"): fica um checklist sem
   avarias e sem fotos, que só o admin exclui. É o mesmo padrão que já existia para as fotos e está documentado na spec
   (atomicidade, decisão em aberto 5).
