# Diagnóstico de permissões — Gestão de Frotas (Sofia) — 23/10/2026

Pedido do José na reunião de 20/10 [18:03]: "revisa as permissões dele, vê o que ele não tem permissão, me manda,
eu valido". Fala original: `docs/cliente/2026-10-20-reuniao-frotas-igor-jose-transcricao.md` [17:22]–[19:19].
Triagem: `docs/frotas/2026-10-23-triagem-reuniao-20-10.md` (B4, F1, F2, F3, F5).

**Método:** leitura de código e dos `.sql` do repositório. **Nada foi conferido no banco de produção** (leitura
bloqueada nesta investigação) — ver "O que não foi verificado" no fim.

---

## 1. Como o sistema decide quem pode o quê

Só existem **dois níveis**, e eles valem para o **hub inteiro**, não por sistema:

| Camada | Onde | O que faz |
|---|---|---|
| Nível | tabela `hub_user_roles.nivel` = `analista` \| `administrador` | lido por `lib/auth/roles.ts:31` (`getNivel`) e `:42` (`isAdmin`) |
| Acesso ao sistema | `hub_system_access` com `system_slug = 'sofia'` | `lib/auth/systemAccess.ts`; administrador entra em todos os sistemas |
| Trava de app | `lib/auth/requireAdmin.ts:4-15` → mensagem fixa **"Apenas administradores podem executar esta ação"**; outras actions repetem o cheque inline com mensagem própria | Server Actions em `app/(operacoes)/sofia/*/_actions.ts` |
| RLS | policy `sofia access` nas 18 tabelas, `using (sofia_has_access())` | `sdd-sql-v04-seguranca.sql:86-161` — **qualquer pessoa com o slug `sofia` lê e escreve as linhas** |
| Trigger | `sofia_bloquear_autorizacao_nao_admin()` (`sdd-sql-v04-seguranca.sql:165-251`) e `sofia_bloquear_escrita_nao_admin()` (`:260-324`), ambas checam `sofia_is_admin()` (`:53-65`) | segunda camada: mesmo que a app libere, o banco recusa |

Consequência prática: **não existe um papel "gestor de frotas"**. O Igor é `analista` (ou sem linha, o que dá no
mesmo) com o slug `sofia`. Tudo o que está marcado "admin" abaixo exige o nível `administrador` do hub — o mesmo nível
que abre `/admin/acessos` (conceder acesso e promover qualquer pessoa, `middleware.ts:103`) e as ações de admin do
Gestão de Obras (`app/obras/*`).

A trava de admin no Sofia vem de duas origens documentadas:
- **Auditoria de 16-17/07/2026, achado B-07 "gates inconsistentes"** — spec `docs/superpowers/specs/2026-07-20-gestao-frotas-seguranca-design.md:128-158`,
  commit "gate de admin em ações destrutivas/financeiras sem proteção". O critério foi técnico (o que apaga ou mexe em
  dinheiro), **não uma decisão de operação com o cliente** — nenhum documento registra o José ou o Igor validando a lista.
- **Spec v04** (`docs/superpowers/specs/2026-07-18-gestao-frotas-v04-design.md:45-47`): oficina, substituto e editar
  equipe do veículo nasceram "admin-only (segue o padrão de exclusões)".

Portanto "intencional" na tabela abaixo = **intencional do ponto de vista de segurança**, escolhido por nós. Nenhum
item foi decidido pelo cliente.

---

## 2. Tabela — ação por ação

Legenda de "Quem pode hoje": **Todos** = qualquer pessoa com acesso ao Sofia (inclui o Igor). **Admin** = só
`administrador`. **Ninguém** = a função não existe na tela.

### Equipes, veículos, motoristas (o que o José chamou de "cadastro / base")

| Ação | Quem pode hoje | Onde está a trava | Intencional? | Mensagem que o usuário vê |
|---|---|---|---|---|
| Criar equipe | Todos | — (`equipes/_actions.ts:9`) | — | — |
| Desativar equipe | Admin | `equipes/_actions.ts:51-52` + trigger `trg_bloquear_escrita_equipes` (`sdd-sql-v04-seguranca.sql:272-275`, coluna `equipes.ativo`) | Sim (B-07) | "Apenas administradores podem desativar equipes" (na caixa vermelha de confirmação) |
| Reativar equipe | Admin | `equipes/_actions.ts:34-35` (`requireAdmin`) + mesmo trigger | Sim (B-07) | **Nenhuma** — a action retorna em silêncio; o botão "Ativar" (`equipes/page.tsx:124`) simplesmente não faz nada |
| Editar equipe (código, centro de custo, motorista, carro) | **Ninguém** | Não existe action de edição de equipe | — (falta, F1) | — |
| **Trocar a equipe de um veículo** (tela do veículo, "Equipe responsável") | Admin | `veiculos/_actions.ts:108-109`; formulário `components/sofia/EditarEquipeVeiculoForm.tsx`, usado em `veiculos/[id]/page.tsx:67` | Sim (spec v04) | **"Apenas administradores podem editar a equipe do veículo"** ← é a mensagem do relato [17:46] |
| Trocar equipe/motorista **via checklist** (troca / recebimento / devolução / finalização) | Todos | Guarda `sofia_has_access() is not true` em `atribuir_responsabilidade_veiculo` (`sdd-sql-track-c-integridade.sql:143`) | Sim | — (é o único caminho que o Igor tem hoje; é o que ele descreve em [15:05]) |
| Trocar motorista de equipe sem checklist | **Ninguém** | Não existe action que atualize `motoristas.equipe_id` fora do checklist | — (falta, F1) | — |
| Cadastrar veículo (inclusive já com valor de locação) | Todos | — (`veiculos/_actions.ts:12`; o trigger só olha UPDATE) | — | — |
| **Alterar valor de locação** (tela do veículo, "Locação mensal") | Admin | `veiculos/_actions.ts:79-80` (`requireAdmin`, **lança erro**) + trigger `trg_bloquear_escrita_veiculos` (`sdd-sql-v04-seguranca.sql:276-279`) | Sim (B-07) | Tela de erro do módulo (`app/(operacoes)/sofia/error.tsx`): "Não foi possível carregar os dados" — em produção o Next troca o texto do erro por uma mensagem genérica. ← relato [14:42] "não consigo lançar o valor da locação" |
| Editar placa / modelo / ano / KM atual / KM contratual | **Ninguém** | Não existe action de edição de veículo | — (falta, F2) | — |
| Desativar veículo ("Zona de perigo") | **Todos** | **Sem trava** (`veiculos/_actions.ts:52-70`) | Inconsistente: desativar equipe e motorista exige admin, desativar veículo não | — |
| Reativar veículo | **Ninguém** | Não existe action | — | — |
| Enviar para oficina / retornar / definir substituto | Admin | `veiculos/_actions.ts:138-139`, `:176-177`, `:205-206`; UI `components/sofia/OficinaForm.tsx` | Sim (spec v04) | "Apenas administradores podem enviar veículo para oficina" / "…registrar retorno da oficina" / "…definir o veículo substituto" |
| Alterar centro de custo do veículo | Admin | `custos/_actions.ts:16-17` + trigger `trg_bloquear_escrita_centro_custo` (`sdd-sql-v04-seguranca.sql:281-284`) | Sim (B-07) | "Apenas administradores podem executar esta ação" |
| Cadastrar motorista | Todos | — (`motoristas/_actions.ts:8`) | — | — |
| Desativar motorista | Admin | `motoristas/_actions.ts:42-43` (app; **sem trigger**) | Sim (padrão de exclusão) | "Apenas administradores podem desativar motoristas" |
| Editar motorista (nome, CNH, vencimento, contato) | **Ninguém** | Não existe action | — (falta, F4 — José: "não é para agora") | — |
| Marcar termo de uso assinado | Todos | — (`motoristas/[id]/_actions.ts:5`) | — | — |

### KM diário e abastecimento

| Ação | Quem pode hoje | Onde está a trava | Intencional? | Mensagem que o usuário vê |
|---|---|---|---|---|
| Lançar KM diário | Todos | `lancar_km_atomico` (`sdd-sql-track-c-integridade.sql:87`), regra "KM não pode ser menor que a última" (`:100-107`) | Sim | "KM não pode ser menor que a última KM registrada (X km)" |
| **Corrigir KM lançado A MENOS** (mesmo dia, mesmo veículo) | Todos | Relançar na mesma data **sobrescreve** (`on conflict (data, veiculo_id) do update`, `:111-115`) | Funciona, mas ninguém sabe — não há botão "editar" | — |
| **Corrigir KM lançado A MAIS** | **Ninguém, nem admin** | `veiculos.km_atual` já subiu (`:117`); relançar menor bate na regra acima; **excluir o lançamento não volta `veiculos.km_atual`** (`km/_actions.ts:137` só apaga a linha; não há trigger que recalcule) | Não — efeito colateral não previsto | "KM não pode ser menor que a última KM registrada" — nos dias seguintes também (F2: "erro de 1 km trava os dias seguintes") |
| **Excluir lançamento de KM (X vermelho)** | Admin | `km/_actions.ts:134-135` (`requireAdmin`) + trigger `trg_bloquear_escrita_km_diario` (`sdd-sql-v04-seguranca.sql:289-291`, bloqueia todo DELETE) | Sim (B-07) | **"Apenas administradores podem executar esta ação"** ← relato [18:45] |
| Solicitar / autorizar KM excedido | Admin | `km/_actions.ts:156-157` e `:183-184` + trigger `trg_bloquear_autorizacao_km_excedido` (`:196-199`) | Sim (B-03/B-07, mexe em desconto) | **Nenhuma** — retorno silencioso; botões aparecem para o Igor (`km/page.tsx:123`) e não fazem nada |
| Lançar abastecimento | Todos | — (`abastecimento/_actions.ts:9`) | — | — |
| **Corrigir abastecimento (litros, km, valor)** | **Ninguém** | Não existe action de edição | — (falta, F3) | — |
| **Excluir abastecimento** | Admin | `abastecimento/_actions.ts:58-59` + trigger `trg_bloquear_escrita_abastecimentos` (`sdd-sql-v04-seguranca.sql:286-288`) | Sim (B-07) | **"Apenas administradores podem executar esta ação"** ← relato [19:06] |

### Multas, sinistros, descontos

| Ação | Quem pode hoje | Onde está a trava | Intencional? | Mensagem que o usuário vê |
|---|---|---|---|---|
| Registrar multa | Todos (só com status `pendente` e sem autorização) | trigger `trg_bloquear_autorizacao_multas` no INSERT (`sdd-sql-v04-seguranca.sql:202-208`) | Sim | — |
| **"Enviar para desconto"** (tirar de pendente) | Admin | `multas/_actions.ts:44-45` + trigger (coluna `multas.status`, `:182-188`) | Sim (B-07) | Botão aparece para o Igor (`multas/_table.tsx:76-82`); erro lançado, que em produção chega como mensagem genérica ← provável causa de **B2** da triagem |
| Solicitar / autorizar desconto de multa | Admin | `multas/_actions.ts:101-102` + trigger (`autorizacao_status`) | Sim (B-03) | **Nenhuma** — retorno silencioso; botão "Solicitar" aparece (`multas/_table.tsx:150-154`) e não faz nada ← também **B2** |
| Excluir multa (uma ou em massa) | Admin | `multas/_actions.ts:64-65`, `:82-83`; RPC `excluir_multas_em_massa` (`sdd-sql-track-c-integridade.sql:197`); trigger DELETE (`sdd-sql-v04-seguranca.sql:226-228`) | Sim | Botão escondido para não-admin (`multas/_table.tsx:85`, `:162`) — **é a única tela do Sofia que esconde o que o usuário não pode** |
| Registrar sinistro | Todos (sem autorização/desconto) | trigger `trg_bloquear_autorizacao_sinistros` no INSERT (`:209-215`) | Sim | — |
| Atualizar tratativa do sinistro (aberto / em tratativa / encerrado) | Todos | Sem trava: `sinistros/_actions.ts:69-81` grava `sinistros.status`, coluna que o trigger **não** olha (ele olha `status_desconto`) | — | **B1 (não salva) não é permissão** — a causa está em outro lugar, fora do escopo deste mapa |
| Solicitar / autorizar desconto de sinistro | Admin | `sinistros/_actions.ts:13-14` + trigger | Sim (B-03) | **Nenhuma** — silencioso (`sinistros/page.tsx:89-93`) |
| Excluir sinistro | Admin | `sinistros/_actions.ts:91-92` + trigger DELETE | Sim | "Apenas administradores podem excluir sinistros" |
| Tela Descontos: avançar status, registrar valor descontado, desfazer, autorizar | Admin | `descontos/_actions.ts:20,33,57,70,83,107` (`requireAdmin`, lançam erro) + triggers | Sim (B-03 — é desconto em salário, território de dinheiro) | Tela de erro genérica do módulo; os formulários aparecem para o Igor (`descontos/page.tsx:169-210`) |

### Demais subrotas

| Ação | Quem pode hoje | Onde está a trava | Intencional? | Mensagem que o usuário vê |
|---|---|---|---|---|
| Criar checklist | Todos | — | — | — |
| Excluir checklist | Admin | `checklist/_actions.ts:155-156` (app; sem trigger) | Sim (padrão de exclusão) | "Apenas administradores podem excluir checklists" |
| Registrar revisão | Todos | — | — | — |
| Editar revisão | **Ninguém** | Não existe action | — | — |
| Excluir revisão | Admin | `revisoes/_actions.ts:43-44` (app; sem trigger) | Sim (padrão de exclusão) | "Apenas administradores podem excluir revisões" |
| Cadastrar documento do veículo | Todos | — | — | — |
| Editar / excluir documento | **Ninguém** | Não existe action | — | — |
| Criar pendência / mudar status | Todos | — (`pendencias/_actions.ts`) | — | — |
| Disponibilidade | só leitura | `disponibilidade/page.tsx` não tem escrita | — | — |
| `app/api/sofia/veiculo-motorista` | só leitura | só `GET` | — | — |

---

## 3. O "pede senha" do cancelamento de KM

**Não é senha.** É o componente `components/sofia/DeleteConfirmButton.tsx`, usado em **todo** botão de excluir/desativar
do Sofia (KM, abastecimento, checklist, revisão, sinistro, multa, equipe, motorista, veículo).

1. O X vermelho abre uma caixa: "Você está excluindo *lançamento de KM de dd/mm — N km*. Digite **gestão de frotas**
   para confirmar" (`DeleteConfirmButton.tsx:13`, `:41-50`).
2. A frase é **fixa e igual para todo mundo**; a comparação é feita **no navegador**, ignorando maiúsculas e espaços
   nas pontas (`:20`). Ela só destrava o botão "Confirmar exclusão" — é uma trava contra clique acidental, não
   verificação de identidade. Obs.: exige o til — "gestao de frotas" mantém o botão desabilitado.
3. Ao confirmar, chama `deletarKmAction` (`km/page.tsx:66`). No servidor, `requireAdmin` (`km/_actions.ts:134-135`)
   recusa o Igor e devolve **"Apenas administradores podem executar esta ação"**, exibida em vermelho dentro da mesma
   caixa (`DeleteConfirmButton.tsx:39-41`). É o "acusa que eu não tenho permissão" do relato.
4. Mesmo que essa linha da app fosse removida, o banco recusaria: o trigger `trg_bloquear_escrita_km_diario`
   (`sdd-sql-v04-seguranca.sql:321-324`) bloqueia qualquer DELETE em `km_diario` de quem não é admin; o usuário veria
   "Erro ao excluir lançamento" (`km/_actions.ts:139`).

O fluxo do abastecimento é idêntico (`abastecimento/page.tsx:142` → `abastecimento/_actions.ts:58-59` → trigger
`trg_bloquear_escrita_abastecimentos`).

**O ponto mais importante:** o que o Igor quer não é apagar, é **corrigir**. E para o KM, apagar nem resolve:
- Se ele digitou **a menos**, já consegue corrigir hoje relançando o mesmo veículo na mesma data — o lançamento é
  sobrescrito. Ninguém sabe disso porque não há botão "editar".
- Se ele digitou **a mais**, o KM do veículo (`veiculos.km_atual`) já subiu. Excluir o lançamento (mesmo um admin)
  **não volta o KM do veículo**, e todo lançamento seguinte menor que o valor errado é recusado. Hoje isso só se
  conserta com SQL direto no banco: o trigger de `veiculos` não bloqueia `km_atual`, mas nenhuma tela edita esse campo.

---

## 4. Opções (não decididas — território de autorização)

Este é um dos cinco territórios em que falha silenciosa é o erro (`AGENTS.md`); em 10/08/2026 a RLS de
`hub_system_access` estava aberta e qualquer logado se concedia acesso (`docs/HISTORICO-INCIDENTES.md`). Nada abaixo
deve ser feito sem decisão do João e validação do José.

| Opção | O que resolve | Risco / custo |
|---|---|---|
| **A. Promover o Igor a `administrador`** (pela tela `/admin/acessos`, sem deploy) | Tudo, hoje | **Alto.** O nível é do hub inteiro: ele passaria a conceder acesso e promover qualquer pessoa em `/admin/acessos`, entraria em todos os sistemas, teria as ações de admin do Gestão de Obras, autorizaria desconto em salário e apagaria multas. Não recomendado. |
| **B. Criar um papel "gestor de frotas" só para o Sofia** | O que o José validar, sem dar poder no resto do hub | Exige **mudança de schema** (novo nível ou coluna de papel por sistema) e **trocar as duas funções de trigger e o `requireAdmin`** nas actions escolhidas — as duas camadas têm de mudar juntas, senão uma continua bloqueando (ou pior, a app libera e o trigger não, ou vice-versa). A função nova precisa devolver sempre true/false (`exists`/`coalesce`), guarda com `is not true`. Migration manual + teste com JWT forjado como em `sdd-sql-v04-seguranca.sql:17-22`. |
| **C. Trocar "excluir" por "corrigir" no KM e no abastecimento**, mantendo excluir só para admin | O pedido real (F2, F3) sem abrir exclusão | Para abastecimento é uma action de UPDATE simples (RLS já permite; trigger não olha UPDATE). Para KM precisa de função no banco que corrija o lançamento **e recalcule `veiculos.km_atual`** a partir do maior lançamento restante, com trava na linha (mesmo padrão de `lancar_km_atomico`) — senão volta a race condition B-13. Correção sem histórico apaga o valor anterior: precisa registrar no `audit_log` o antes/depois. |
| **D. Fluxo de aprovação** (sugestão do José [18:03]): Igor pede, admin aprova | Mantém o admin no controle de dinheiro e exclusão | Mais construção (tela de pedidos, notificação). Faz sentido para desconto em salário e exclusões; é excessivo para corrigir litro digitado errado. |
| **E. Tirar a trava de ações específicas** (liberar para todos com acesso ao Sofia) | Rápido para itens sem dinheiro (ex.: equipe do veículo, oficina, reativar equipe) | "Todos com acesso ao Sofia" = quem tiver o slug `sofia` — **lista não conferida** (ver abaixo). Precisa mexer em app e, onde houver, no trigger. Ações sem trigger (equipe do veículo, oficina, motorista, checklist, revisão) dependem só da app. |

Independente da opção, há dois problemas de tela que valem sozinhos: (1) botões que o Igor vê e que **não fazem nada,
em silêncio** (reativar equipe, solicitar/autorizar desconto, KM excedido); (2) erros que caem na tela genérica
"Não foi possível carregar os dados" (locação, tela Descontos, enviar para desconto). Ele não tem como saber que é
permissão.

---

## 5. Para o José validar (linguagem leiga, pronto para colar)

> José, revisei as permissões do Igor no Gestão de Frotas. Hoje o sistema só tem dois níveis — "administrador" (vale
> para o hub inteiro, inclusive para dar acesso a outras pessoas) e "usuário comum". O Igor é usuário comum. Abaixo,
> o que ele **não** consegue fazer hoje. Responde sim ou não em cada um: **o Igor deve poder fazer isso?**
>
> **Cadastro (equipe, carro, motorista)**
> 1. Trocar a equipe de um carro direto na tela do veículo, sem fazer checklist. (Hoje: só administrador.) — Sim / Não
> 2. Ativar de novo uma equipe desativada. (Hoje: só administrador, e o botão não avisa nada.) — Sim / Não
> 3. Desativar uma equipe ou um motorista. (Hoje: só administrador.) — Sim / Não
> 4. Lançar e alterar o valor da locação de cada carro. (Hoje: ele consegue informar ao cadastrar o carro, mas não consegue alterar depois.) — Sim / Não
> 5. Mandar carro para oficina, registrar a volta e escolher o carro substituto. (Hoje: só administrador.) — Sim / Não
> 6. Alterar o centro de custo do carro. (Hoje: só administrador.) — Sim / Não
>
> **KM diário e abastecimento**
> 7. Corrigir um KM diário digitado errado (editar, não apagar). (Hoje: não existe para ninguém. Se digitou a mais, trava os dias seguintes até a gente corrigir no banco.) — Sim / Não
> 8. Apagar um lançamento de KM diário. (Hoje: só administrador.) — Sim / Não
> 9. Corrigir um abastecimento digitado errado — litros, km, valor (editar, não apagar). (Hoje: não existe para ninguém.) — Sim / Não
> 10. Apagar um abastecimento. (Hoje: só administrador.) — Sim / Não
>
> **Multas, sinistros e descontos (mexe em desconto no salário)**
> 11. Enviar multa para desconto (tirar de "pendente"). (Hoje: só administrador.) — Sim / Não
> 12. Pedir autorização de desconto de multa, sinistro ou KM excedido. (Hoje: só administrador, e o botão não avisa nada.) — Sim / Não
> 13. Autorizar o desconto e registrar o valor descontado. (Hoje: só administrador.) — Sim / Não
> 14. Apagar multa ou sinistro. (Hoje: só administrador.) — Sim / Não
>
> **Outros**
> 15. Apagar checklist ou revisão. (Hoje: só administrador.) — Sim / Não
>
> Se a resposta for "sim" em vários, a ideia é criar um nível próprio de "gestor de frotas", em vez de tornar o Igor
> administrador do hub inteiro. Para os itens de desconto (11 a 13), dá para fazer com aprovação: ele pede e você
> aprova.

Observação para o João, fora da lista do José: desativar **veículo** hoje qualquer usuário faz (sem trava), enquanto
desativar equipe e motorista exige admin — e ninguém consegue reativar um veículo pela tela.

---

## O que não foi verificado

- **Nível real do Igor e se ele tem o slug `sofia`** em produção (leitura bloqueada). Pela fala, ele cadastra e lança,
  então tem acesso; o nível presumido é `analista`/sem linha.
- **Quem mais tem o slug `sofia`** — decide o risco da opção E.
- Se os triggers aplicados em produção são idênticos ao arquivo (`sdd-sql-v04-seguranca.sql` diz "aplicado em
  10/08/2026"; não conferido hoje).
- O texto exato que o Next mostra em produção quando uma Server Action lança erro (locação, Descontos, enviar para
  desconto): a doc do Next (`error.md`) diz que erros de Server Components chegam com "mensagem genérica com
  identificador"; não reproduzido.
- Não foi reproduzido em navegador nenhum dos fluxos; tudo é leitura de código.
