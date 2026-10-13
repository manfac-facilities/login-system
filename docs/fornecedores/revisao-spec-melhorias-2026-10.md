# Revisão independente — spec de melhorias do Gestão de Fornecedores (13/10/2026)

Spec revisada: `docs/fornecedores/spec-melhorias-2026-10.md`.
Conferido contra: clone `D:\fornecedores-work\fornecedores-melhorias` (`017e0d9`), mockup aprovado
`mockup-melhorias-2026-10-12.html`, retorno do cliente (7 suposições), `AGENTS.md` e `.claude/rules/sql.md`.
Não acessei o banco de produção: **todas as afirmações da tabela "Banco medido" (CT-0001, contagens, hashes) ficaram
sem verificação minha**; conferi só o que o código e as migrations dizem.

## Veredito: APROVADA COM AJUSTES

Há **2 bloqueantes**, ambos de dinheiro e ambos corrigíveis com poucas linhas de spec. Não despachar as frentes
antes de fechá-los. Fora isso a spec é sólida: os arquivo:linha batem, o modelo de escrita (RLS, `service_role`,
booleanos nunca `NULL`) está preservado e o mockup foi coberto.

---

## Bloqueantes

### B1. A integração com o Financeiro lê a condição "ao vivo" e a spec não a lista (dinheiro, prazo de pagamento)

- **Evidência:** `lib/integracoes/financeiro.ts:456` seleciona `condicao:frn_condicoes(dias_pagamento, modo)` pelo
  `condicao_codigo` da medição, e `:448` usa isso em `diasPagamento` (`diasDe(condicao.modo === "excecao" ? r.excecao_dias : condicao.dias_pagamento)`).
  Esse valor vira o vencimento enviado ao Financeiro (`:182`, `lib/regras/vencimento.ts:14-17`).
- **A spec afirma (§1.5 "Hoje") que lista tudo que lê condição ao vivo** (SQL de `005` e `medicoes/_dados.ts`) e **não
  cita este arquivo**; ele também não está em nenhuma frente de §4.
- **Dano:** depois de o José editar `dias_pagamento` de uma condição, a medição de contrato já aprovado (pinado na
  v1) seria enviada ao Financeiro com o prazo da v2. Aumento de prazo: vencimento mais tarde que o combinado, passa
  na checagem do banco (`005:1199-1202`, que usará a v1) sem ninguém ver. Redução: o banco recusa
  ("Vencimento antes do prazo da condição") e a solicitação fica presa em falha. É exatamente o que a suposição 2
  proíbe.
- **Correção:** acrescentar a §1.5 ("Hoje") e à Frente B: `carregarMedicaoDoBanco` passa a ler
  `frn_condicoes_versoes` por `(condicao_codigo, condicao_versao)` da medição (select separado ou embed pela FK
  composta), nunca `frn_condicoes`. Teste em `tests/integracoes/*`: condição editada depois da medição não muda
  `diasPagamento`. Incluir o arquivo na lista de frentes (B) e no CA-E3 (que hoje só cobre o SQL).

### B2. `parcelas_ajustadas` sobrevive a devolução e a novo salvamento e pode ser aplicada a outra condição ou versão (dinheiro, parcelas)

- **Evidência:** a spec grava `parcelas_ajustadas` em `frn_alterar_e_aprovar_condicoes` (§2.2) e a zera só no aditivo
  de condição (§2.1, `frn_aprovar_aditivo`). `frn_devolver_contrato` é descrita com "efeito igual ao de hoje"
  (`005:531-535` zera só as duas aprovações e grava o motivo) e `frn_salvar_contrato` só "pina a versão" (§2.1).
  Nenhuma das duas limpa `parcelas_ajustadas`. `frn_parcelas_mo` fará `coalesce(c.parcelas_ajustadas, v.parcelas)`
  sem conferir se o array tem o tamanho da versão.
- **Caminho alcançável:** fornecedor novo (não homologado). O José altera os % e aprova; o contrato fica
  `aguardando` na etapa homologação (§1.2 item 4). O José devolve (permitido nessa etapa, §1.2 item 2). O contrato
  volta a `rascunho` mantendo `condicao_codigo` e `parcelas_ajustadas` do José. O dono edita, troca para uma
  condição de 2 parcelas, ou salva e o rascunho é repinado numa v2 com outro número de parcelas, e reenvia. O
  contrato aprovado terá parcelas calculadas pelos % antigos, de outra condição, e `frn_parcelas_mo` alimenta
  `frn_solicitar_medicao` (`005:1003`, `:1028`), a trava de 100% e a retenção. Falha silenciosa em dinheiro.
- **Correção:** (a) `frn_salvar_contrato` grava sempre `parcelas_ajustadas = null`; (b) `frn_devolver_contrato` também
  zera; (c) rede de segurança no banco: `check (parcelas_ajustadas is null or status in ('aguardando','aprovado','encerrado'))`
  e, em `frn_parcelas_mo`, ignorar `parcelas_ajustadas` se `jsonb_array_length` ≠ o da versão (ou recusar). Teste SQL:
  alterar, devolver, trocar condição, reenviar, aprovar e conferir `frn_parcelas_mo`.

---

## Pontos que dependem de decisão ou atenção do João antes de codar (não são bloqueantes)

1. **D1 e mockup.** O mockup aprovado mostra o CT-0001 em "Aguardando Eduardo" e, depois do Eduardo, indo para o José
   (dica do mockup: "aprove o CT-0001 para ver ele chegar ao José"). A recomendação B da spec faz o CT-0001 sair
   aprovado direto na aprovação do Eduardo, sem passar pelo José. A spec já sinaliza o conflito; só falta o João
   fechar D1 antes da frente A escrever a `010`. A restrição `frn_ct_ordem ... not valid` está correta para a opção B.
   Não achei problema de UPDATE no CT-0001 enquanto ela estiver `not valid`: todos os caminhos de escrita
   (Eduardo aprova, devolve, cancela) satisfazem a restrição.
2. **D3 contraria o mockup** (o mockup mostra "Como paga" editável na edição). A spec justifica e sinaliza; só garantir
   que o cliente seja avisado da mudança de comportamento junto com a entrega.

## Melhorias (curtas)

1. **Ordem dentro da 009.** Adicionar coluna, **preencher** (`versão 1` nas 12 condições e `condicao_versao = 1`) e só
   então criar as FKs e os checks. As FKs compostas e o `check ((condicao_codigo is null) = (condicao_versao is null))`
   validam as linhas existentes ao serem criados e a migration falharia no CT-0001. Escrever a ordem explícita
   na spec. Idem `frn_ct_ordem` e `reaplicacao`: usar `drop constraint if exists` antes de `add`.
2. **Grants da nova assinatura.** `frn_dias_pagamento(text,int,int)` é função nova, não "alterada com grants
   preservados" (§2.1). Revogar de `public, anon, authenticated` explicitamente (default privileges do Supabase
   concedem EXECUTE) e incluir `frn_etapa`, `frn__nome` e `frn_registrar_aviso` na verificação `has_function_privilege`.
   `frn__nome` lê `auth.users`.
3. **Sugestão não permitida, não só inativa.** §1.5 item 6 trata a sugestão R-10 numa condição *desativada*. O mesmo
   `raise` de `005:354-358` ocorre se o José desmarcar "permite global" (ex.: `OBRA_MEDICAO_MENSAL`, sugerida para
   global/manutenção): o dono não consegue nem salvar o rascunho. Usar `frn_condicao_permitida(v_sug,…)` e, se
   falso, `v_cond := null`.
4. **"Exige justificativa" para modo ≠ exceção.** O mockup deixa o checkbox em toda condição; `frn_enviar_contrato`
   (`005:431-432`) exige `excecao_condicao`/`excecao_justificativa` quando a flag é true, e o formulário só mostra esses
   campos para a constante `EXCECAO`. Condição `parcelas` com a flag ligada vira contrato impossível de enviar.
   Definir: mostrar os campos pela flag, ou esconder o checkbox fora do modo exceção.
5. **Rascunhos com condição desativada.** O modal de desativar do mockup diz que contratos não aprovados "seguem com
   ela". Na spec, rascunho/devolvido com a condição desativada não salva nem envia (`005:354-358`, `:431`). Ajustar o
   texto do modal (a pessoa precisa escolher outra) ou deixar o envio aceitar a condição já pinada.
6. **Lista, sub-linhas de aditivo.** `filtrarLinhas` (`_lista.ts:221-228`) filtra sub-linhas também por `status` do
   aditivo (`statusOk(a.status)`), o que a spec não menciona. Com o chip novo "Devolvido", aditivo `devolvido` apareceria
   sob contratos que não são devolvidos. Definir a regra do chip para sub-linhas (o §1.1 item 5 só cita a busca).
7. **Layout e Frente G.** O item "Configurações" depende de `veConfiguracoes`, que o `app/(modulo)/layout.tsx`
   (Frente E) tem de calcular e passar ao `AppShell` (Frente G). Hoje `contarPendencias` devolve `undefined` para quem
   não é aprovador (admin incluído, `layout.tsx:26`). Atribuir a edição do layout a uma só frente.
8. **Texto do evento de alteração.** O mockup acrescenta ". Justificativa: …" quando a condição nova é exceção; o
   §1.3 item 5 omite. Incluir no evento (`dados`) e na linha do tempo.
9. **E-mail: escapar valores dinâmicos no HTML** (razão social, motivo da devolução, justificativa). São texto
   digitado por pessoas, enviado como HTML a colegas.
10. **Limpar `excecao_*` ao sair de exceção** em `frn_alterar_e_aprovar_condicoes` (ou deixar explícito que ficam,
    pois `005:~810` usa `coalesce` e o documento pode exibir a justificativa antiga). O "antes" fica no evento.
11. **Condição nova:** a spec não diz como preencher `tipo` (not null em `frn_condicoes`, `002:31`) nem `observacao`.
    Definir (ex.: `tipo` = nome, `observacao` null).
12. **Higiene de processo:** ao aplicar 009–012, atualizar a tabela "Estado das migrations" do `.claude/rules/sql.md`
    do hub no mesmo commit (regra do arquivo); a spec só cita `docs/DIVIDAS.md`.

## Afirmações da spec que conferi e estão corretas

- `005:484-512` (aprovar em qualquer ordem), `005:514-540` (devolver zera as duas), `005:463-482` (`__liberar_contrato`),
  `005:354-358`, `005:398`, `005:886`, `005:962`, `005:1199-1202`, `005:707-867` (aditivos), `005:669-686`,
  `005:194-254` (`frn_parcelas_mo`), `005:143-153` (`frn_dias_pagamento`): batem com o código.
- `tests/sql/contratos.test.ts:335` ("qualquer ordem") e `:404` (CA-3.3); `paridade.test.ts:98`.
- `lib/auth/papeis.ts:27` chama `frn_e_admin` com o cliente da pessoa, e `001:178-179` revoga de `authenticated`;
  logo `papeis.admin` é sempre `false`. `frn_sou_admin()` é executável por `authenticated` (`001:173-174`). Bug real.
- `frn_tem_algum_papel` alimenta `frn_ve_tudo` (`001:107-130`) e `frn__pode_operar` (`005:75-84`); excluir
  `configurador` ali é necessário e suficiente.
- `001:53-54` (`frn_papeis_papel_valido`), `004:170-179` (check de tipos de evento), `004:188-204` (trigger de
  imutabilidade), `002:29-57` (colunas, checks e policy de `frn_condicoes`).
- Não existe e-mail no Fornecedores (sem `nodemailer`, sem `SMTP_*` no `.env.example`); `NEXT_PUBLIC_APP_URL` já
  inclui `/fornecedores` (`ci.yml:24`); `basePath: "/fornecedores"` (`next.config.ts:65`); D10 da spec original.
- Lista hoje: filtros só `st`/`cl`, sem busca; "Devolvido" não é status, é `rascunho` + `devolvido_motivo`.
- `frn_enviar_contrato` (008) já sem a exigência da proposta; `008` aplicada em 12/10 (tabela do `sql.md`).
- Cobertura do mockup: busca (regras de `filtrar()` espelhadas), chips, estados vazio e sem resultado, ordem
  Eduardo→José, editor do José (% e exceção), prévia Antes/Depois, página Aprovações por papel, cartão, ficha com
  etapa e linha do tempo "agora", 5 e-mails, Configurações (condições e modelo), 13 campos do modelo, as 7
  suposições. Nada inventado fora do mockup além da etapa "homologação" e do papel `configurador`, ambos decorrem
  de regras reais do banco e da suposição 1.
- As regras do `AGENTS.md` (RLS, escrita só por função `service_role`, sem `NULL` em guarda, nenhum dado apagado,
  migration com seção 0 e verificação pós-commit) estão respeitadas.
