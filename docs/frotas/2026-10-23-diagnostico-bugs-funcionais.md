# Diagnóstico — bugs funcionais da reunião de Frotas (B1, B2, B3, B5, B6, B7, B8)

Data: 2026-10-23. Método: leitura de código e dos `.sql` do repositório. **Nada foi consultado no banco de produção** e nada foi executado. Onde a conclusão depende de dado ou de comportamento de runtime, está dito.
B4 (permissões de KM, abastecimento, equipes, locação) foi para outro agente e não está aqui.

Fatos gerais que valem para vários itens:
- O trigger `sofia_bloquear_autorizacao_nao_admin` (`sdd-sql-v04-seguranca.sql:165-246`) **só guarda**: em `multas` -> `autorizacao_status`, `valor_descontado`, `status`; em `sinistros` -> `autorizacao_status`, `valor_descontado`, `status_desconto`. **A coluna `sinistros.status` (a tratativa) NÃO é guardada.**
- As actions de autorização usam `requireAdmin` e, se o usuário não é admin, **voltam sem dizer nada** (`return` sem mensagem).

---

## B1 — Sinistro: atualizar/encerrar a tratativa "não salva"

**Sintoma (Igor):** aparece "salvando", volta "aberto", sem confirmação.

**Fluxo:** `sinistros/[id]/_form.tsx` -> `atualizarTratativaSinistroAction` (`sinistros/_actions.ts:69-81`) -> `supabase.from('sinistros').update({ status }).eq('id', id)`.

**O que a action grava:** apenas a coluna `status` (`aberto | em_tratativa | encerrado`). Não há `requireAdmin` nela. A trigger **não** recusa essa coluna (ela compara `autorizacao_status`, `valor_descontado` e `status_desconto`, `sdd-sql-v04-seguranca.sql:189-195`). Portanto **a trava de segurança não é a causa** de o "encerrar" falhar, ao contrário do que a triagem suspeitava.

**Causa raiz provável (UI, não banco):**
- `_form.tsx:28-30`: o `<select>` é não controlado, `defaultValue={sinistro.status}`. No React 19 (19.2.4, `package.json:19`), um `<form action>` **reseta os campos ao terminar a action**, e o reset volta ao valor com que o `<select>` foi montado (o valor antigo). `router.refresh()` (`_form.tsx:12-14`) traz o `sinistro.status` novo, mas mudar `defaultValue` de um select já montado não muda o que está selecionado. Resultado: o campo volta a "Aberto" mesmo quando gravou.
- Não existe mensagem de sucesso: `state.success` só dispara `router.refresh()` (`_form.tsx:12-14`); só `state.error` é exibido (`_form.tsx:20-24`). O usuário não tem como saber se salvou.
- A página de detalhe não mostra o status atual em texto (`[id]/page.tsx:29-47`); só o select.
- Agravante: na lista, a coluna Autorização (`sinistros/page.tsx:84-96`) mostra o botão "Solicitar" para qualquer usuário, mas `atualizarAutorizacaoSinistroAction` (`_actions.ts:8-25`) sai calado se não for admin (`:13-14`), e mesmo que passasse, a trigger recusaria. Se o Igor tentou "encerrar" por ali, é isso que ele viu (ver B2).

**Não consegui verificar:** se o `status` chegou a ser gravado no banco do Igor. A hipótese do reset de formulário é por leitura de código e do comportamento do React 19, **não** foi reproduzida no navegador. Teste que decide: salvar "Encerrado" e recarregar a página (F5); se aparecer "Encerrado" na lista (`/sofia/sinistros`, coluna Status), o banco gravou e o bug é só de tela.

**Classificação:** BUG (de UI, feedback e reset do select). Parte do que o Igor sentiu em autorização é TRAVA INTENCIONAL sem aviso (ver B2).

**Correção proposta:** `key={sinistro.status}` no `<form>` (ou select controlado com `useState`), mais uma mensagem "Tratativa salva" quando `state.success`. Cerca de 8 a 10 linhas, em `sinistros/[id]/_form.tsx`.
**Exige SQL?** Não.

---

## B7 — Sinistro aberto sem botão de voltar

**Sintoma:** a tela do sinistro não tem voltar.

**Causa raiz:** `sinistros/[id]/page.tsx:29-47` não tem nenhum `Link`/botão de retorno; só o título, descrição, fotos e o formulário. Não há layout de subnível com breadcrumb (o `layout.tsx` do route group só monta a Sidebar).

**Classificação:** FALTA (nunca foi feito).

**Correção proposta:** um `<Link href="/sofia/sinistros">← Voltar</Link>` no topo. 3 a 5 linhas. O mesmo vale para `checklist/[id]/page.tsx`, se quiserem consistência (não conferi se já tem).
**Exige SQL?** Não.

---

## B2 — Multa: registra, mas não solicita desconto nem sai de "pendente"

**Sintoma:** registra a multa, mas não consegue solicitar desconto nem tirar de pendente.

**Ações que existem e quem pode:**

| Ação | Onde | Guarda no app | Guarda no banco (trigger) |
|---|---|---|---|
| Registrar multa | `multas/_actions.ts:11-40` | nenhuma | insert só passa com `autorizacao_status='sem_solicitacao'`, `valor_descontado null`, `status='pendente'` (`v04-seguranca.sql:202-208`), que é o padrão. Por isso o Igor consegue registrar |
| "Solicitar" desconto (botão no badge de autorização) | `multas/_actions.ts:96-113` | `requireAdmin`, **sai calado** (`:101-102`) | recusa mudança de `autorizacao_status` (`:183-188`) |
| "Enviar para desconto" (pendente -> validada, em massa) | `multas/_actions.ts:42-54` | `requireAdmin`, lança erro (`:44-45`) | recusa mudança de `status` (`:185`) |
| Registrar desconto / status / desfazer | `descontos/_actions.ts:16-64` | `requireAdmin`, lança erro | idem |
| Excluir | `multas/_actions.ts:56-94` | só admin | só admin |

**Onde trava:** tudo que tira a multa de "pendente" é admin-only duas vezes (app e trigger). Para não-admin:
- O botão "Solicitar" **aparece** (`multas/_table.tsx:149-154` renderiza `AutorizacaoActions` sem olhar `isAdmin`; o componente `components/sofia/AutorizacaoActions.tsx` nem recebe essa informação). Ao clicar, a action retorna sem fazer nada e sem aviso: a tela só recarrega igual. É o "não consegue solicitar".
- "Enviar para desconto" também aparece para todos (`_table.tsx:78-84`; só o "Excluir" é gateado por `isAdmin`, `:85`). A action lança `Apenas administradores...`; o `catch` mostra `e.message` (`_table.tsx:53-55`), mas em produção o Next **mascara** a mensagem de erros lançados em Server Action, então o que aparece é uma mensagem genérica, provavelmente sem o texto "administradores" (comportamento do Next em produção, não testado aqui).
- A página de Descontos (`descontos/page.tsx`) usa as mesmas actions, com o mesmo efeito.

**Classificação:** TRAVA INTENCIONAL (bloqueio de segurança de admin, decisão registrada no `v04-seguranca`) **+ UI que não avisa** (botão visível e inútil, ação silenciosa). Não é bug de lógica.

**Decisão do João/José necessária (D2):** o Igor deve poder *solicitar* desconto? Duas saídas:
1. **Sem SQL, ~10 a 15 linhas:** esconder (ou desabilitar com texto "só administrador") os botões Solicitar/Enviar para desconto quando `!isAdmin`; passar `isAdmin` para `AutorizacaoActions` (`showActions={isAdmin}` já existe como prop, `AutorizacaoActions.tsx:29`, `:52`) nas telas de multas, sinistros e descontos. O Igor passa a ver o estado, mas não age.
2. **Com SQL:** deixar o gestor de frotas pedir. Exige mudar a trigger (`sdd-sql-v04-seguranca.sql:183-186`, `:190-193`) para permitir a transição `sem_solicitacao -> solicitado` (e, para sair de pendente, `pendente -> validada`) a não-admin, mantendo `autorizado`/`descontada`/`valor_descontado` só para admin, e afrouxar a action. **Território de exceção do AGENTS.md (RLS/autorização/dinheiro)**: precisa de aprovação e revisão independente. Cerca de 25 a 40 linhas entre SQL e actions.

**Exige SQL?** A opção 1 não; a opção 2 sim.

---

## B3 — Checklist: os já feitos não aparecem; sempre "criar primeiro"

**Causa raiz (forte, por leitura do schema e da query):** `checklist/page.tsx:18-22`:
```
.from('checklist').select('*, equipes(codigo), veiculos(placa), motoristas(nome)')
```
A tabela `checklist` tem **duas chaves estrangeiras para `equipes`** (`equipe_id` e `equipe_destino_id`) e **duas para `motoristas`** (`motorista_id` e `motorista_destino_id`) — `sdd-sql-passo1.sql:46-69`. Com mais de uma FK para a mesma tabela, o PostgREST não sabe qual usar no embed `equipes(...)` / `motoristas(...)` e responde erro de relação ambígua (PGRST201, 300). A página só lê `{ data: checklists }` e **ignora `error`** (`page.tsx:18`), então `data` vem nulo, `(checklists ?? [])` fica vazio, e cai em "Nenhum checklist ainda. Criar primeiro" (`page.tsx:74-81`). Os checklists existem no banco (a criação funciona: `_actions.ts:45-66`); só a leitura falha.

Confirmações no código:
- Nenhuma query do Sofia desambigua com hint de FK (`grep` por `fkey`/`equipes!` em `app/(operacoes)/sofia`: 0 resultados).
- O detalhe `checklist/[id]/page.tsx:22` tem o mesmo embed ambíguo com `.single()`: o erro também some e vira `notFound()` (404), então abrir um checklist pelo link direto também falharia.
- Contraste: `lib/sofia/queries.ts:216-224` (`getChecklistsRecentes`) usa `select('*')` e **checa** o erro (`throwQueryError`), e por isso não sofre disso.

**Não consegui verificar:** o erro real devolvido pelo PostgREST em produção, nem os nomes exatos das constraints (assumo o padrão do Postgres: `checklist_equipe_id_fkey`, `checklist_motorista_id_fkey`). Sem banco, o diagnóstico é por schema e código. Teste que confirma: abrir `/sofia/checklist` com o erro logado, ou a mesma consulta com `.select('*')` puro; se listar, a causa é o embed.
Nota: o `passo1` define as duas FKs desde o início, então por esse raciocínio a lista nunca teria funcionado; se o cliente já viu checklists listados antes, a hipótese precisa ser revista (verificar a data de quando "sumiu").

**Classificação:** BUG (código errado + erro engolido).

**Correção proposta:** desambiguar com hint (`equipes!checklist_equipe_id_fkey(codigo)`, `motoristas!checklist_motorista_id_fkey(nome)`) na lista e no detalhe, e tratar `error` em vez de mostrar lista vazia (usar `throwQueryError` como em `queries.ts`). 6 a 8 linhas em 2 arquivos.
**Exige SQL?** Não (confirmar os nomes das constraints antes).

---

## B5 — Revisão: "KM previsto da próxima" não é comparado ao KM diário

**O que existe:**
- O formulário grava `proxima_km` (`revisoes/nova/_form.tsx:99-102`, `revisoes/_actions.ts:17`, `:135`).
- A lista só **mostra** o valor: `revisoes/page.tsx:80-84` exibe `proxima_data` ou, se não há data, `proxima_km` formatado. Nada compara.
- Alerta de atraso existe **só por data**: `getRevisoesAtrasadas` (`lib/sofia/queries.ts:115-131`) pega a revisão mais recente de cada veículo+tipo e marca atrasada se `proxima_data < hoje`. `proxima_km` não é lido por nenhuma lógica (`grep proxima_km` em `app/lib/components`: só o form, a action, a listagem e o tipo).
- O `status` é gravado **uma vez** na criação (`_actions.ts:130-131`: atrasada/agendada/em_dia só por data) e nunca recalculado.
- O KM atual do veículo existe e é mantido a cada lançamento de KM diário: `veiculos.km_atual` (`lib/sofia/types.ts:27`, atualizado na RPC `lancar_km_atomico`, `km/_actions.ts:95-102`). Ou seja, o dado para comparar já está no banco.

**Onde deveria estar:** em `getRevisoesAtrasadas` (`queries.ts:115`), que alimenta a tela de Revisões (`revisoes/page.tsx:30`), as Pendências (`pendencias/page.tsx:55`, `lib/sofia/pendencias.ts:32-34`) e o painel inicial (`sofia/page.tsx:26`): bastaria buscar `veiculos.km_atual` e tratar `proxima_km != null && km_atual >= proxima_km` como atrasada. Efeito colateral a decidir: o aviso "quando falta pouco" (ex.: 500 km antes) é regra nova, não existe.

**Classificação:** FALTA (a lógica de alerta por KM nunca foi escrita).

**Correção proposta:** 20 a 30 linhas (join/consulta de `km_atual` por veículo em `getRevisoesAtrasadas`, regra de comparação, ajuste do texto em `pendencias.ts:33` para dizer "KM" ou "data", teste unitário). Mais a decisão de produto sobre o aviso antecipado. Passa de 20 linhas: pelo `AGENTS.md`, perguntar ao João antes.
**Exige SQL?** Não.

---

## B6 — Revisão lançada não abre o detalhe (observações, peças)

**O que existe:** não há página nem modal de detalhe de revisão. `app/(operacoes)/sofia/revisoes/` tem só `page.tsx`, `_actions.ts` e `nova/` (sem `[id]`); as linhas da tabela (`revisoes/page.tsx:69-93`) não têm link.

**Os dados são gravados?**
- `observacoes`: **sim**, `_actions.ts:126` e `:135` gravam; a coluna existe (`sdd-sql-passo1.sql`, tabela `revisoes`). Só não é exibida em lugar nenhum (a listagem não seleciona nem mostra observações nem `km_realizada`; o `select` é `*`, então o dado chega à página, mas não é renderizado).
- `fornecedor`, `valor`, `data_realizada`, `km_realizada`: gravados; `fornecedor`, `valor` e `data_realizada` aparecem na lista, `km_realizada` não.
- **Peças trocadas: não existe campo nem coluna.** `revisoes` não tem coluna de peças (nem tabela de itens). Se o José/Igor esperam registrar peças, isso é schema novo.
- `nota_fiscal_storage_path` existe na tabela, mas o formulário/action não gravam (não há upload na action).

**Classificação:** FALTA (nunca foi feito; o José chamou de bug).

**Correção proposta:**
- Só observações + dados já gravados: página `revisoes/[id]/page.tsx` (somente leitura) e link na linha. 40 a 60 linhas, **sem SQL**.
- Com peças trocadas: coluna `jsonb`/texto em `revisoes` ou tabela `revisao_pecas`, formulário e exibição. 80 a 120 linhas e **exige SQL** (alterar schema: pelo `AGENTS.md`, parar e perguntar).
**Exige SQL?** Sem peças, não; com peças, sim.

---

## B8 — O que a tela de Pendências considera pendência (em linguagem leiga)

Fonte: `pendencias/page.tsx:52-98`, `lib/sofia/pendencias.ts:15-43`, `lib/sofia/queries.ts`.

A tela junta duas listas. **Automáticas** (calculadas na hora, não têm botão de status) e **manuais** (cadastradas em "Nova pendência", com status e responsável).

Regras das automáticas:
1. **Multa:** toda multa que **não esteja "descontada"**, ou seja, as pendentes **e** as validadas. Texto: "Multa sem tratativa: ...". O prazo exibido é a data da multa. Isso inclui multa que já foi enviada para desconto e está só esperando o desconto sair; ela continua aparecendo como "sem tratativa", o que pode ser enganoso.
2. **Sinistro:** todo sinistro que **não esteja "encerrado"** (aberto ou em tratativa). Texto: "Sinistro sem encerramento: ...". Prazo = data do sinistro.
3. **Manutenção atrasada:** para cada veículo e tipo (preventiva/corretiva) considera só a **revisão mais recente**; se a "próxima data prevista" dela já passou, vira pendência. **KM não entra** (ver B5). Se a revisão não tem data prevista, nunca vira pendência. Prazo = a data prevista.
4. **Documento do veículo vencendo:** qualquer documento cujo vencimento seja **hoje, no passado ou nos próximos 30 dias** (`getDocumentosVencendo`, `queries.ts:142-152`: só `vencimento <= hoje+30`, sem limite inferior, então documento vencido há anos segue aparecendo, e nunca sai a menos que se registre um novo com vencimento futuro, e mesmo o antigo continua listado). Texto: "Documento (tipo) vencendo".
5. **Termo de uso não assinado:** todo motorista **ativo** que não tenha o documento "termo de uso" marcado como assinado. Sem prazo.

Observações de comportamento:
- Toda automática aparece sempre como "Aberta" e **não pode ser concluída pela tela** (`id` nulo, sem botão, `page.tsx:86`, `:176`); ela some só quando a situação real muda (multa descontada, sinistro encerrado, etc.).
- As manuais avançam Aberta -> Em andamento -> Concluída.
- "Urgência alta" = abertas com prazo vencido; "Aguardando terceiros" = manuais em andamento; "Resolvidos hoje" só conta manuais concluídas hoje (as automáticas nunca estão concluídas).
- O prazo da multa/sinistro é a **data do fato**, então tudo antigo aparece como "atrasado" (linha vermelha), mesmo sem prazo real definido. Provável fonte da dúvida do José sobre "o que de fato é pendência".

**Classificação:** não é bug de código; as regras fazem o que foram escritas para fazer. Se o cliente discorda do critério, é FALTA de definição (decisão de produto). A regra 4 (documento vencido para sempre) e o prazo = data do fato (regra 1 e 2) são os candidatos mais claros a ajuste.

**Correção proposta:** nenhuma sem decisão. Se pedirem: ajustes pontuais de 5 a 15 linhas em `pendencias.ts`/`queries.ts`.
**Exige SQL?** Não.

---

## Resumo

| Item | Classificação | Tamanho | SQL? |
|---|---|---|---|
| B1 | BUG de UI (reset do select + sem confirmação); a trigger NÃO bloqueia `sinistros.status` | 8-10 linhas | Não |
| B2 | TRAVA INTENCIONAL + UI que não avisa | 10-15 linhas (esconder) ou 25-40 (liberar) | Só se liberar |
| B3 | BUG (embed ambíguo de FK + erro engolido) | 6-8 linhas | Não |
| B5 | FALTA | 20-30 linhas | Não |
| B6 | FALTA (peças trocadas: nem existe campo) | 40-60 linhas (sem peças) | Só com peças |
| B7 | FALTA | 3-5 linhas | Não |
| B8 | Regras documentadas; sem bug | 0 | Não |

## O que não foi possível verificar
- Nada em produção (banco bloqueado por instrução): não confirmei se o `status` do sinistro chega a gravar (B1), o erro real do PostgREST nem os nomes das constraints do `checklist` (B3).
- O comportamento do reset de formulário do React 19 e da máscara de erro de Server Action em produção é inferência de leitura, não foi reproduzido no navegador.
- Não conferi se existe alguma trigger adicional em `sinistros` criada fora dos `.sql` do repositório (migrations são manuais; só se descobre no banco).
