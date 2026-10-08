# Gestão de Fornecedores — SPEC funcional (v1, 08/10/2026)

Fontes: `docs/cliente/2026-10-07-gestao-de-fornecedores.md`, `docs/cliente/2026-10-08-feedback-fornecedores.md`,
`docs/cliente/2026-10-08-condicoes-pagamento-zeev.md`, mockup aprovado
(`docs/cliente/2026-10-07-gestao-de-fornecedores/mockup-fornecedores.html`, **fonte de verdade de telas e regras**),
organograma, `docs/fornecedores/2026-10-08-levantamento-compras-financeiro.md` (citado como **LEV**).
Schema: `docs/fornecedores/schema-rascunho.sql`.

**Estado do schema (08/10/2026):** o rascunho foi executado em PGlite local (stubs de `auth.jwt`, `storage.buckets`,
`hub_user_roles`, `obras_obra`), **nunca em banco real**. Verificação 17/17 `OK`; cenários de comportamento conferidos: envio sem
proposta/certidões, José aprovando contratação, ator NULL, liberação só após homologação, parcelas 30/30/30/10, estouro de 100%, retenção,
aceite exigido, outro usuário medindo, aprovação dupla, 2º aditivo de condição pendente, aditivo de condição aplicado (pagas mantêm a condição),
aditivo de valor, RLS por perfil (dono 1 contrato, outro 0, Eduardo/admin todos, sem sessão 0), escrita direta e RPC como `authenticated`
negadas, evento imutável. **Não testado:** concorrência real (CA-5.2 — precisa de duas conexões; PGlite tem uma só).

Convenções deste documento: **R-xx** = regra de negócio (referenciada por testes); **CA-x.y** = critério de aceite da tela x.
Dinheiro sempre `numeric(14,2)` no banco e **centavos inteiros** no TypeScript. Datas no fuso `America/Sao_Paulo`.

---

## 0. Decisões fechadas (não reabrir)

| # | Decisão |
|---|---|
| D1 | App separada, repo `manfac-facilities/fornecedores`, Next com `basePath=/fornecedores`, mesmo login do hub, mesmo banco (prod `iyytcavcgukfjnjjrerx`), tabelas `frn_*`. Molde: app Compras (LEV A). |
| D2 | Qualquer pessoa logada abre contrato e medição e vê **os seus**. Eduardo e José (e admin do hub) veem **todos**. Papéis em tabela própria `frn_papeis`, não em `hub_system_access`. |
| D3 | Eduardo (`aprovador_contratacao`) aprova contratação, aditivo de valor e cada medição. José (`aprovador_financeiro`) aprova condições de pagamento, aditivo de condição e homologação de fornecedor novo. |
| D4 | Tipo: `especifico` (obra obrigatória) ou `global` (sem obra; só Spot ou Manutenção). Classificação: Spot, Manutenção, Obra, Material, Emergencial (emergencial exige justificativa). Centro de custo obrigatório. Mão de obra e material separados. |
| D5 | Condições: as 12 da planilha + `SPOT_A_VISTA` (100%, D+0) + `SPOT_D30` (100%, D+30). Sugestão automática (R-10). `EXCECAO_APROVACAO` exige condição proposta + justificativa. |
| D6 | Aditivo de valor e aditivo de condição, numerados `CT-xxxx-N`. Aditivo de condição vale só para medições ainda não aprovadas. Histórico antes→depois. |
| D7 | Medição: corte dia 25; trava em 100% do saldo (por item); NF + evidência obrigatórias; aceite operacional na parcela final e em contrato global; retenção 10% só após aceite final; tabela de preço fixa; Spot mensal consolidado. |
| D8 | Medição aprovada cria solicitação de pagamento no Financeiro; data real de pagamento vem do Omie via Financeiro. **Mecânica: DECISÃO-PENDENTE (§9).** |
| D9 | Fornecedor vem do cadastro do Omie. Documento de contrato provisório gerado pelo sistema (HTML imprimível → PDF pelo navegador). |
| D10 | Fora de escopo: alçada por valor/cargo; ligação Financeiro → Gestão de Obras; e-mail/notificação (só contadores no menu). |
| D11 | Entrega única, sem fases (fala do João, 08/10). |

---

## 1. Autenticação e papéis (base: LEV A2/A4 — copiar o Compras)

### 1.1 Entrada
- Sem tela de login. `proxy.ts` (Next 16) sem `config.matcher`, filtrando dentro; sem sessão → redireciona para
  `https://hub.manfac.com.br/login`. Deixa passar assets e `/api/health` (e rotas de integração com segredo, se §9 exigir).
- Gap do Next 16: o endereço exato `/fornecedores` pula o proxy → o `layout.tsx` do grupo confere a sessão de novo (igual Compras).
- Sessão: cookie do Supabase do hub via `@supabase/ssr` `createServerClient` + `getClaims()`; usuário por `supabase.auth.getUser()`.
- Qualquer logado com e-mail entra como **solicitante**. Não usa `hub_system_access`. Card no painel do hub fora de `hasSystemAccess`
  (como Financeiro/Compras) e **fora do `matcher` do `middleware.ts` do hub**.

### 1.2 Papéis
| Papel (`frn_papeis.papel`) | Quem (padrão) | Pode |
|---|---|---|
| (nenhum) = solicitante | qualquer logado | criar/editar os próprios rascunhos, enviar, pedir aditivo, abrir medição, registrar atendimento, registrar aceite final — **só nos contratos que criou** |
| `aprovador_contratacao` | Eduardo | ver tudo; aprovar/devolver contratação e aditivo de valor; aprovar/devolver medição; encerrar contrato; registrar aceite final em qualquer contrato |
| `aprovador_financeiro` | José | ver tudo; aprovar/devolver condições de pagamento, aditivo de valor (parte condições) e aditivo de condição; homologar fornecedor novo |
| admin do hub (`hub_user_roles.nivel='administrador'`, só leitura) | João etc. | ver tudo; conceder/revogar papéis (v1: por SQL; tela opcional F7) |

- Um e-mail pode ter os dois papéis (o cliente pode trocar a distribuição sem deploy: só linhas em `frn_papeis`).
- `frn_papeis`: `ativo`, carimbo de concessão/revogação, sem delete (padrão `cmp_papeis`).
- Falha ao ler papel = nenhum papel (padrão Compras).

### 1.3 Modelo de escrita (território de dinheiro e acesso)
- Todas as `frn_*`: RLS ligada, `revoke all from anon, authenticated`, devolve **só `select`** com policy.
- **Toda escrita** passa por funções `frn_*` `security definer`, `grant execute` **só para `service_role`**. A Server Action:
  `requireSessao()` → valida entrada (Zod) → chama a função com a chave de serviço passando `p_ator` = e-mail da sessão.
- A função **revalida** papel/dono/estado/saldo a partir de `p_ator` (não confia na UI). Toda guarda usa `is not true` /
  `exists(...)`; nenhum caminho falha aberto com NULL (`p_ator` nulo ou vazio → exceção).
- Leitura nas telas: client do usuário (RLS) — assim um bug de query não vaza contrato alheio.
- Anexos: bucket privado `fornecedores-anexos`, **sem policy de storage**; upload pela Server Action (service role) depois de
  conferir visibilidade; download por URL assinada (60 s) gerada só se o usuário enxerga o contrato.

---

## 2. Cadastros de apoio

| Dado | Fonte | Tabela | Observação |
|---|---|---|---|
| Fornecedor | catálogo de fornecedores do Omie | `frn_fornecedores` (cópia mínima + estado de homologação) | Ver §9.4 para origem do catálogo. Busca por razão social ou CNPJ. Fornecedor fora do Omie: "cadastre no Omie primeiro" (mockup). |
| Centro de custo | departamentos do Omie (o mesmo código que o Financeiro usa no rateio — LEV B2) | lido do catálogo (§9.4); gravado no contrato como `cc_codigo` + `cc_nome` (snapshot) | |
| Categoria, tipo de documento | catálogo Omie do Financeiro | gravados na medição (snapshot código+nome) | Exigidos pela solicitação de pagamento (LEV B2). |
| Obra | `obras_obra` (Gestão de Obras) — **dúvida C1** | contrato guarda `obra_id` (sem FK) + `obra_rotulo` (snapshot) | Leitura por função `frn_listar_obras()` (definer, só leitura); nunca escreve em `obras_*`. |
| Condições de pagamento | seed (§4) | `frn_condicoes` | Só leitura no app. |

---

## 3. Máquinas de estado

### 3.1 Contrato (`frn_contratos.status`)
```
rascunho ──enviar──► aguardando ──(contratação OK + condições OK + fornecedor homologado)──► aprovado ──► encerrado
   ▲  │                  │
   │  └─cancelar─► cancelado
   └────devolver (Eduardo ou José, motivo obrigatório)───┘
```
| Transição | Quem | Pré-condições (todas checadas no banco) | Efeito |
|---|---|---|---|
| criar/salvar | qualquer logado | status `rascunho`, `criado_por = ator` | grava campos, recalcula `condicao_sugerida`; se `condicao_codigo` vazio usa a sugerida |
| enviar | dono | R-01..R-08 completas; anexo `proposta`; anexo `certidoes` se fornecedor não homologado | `aguardando`; zera aprovações e `devolvido_*`; evento |
| aprovar contratação | `aprovador_contratacao` | `aguardando`, parte ainda pendente | carimba `contratacao_aprovada_*`; tenta liberar |
| aprovar condições | `aprovador_financeiro` | idem | carimba `condicoes_aprovadas_*`; tenta liberar |
| homologar fornecedor | `aprovador_financeiro` | 3 checagens marcadas (CNPJ ativo, banco confere, certidões válidas) | `frn_fornecedores.homologado=true`; tenta liberar **todos** os contratos `aguardando` desse fornecedor |
| liberar (automático) | — | as duas aprovações + fornecedor homologado | `aprovado`; evento "Contrato aprovado — liberado para medição" |
| devolver | o papel da parte | `aguardando`, motivo não vazio | `rascunho`; **descarta as duas aprovações**; grava motivo; evento |
| cancelar | dono | `rascunho` | `cancelado` (nada é apagado) |
| encerrar (manual) | `aprovador_contratacao` | `aprovado`; nenhuma medição `solicitada`/`aprovada`; nenhum aditivo `aguardando`; motivo | `encerrado` |
| encerrar (automático) | — | `aprovado` e pago total = valor total (MO+MAT) | `encerrado`; evento "100% medido e pago" |

Contrato `aprovado` **não se edita**: muda só por aditivo.

### 3.2 Aditivo (`frn_aditivos.status`)
```
aguardando ──(todas as partes exigidas aprovadas)──► aprovado
     └──devolver (motivo)──► devolvido (final; para refazer, pede-se novo aditivo, que consome novo número)
```
| Tipo | Partes exigidas | Ao aprovar |
|---|---|---|
| `valor` | contratação (Eduardo) **e** condições (José) — José confere as parcelas recalculadas sobre o novo total (mockup seção 3) | total do item soma o valor; parcelas recalculadas (R-20) |
| `condicao` | só condições (José); parte contratação = "não se aplica" | R-30 |

- Criado já em `aguardando` (mockup: "Gerar CT-xxxx-N e enviar"). Só sobre contrato `aprovado`.
- No máximo **um** aditivo de condição `aguardando` por contrato (índice único parcial). Aditivo de valor: vários permitidos.
- Quem pede: dono do contrato ou qualquer papel.
- Divergência consciente do mockup: o mockup devolvia o aditivo para "Rascunho", mas não tinha tela para editá-lo. Aqui vira `devolvido` (final).

### 3.3 Medição (`frn_medicoes.status`)
```
solicitada ──aprovar (Eduardo)──► aprovada ──solicitação criada no Financeiro──► pagamento_solicitado ──Omie pago──► paga
     └──devolver (Eduardo, motivo)──► devolvida (final; o saldo volta; refaz-se com nova medição)
```
- `aprovada` é transitório: existe para não perder a aprovação se a criação no Financeiro falhar (retentativa — §9).
- Medição devolvida de Spot consolidado: os atendimentos voltam a ficar em aberto (`medicao_id = null`).

---

## 4. Condições de pagamento (seed — 14 linhas)

`modo`: `parcelas` (lista fixa), `mensal` (uma parcela por mês da vigência), `por_servico` (cada medição é um serviço/atendimento),
`consolidado` (atendimentos do mês → uma medição), `tabela` (serviço da tabela × quantidade), `excecao` (1 parcela 100% final, condição em texto).
`dias` = D+N que o Financeiro programa; vazio = calendário financeiro (primeira janela, R-40 §9.2).

| Código | Nome | Modo | Parcelas (gatilho · % · final · retenção) | dias | global? | só global? |
|---|---|---|---|---|---|---|
| OBRA_PEQUENA_UNICA_D7 | Obra pequena · pagamento único | parcelas | Após execução aprovada + documentação mínima · 100 · F | 7 | não | não |
| OBRA_MEDIA_50_50 | Obra média · 50% / 50% | parcelas | Contrato aprovado + início/mobilização autorizada · 50 ; Conclusão aprovada + NF + evidências · 50 · F | — | não | não |
| OBRA_MEDIA_UNICA_D15 | Obra média baixo risco · único | parcelas | Após conclusão aprovada + NF · 100 · F | 15 | não | não |
| OBRA_MAIOR_30_30_40 | Obra maior · 30% / 30% / 40% | parcelas | Contrato aprovado + início/mobilização · 30 ; Medição parcial aprovada · 30 ; Conclusão + aceite final + NF · 40 · F | — | não | não |
| OBRA_RETENCAO_10 | Obra crítica · 30/30/30 + 10% retido | parcelas | Início/mobilização · 30 ; Medição parcial · 30 ; Conclusão aprovada · 30 · F ; Retenção · liberada após aceite final · 10 · F · R | — | não | não |
| OBRA_MEDICAO_MENSAL | Obra contínua · medição mensal | mensal | (gerada pela vigência, R-21) | — | sim | não |
| SPOT_UNICO_D7 | Spot simples · único | por_servico | Atendimento concluído + evidência + NF | 7 | sim | não |
| SPOT_UNICO_D15 | Spot padrão · único | por_servico | Atendimento concluído + NF aprovada | 15 | sim | não |
| SPOT_MENSAL_CONSOLIDADO | Spot recorrente · mensal consolidado | consolidado | Fechamento mensal aprovado + NF consolidada | — | sim | **sim** |
| SPOT_TABELA_FIXA | Spot com tabela de preço fixa | tabela | Serviço da tabela + evidência + NF | — | sim | **sim** |
| MATERIAL_MEDIANTE_NF | Material · mediante NF | parcelas | Entrega comprovada + NF aprovada · 100 | — | não | não |
| EXCECAO_APROVACAO | Exceção · fora do padrão | excecao | Conforme aprovação · 100 · F | — | sim | não |
| **SPOT_A_VISTA** (nova) | Spot · à vista na conclusão | por_servico | Atendimento concluído + evidência + NF | 0 | sim | não |
| **SPOT_D30** (nova) | Spot · 30 dias | por_servico | Atendimento concluído + evidência + NF | 30 | sim | não |

- **R-09 (condição permitida):** contrato global → só condições com `permite_global`; específico → nenhuma `so_global`.
  Classe Material → só `MATERIAL_MEDIANTE_NF`. Medição de material (item `mat`) usa sempre `MATERIAL_MEDIANTE_NF`.
- Em contrato **específico**, condição `por_servico` (Spot avulso de obra) se comporta como 1 parcela 100% final.

---

## 5. Regras de cálculo

### 5.1 Validações do contrato (envio)
- **R-01** fornecedor do catálogo Omie. **R-02** global ⇒ `obra_id` nulo, classificação ∈ {spot, manutencao}, sem material.
  Específico ⇒ obra obrigatória. **R-03** centro de custo obrigatório. **R-04** escopo não vazio.
- **R-05** valor: Material ⇒ `valor_mat > 0` e `valor_mo = 0`; demais ⇒ `valor_mo > 0`; `valor_mat ≥ 0` (opcional, só específico).
  Global: `valor_mo` = valor teto.
- **R-06** início e fim obrigatórios, fim ≥ início.
- **R-07** emergencial ⇒ justificativa da emergência. `EXCECAO_APROVACAO` ⇒ condição proposta (texto) + justificativa.
- **R-08** `SPOT_TABELA_FIXA` ⇒ ≥ 1 linha de tabela com serviço, unidade e preço > 0.

### 5.2 Sugestão de condição (R-10) — mesma ordem do mockup, `v` = mão de obra
1. emergencial → `EXCECAO_APROVACAO`
2. global → manutenção ? `OBRA_MEDICAO_MENSAL` : `SPOT_TABELA_FIXA`
3. material → `MATERIAL_MEDIANTE_NF`
4. spot → `v > 1500` ? `SPOT_UNICO_D15` : `SPOT_UNICO_D7`
5. manutenção com vigência > 45 dias → `OBRA_MEDICAO_MENSAL`
6. faixa: `v ≤ 1.500` → `OBRA_PEQUENA_UNICA_D7`; `≤ 5.000` → `OBRA_MEDIA_50_50`; `≤ 8.000` → `OBRA_MAIOR_30_30_40`; `> 8.000` → `OBRA_RETENCAO_10`

Limites inclusivos ("até R$ 1.500" inclui 1.500,00). A sugerida é gravada em `condicao_sugerida`; se o solicitante trocar,
a tela de aprovação mostra "trocada da sugerida X" e a linha do tempo registra.

### 5.3 Totais e saldo
- **R-20** `total(item)` = valor base do item + soma dos aditivos de valor **aprovados** daquele item.
- `medido(item)` = soma de medições do item com status ∈ {solicitada, aprovada, pagamento_solicitado, paga}.
- `pago(item)` = soma das `paga`.
- `em_aberto` = soma dos atendimentos sem medição (só contrato consolidado, item mo).
- **R-22 saldo(item)** = `total − medido − em_aberto`. Medição ou atendimento com `valor > saldo` é **recusado** (trava 100%).
- Percentual digitado → `valor = round(total × pct / 100, 2)`; se passar do saldo por ≤ R$ 0,01 (arredondamento), ajusta para o saldo.
- Saldo calculado **dentro da função com `select ... for update` no contrato** (duas medições simultâneas não estouram 100%).

### 5.4 Parcelas (só contrato específico, item mão de obra) — derivadas, não gravadas
- **R-21** Lista: modo `parcelas` → da condição; `mensal` → um item por mês de `inicio` a `fim` (1 a 36 meses),
  `pct_base = floor(10000/n)/100`, última = `100 − pct_base×(n−1)`, prevista = último dia do mês, só a última é `final`;
  `excecao`/`por_servico` → 1 parcela 100% final com o texto da condição.
- Valor de cada parcela = `round(T × pct/100, 2)`; **a última recebe o resto** (soma = T exato). `inicio_acum`/`fim_acum` acumulados.
- Status (cumulativo, igual mockup): `Paga` se pago ≥ fim_acum; `Medida` se medido ≥ fim_acum; `Retida` se retenção sem aceite final;
  `Em atraso` se tem data prevista < hoje e contrato aprovado; senão `Prevista`.
- Aditivo de valor ou de condição **recalcula** a lista sobre o novo T/condição; o status continua cumulativo.
- A mesma função existe em TS (`lib/regras/parcelas.ts`) e em SQL (`frn_parcelas_mo`). Teste de paridade obrigatório (mesmos casos nos dois).

### 5.5 Aceite operacional e retenção
- **R-23 aceite exigido** na medição de item `mo` quando: contrato global (toda medição); ou específico e a medição **cruza** o
  `fim_acum` de alguma parcela `final` (`medido_antes < fim_acum ≤ medido_depois`). Material: nunca.
- **R-24 retenção:** se a condição tem parcela `retencao` e não há aceite final, `medido_depois ≤ inicio_acum` da retida.
- **R-25 aceite final:** botão na ficha quando a condição tem retenção, contrato `aprovado` e `medido(mo) ≥ inicio_acum` da retida (90%).
  Quem: dono ou `aprovador_contratacao`. Grava `aceite_final_*`; libera a retida.

### 5.6 Competência e corte dia 25 (regra do Fornecedores, não do Financeiro)
- **R-26** `competencia` da medição = 1º dia do mês de `solicitado_em` (fuso SP) se dia ≤ 25; senão 1º dia do mês seguinte.
- Não bloqueia envio. Tela 5 mostra "Faltam N dias para o corte de <mês>" (ou "após o corte: entra em <mês seguinte>").
- Spot consolidado: o fechamento do mês é a medição; atendimentos com data > 25 entram na competência seguinte (aviso, não trava).

### 5.7 Atrasos (alertas nas telas 1, 4 e 7)
- **R-27** parcela com data prevista vencida sem estar medida (contrato aprovado).
- **R-28** medição `solicitada` há mais de 5 dias corridos ("parada há N dias").
- Contador da lista = nº de contratos com pelo menos um R-27/R-28.

### 5.8 Aditivo de condição aplicado (R-30)
Na aprovação, numa única transação: `contrato.condicao_codigo := para` (e textos de exceção, se houver); medições do item `mo`
com status `solicitada` passam a `para`; medições `aprovada`/`pagamento_solicitado`/`paga` **mantêm** a condição antiga;
evento com `{antes, depois, passaram:[MD..], mantiveram:[MD..]}`. Bloqueado se `para` não é permitida para o tipo (R-09).

### 5.9 Numeração
- **Contrato** `CT-NNNN`: sequência `frn_ct_seq` começando em 1, `NNNN` com 4 dígitos mínimo (acima de 9999 cresce, sem truncar —
  cuidado: `lpad` trunca). Número nasce no **primeiro salvamento** (rascunho); cancelado não devolve número.
- **Aditivo** `CT-NNNN-K`: `K` começa em 2 e é contador do contrato (`prox_aditivo`, travado com `for update`), compartilhado entre valor e condição.
- **Medição** `MD-NNNN`: sequência global `frn_md_seq`, no envio.

### 5.10 Linha do tempo (`frn_eventos`, imutável por trigger)
| tipo | texto (modelo) | dados |
|---|---|---|
| contrato_criado | Contrato criado por X — condição C (sugerida \| trocada da sugerida S) | cond, sugerida |
| contrato_enviado | Enviado para aprovação de Eduardo e José | |
| contratacao_aprovada / condicoes_aprovadas | Contratação aprovada por X / Condições de pagamento aprovadas por X | |
| fornecedor_homologado | Fornecedor homologado por X — CNPJ, dados bancários e certidões conferidos | |
| homologacao_aberta | Fornecedor novo — homologação cadastral aberta | |
| contrato_aprovado | Contrato aprovado — liberado para medição | |
| contrato_devolvido | Devolvido por X: "motivo" — voltou para Rascunho | motivo, parte |
| contrato_cancelado / contrato_encerrado | … | motivo |
| documento_gerado | Documento do contrato gerado | (1ª impressão após aprovação) |
| aditivo_pedido | Aditivo CT-…-K pedido por X: +R$ v — motivo \| C1 → C2 | valor ou de/para |
| aditivo_aprovado_parte | Aditivo CT-…-K: contratação/condições aprovadas por X | |
| aditivo_aprovado | Aditivo CT-…-K aprovado — novo total R$ T \| condição C1 → C2, vale para … | antes/depois, listas |
| aditivo_devolvido | Aditivo CT-…-K devolvido por X: "motivo" | |
| atendimento_registrado / atendimento_removido | Atendimento de dd/mm — desc — R$ v | |
| medicao_solicitada | Medição MD-… (material) solicitada — R$ v · desc | valor, pct, competência |
| medicao_aprovada | Medição MD-… aprovada por Eduardo | |
| solicitacao_financeiro_criada | Solicitação FIN-… criada no Financeiro (condição C, vencimento d) | ref, vencimento |
| medicao_devolvida | Medição MD-… devolvida por Eduardo: "motivo" | |
| pagamento_registrado | Pagamento FIN-… registrado — pago em dd/mm (data do Omie) | data, valor |
| aceite_final | Aceite final registrado por X — retenção liberada para medição | |

A ficha junta eventos do contrato, dos aditivos e das medições, ordenados por data/hora, mais as parcelas em atraso (R-27) como itens sintéticos.

---

## 6. Telas

Menu lateral: **Contratação** (telas 1–4) e **Medição** (telas 5–7). Contadores no menu: Eduardo = contratos/aditivos com parte
de contratação pendente + medições `solicitada`; José = condições pendentes + homologações pendentes. Cada tela tem estados
**com dados / vazio / erro** (mensagens do mockup; erro com "Tentar de novo", sem perder o que foi digitado).

### Tela 1 — Lista de contratos (`/fornecedores/contratos`)
- **Quem vê:** solicitante só os que criou; papéis/admin todos (RLS).
- KPIs (contratos `aprovado` visíveis): Contratado, Medido, Pago, Saldo a medir, Nº com medição em atraso.
- Filtros: status (Todos/Rascunho/Aguardando/Aprovado/Encerrado, com contagem) + classificação (todas / só globais / cada uma).
- Colunas: Nº · Fornecedor (CNPJ, selo "Fornecedor novo · homologação pendente", alertas R-27/R-28) · Obra (ou "— sem obra") +
  pills Global/classificação + CC · Valor total ("com aditivo", "material R$") · % medido (barra) · Saldo · Status ("devolvido — ajustar").
- Aditivos aparecem como sub-linhas (↳ CT-…-K, valor ou "C1 → C2", status). Clique abre a ficha.
- **CA-1.1** solicitante A não vê contrato de B nem por URL nem por query direta (teste com dois usuários).
- **CA-1.2** KPIs batem com a soma das linhas aprovadas do filtro "Todos".
- **CA-1.3** contrato com parcela mensal vencida aparece com alerta e entra no contador.
- **CA-1.4** "Só contratos globais" mostra só tipo global; sub-linha de aditivo segue o filtro do contrato pai.

### Tela 2 — Novo contrato / editar rascunho (`/fornecedores/contratos/novo`, `/contratos/[numero]/editar`)
- **Quem:** qualquer logado (editar: só o dono, só `rascunho`).
- Campos: fornecedor (busca no catálogo Omie por razão ou CNPJ; aviso "fornecedor novo" + certidões obrigatórias) · tipo
  (Específico/Global; global limita classificação a Spot/Manutenção e some o campo obra) · classificação (chips; emergencial abre
  justificativa) · obra (específico) · centro de custo (catálogo) · escopo · valores (Material: só material; Global: "valor global (teto)";
  demais: mão de obra + material opcional) · início/fim · documentos (CNPJ e banco "✓ do Omie"; proposta obrigatória; certidões) ·
  condição (bloco "Sugerida: X · Faixa Y · porquê"; select só com condições permitidas; "Voltar à sugerida"; cartão da condição;
  exceção → condição proposta + justificativa; tabela fixa global → editor de tabela) · prévia de parcelas (soma 100%, material à parte,
  aviso de aceite e retenção).
- Ações: **Salvar rascunho** (exige só fornecedor) · **Gerar documento** (prévia HTML) · **Enviar para aprovação** (R-01..R-08;
  lista "Faltam informações para enviar: …").
- Número `CT-NNNN` aparece depois do primeiro salvamento.
- **CA-2.1** global não permite obra nem classificação Obra/Material/Emergencial (UI e banco).
- **CA-2.2** sugestão: 1.500,00→PEQUENA; 1.500,01→MEDIA_50_50; 5.000→MEDIA_50_50; 8.000→MAIOR; 8.000,01→RETENCAO; emergencial→EXCECAO;
  global spot→TABELA_FIXA; global manutenção→MENSAL; manutenção específica 46 dias→MENSAL.
- **CA-2.3** escolher `SPOT_TABELA_FIXA` em contrato específico é impossível (some do select; banco recusa).
- **CA-2.4** enviar sem proposta, ou fornecedor novo sem certidões, falha com a mensagem do campo.
- **CA-2.5** EXCECAO sem justificativa não envia.
- **CA-2.6** prévia mensal de 01/07 a 31/12 = 6 parcelas, 16,66% ×5 + 16,70%, valores somando exatamente a mão de obra.

### Tela 3 — Aprovações (`/fornecedores/aprovacoes`)
- **Quem:** papéis veem e agem; solicitante vê os próprios em aprovação, sem botões.
- Filtro (papéis): "Esperando por mim" (padrão, com contagem) / "Todos aguardando".
- Cartão por contrato/aditivo: cabeçalho (nº, fornecedor, obra/global, classificação, quem enviou, selos) · bloco homologação (se
  fornecedor novo: 3 checkboxes, só José marca) · bloco **Contratação · Eduardo** (escopo, obra/CC, valor = MO+MAT, prazo, emergência,
  documentos; para aditivo de valor: +valor → novo total e motivo; para aditivo de condição: "Não se aplica") · bloco **Condições · José**
  (cartão da condição com selo "sugerida pela faixa"/"trocada da sugerida X", parcelas com valores, material à parte, exceção, tabela;
  aditivo de valor: parcelas sobre o novo total; aditivo de condição: antes→depois, motivo, "passa a valer para" MD… e "continuam em" MD…) ·
  rodapé "Falta: Eduardo, José e a homologação".
- Ações: Aprovar (diálogo com a consequência) · Devolver com motivo (obrigatório).
- **CA-3.1** José não consegue aprovar contratação nem Eduardo condições (botão ausente **e** função recusa).
- **CA-3.2** contrato só vira `aprovado` com as duas partes + homologação, em qualquer ordem; homologar por último libera.
- **CA-3.3** devolver descarta a aprovação já dada; reenvio pede as duas de novo.
- **CA-3.4** aprovar aditivo de condição troca a condição, move só as medições `solicitada` e o evento lista as duas listas.
- **CA-3.5** segundo aditivo de condição no mesmo contrato com um já aguardando é recusado.

### Tela 4 — Ficha do contrato (`/fornecedores/contratos/[numero]`)
- **Quem:** dono e papéis (RLS).
- Cabeçalho: nº, fornecedor, obra/global, vigência, criado por, status, pills. Ações: Ver documento · + Aditivo de condição (desabilitado
  se já há um aguardando) · + Aditivo de valor · Registrar aceite final (R-25) · Encerrar (só Eduardo).
- Banners: devolvido (motivo), medição em atraso, aditivo de condição aguardando (C1 → C2), emergência/exceção.
- Números: valor contratado (MO + material), aditivos de valor (aprovados + pendentes listados), total.
- Meta: condição (prazo, "alterada pelo aditivo X"), CC/obra, documentos/homologação, aceite.
- Barra pago / medido aguardando / saldo, com valores e %.
- Coluna esquerda: específico → parcelas da MO (nome, %, prevista, "exige aceite", valor, status R-21) + material; global → tabela de
  preços, atendimentos do mês (consolidado) com "Registrar atendimento ou fechar o mês", serviços medidos; material → entregas medidas.
- Coluna direita: linha do tempo (§5.10).
- Leitura rápida (aprovado): prazo decorrido % · medido % · "medição abaixo do ritmo do prazo" se medido% + 10 < prazo%.
- Diálogos: aditivo de valor (valor > 0, motivo; total atual → novo total; gera CT-…-K) · aditivo de condição (atual, nova — só permitidas;
  EXCECAO pede proposta + justificativa; motivo; quem passa/quem fica) · aceite final · encerrar (motivo).
- Documento: HTML imprimível (modelo `docHtml` do mockup, com marca "Modelo provisório"); "Baixar PDF" = `window.print()` com CSS de impressão.
- **CA-4.1** ficha de contrato alheio por URL devolve "não encontrado" para solicitante.
- **CA-4.2** com aditivo de valor aprovado de R$ 14.400 sobre MO 96.000, total = 110.400 e parcelas recalculadas somam 110.400.
- **CA-4.3** aceite final indisponível com MO medida < 90% em OBRA_RETENCAO_10; disponível em 90%; depois dele a retida pode ser medida.
- **CA-4.4** linha do tempo mostra criação, aprovações, aditivos, medições, FIN e pagamento na ordem.
- **CA-4.5** encerrar com medição `solicitada` é recusado.

### Tela 5 — Nova medição (`/fornecedores/medicoes/nova?contrato=CT-…`)
- **Quem:** dono do contrato ou papéis; só contratos `aprovado`.
- Topo: contrato (só aprovados visíveis) · item (Mão de obra/Material, se o contrato tem os dois) · quadro Valor total / Já medido / Saldo.
- Corpo por modo:
  - **específico MO**: condição + próxima parcela ("Usar este valor") · valor em % ou R$ (EXCECAO: só R$).
  - **material**: material entregue (texto) + valor R$.
  - **global por_servico/mensal**: serviço executado (texto) + data do serviço + valor R$.
  - **tabela**: serviço da tabela + quantidade + data; valor = preço × qtd (calculado no banco, ignora valor do cliente).
  - **consolidado**: lista de atendimentos do mês em aberto (remover) + registrar atendimento (data, descrição, valor) + botão
    "Fechar <mês> e enviar medição" (valor = soma dos atendimentos em aberto).
- Documentos: NF (obrigatória) · evidência/comprovante de entrega (obrigatória) · nº da NF.
- **Dados de pagamento (exigidos pela solicitação do Financeiro — LEV B2):** forma de pagamento (boleto · guia · PIX QR code · PIX chave);
  código de pagamento obrigatório para boleto/guia/PIX QR (linha digitável / copia-e-cola); PIX chave usa a chave do cadastro Omie
  (fornecedor de catálogo — não pede chave; se o Financeiro passar a exigir, campo `pix_chave`); categoria (catálogo); tipo de documento
  (catálogo); centro de custo (padrão = do contrato, catálogo).
- Aceite operacional (checkbox) quando R-23.
- Lateral: acumulado antes → depois (barra; vermelho se estoura), aviso do corte dia 25 (R-26), condição desta medição + prazo, aviso de
  aditivo de condição pendente.
- Botão desabilitado com "Para enviar: …" até tudo ok.
- **CA-5.1** medir 101% (ou R$ acima do saldo) é recusado na UI **e** pela função (teste chamando a função direto).
- **CA-5.2** duas medições simultâneas que juntas passam de 100%: uma passa, a outra é recusada.
- **CA-5.3** OBRA_RETENCAO_10 sem aceite final: medir acima de 90% é recusado com a mensagem de retenção.
- **CA-5.4** medição que completa a parcela final sem aceite marcado é recusada; global sempre exige aceite.
- **CA-5.5** saldos de material e mão de obra são independentes.
- **CA-5.6** tabela: 12 × R$ 700 = R$ 8.400 gravado mesmo se o cliente mandar outro valor.
- **CA-5.7** consolidado: registrar atendimento acima do saldo é recusado; fechar gera 1 medição com a soma e vincula os atendimentos.
- **CA-5.8** enviada dia 25 → competência do mês; dia 26 → mês seguinte (fuso SP, inclusive 23h30 do dia 25).
- **CA-5.9** sem NF, sem evidência, ou boleto sem código: não envia.

### Tela 6 — Fila de aprovação de medições (`/fornecedores/medicoes/aprovacao`)
- **Quem:** Eduardo age; demais papéis consultam; solicitante vê as próprias `solicitada`.
- Linha: MD · CT · fornecedor · descrição · item/condição · quem e quando · alerta R-28 · % pedido e R$ · acumulado antes→depois ·
  documentos (NF, evidência com link assinado, aceite, nº de atendimentos) · Aprovar / Devolver com motivo.
- Aprovar: diálogo "confirma execução até X% acumulado; cria a solicitação no Financeiro de R$ v na condição C". Banner de sucesso
  com a referência FIN.
- Devolver: motivo obrigatório; saldo volta; nada vai ao Financeiro.
- **CA-6.1** só `aprovador_contratacao` aprova/devolve (função recusa os demais).
- **CA-6.2** aprovar duas vezes (duplo clique / duas abas) cria **uma** solicitação no Financeiro (idempotência por medição).
- **CA-6.3** devolver consolidado devolve os atendimentos para "em aberto".
- **CA-6.4** falha do Financeiro deixa a medição `aprovada` com "Tentar criar solicitação de novo"; não perde a aprovação.

### Tela 7 — Acompanhamento (`/fornecedores/medicoes`)
- **Quem:** solicitante as próprias; papéis todas.
- Banner "Parcelas previstas sem medição" (R-27) com "Abrir ficha".
- Filtros com contagem: Todas · Solicitada · Pagamento solicitado · Pago · Devolvida · Em atraso (R-28). Atrasadas primeiro, depois por data desc.
- Linha: MD · CT (link) · pill · fornecedor/descrição · item/condição ("condição anterior ao aditivo" quando difere da atual) · valor e % ·
  trilha Solicitada → Aprovada → Pagamento solicitado (FIN) → Pago (data do Omie); devolvida mostra motivo.
- **CA-7.1** medição paga mostra a data real vinda do Omie (§9.3 P3), não a data de aprovação.
- **CA-7.2** filtro "Em atraso" = só `solicitada` há > 5 dias.

---

## 7. Validações de entrada (Zod no servidor, repetidas no banco quando é dinheiro/estado)
Textos: escopo ≤ 4.000; motivos/justificativas 5–1.000; descrição de medição 3–500. Valores > 0 e ≤ 99.999.999,99. Percentual 0,01–100.
Quantidade > 0 (até 3 decimais). Anexos: PDF/JPEG/PNG até 10 MB (mesmo limite do Financeiro). Datas válidas.

---

## 8. Erros e mensagens (do mockup)
Estouro de 100% · retenção · aceite faltando · documentos faltando · Omie fora ("o formulário continua aberto…") · erro de carga com
"Tentar de novo". Toda recusa do banco vira mensagem legível (código `P0001` com texto em português definido na função).

---

## 9. Integração Financeiro / Omie

### 9.1 Fatos (LEV B)
- O Financeiro **não tem porta** para outro sistema criar solicitação; `fin_criar_solicitacao` só `service_role` e **confia no payload**
  (prazos, emergencial, duplicidade, catálogo ficam em TypeScript no Financeiro). Regra escrita dos dois repos: nunca escrever em `fin_*` de fora.
- A solicitação exige: fornecedor (código Omie), forma de pagamento + código (boleto/guia/PIX QR) ou chave PIX, valor, vencimento,
  categoria, tipo de documento, descrição (5–500), rateio por centro de custo (departamento Omie) fechando 100%.
- Prazos do Financeiro (`prazos.ts`): 17h + 2 dias úteis + janelas seg/qua/sex. **Vencimento antes da primeira janela vira emergencial**
  e vai para o diretor.
- Fluxo do Financeiro termina em `lancada` (título no Omie com `HUBFIN-<nº>`). **Não há etapa "paga" nem data real de pagamento.**
- Devolução no Financeiro volta para o solicitante, que reenvia pela tela do Financeiro.

### 9.2 Regras do Fornecedores, independentes da decisão
- **R-40 vencimento** = `max(data_aprovacao + dias da condição, primeira janela do Financeiro no momento do envio)`; condição sem `dias`
  → primeira janela. Nunca gerar emergencial automático por vencimento curto. (Ex.: SPOT_A_VISTA vira a primeira janela.)
- **R-41 idempotência:** uma medição gera no máximo uma solicitação; a chave é `frn_medicoes.id` (ou `MD-NNNN`) enviada ao Financeiro.
- **R-42 payload** = fornecedor do contrato, valor da medição, vencimento R-40, dados de pagamento da tela 5, descrição
  `"<CT> <MD> — <descrição>"`, rateio 100% no centro de custo da medição, anexos NF + evidência.
- **R-43** a medição guarda `fin_ref` (nº da solicitação), `fin_criada_em`, `pago_em`, `valor_pago`. Pagamento registrado → `paga`;
  dispara encerramento automático (§3.1).
- Corte dia 25 é do Fornecedores (R-26) e não altera prazos do Financeiro.

### 9.3 Decisões (João, 08/10/2026)
- **P1 = (a) DECIDIDO:** rota nova no Financeiro que reaproveita o código de envio. Deploy só do Financeiro.
- **P2 = (a) DECIDIDO:** solicitante no Financeiro = quem abriu a medição.
- **P3 PENDENTE (schema em território de dinheiro):** proposta em `2026-10-08-omie-data-pagamento.md` — job diário no Financeiro com
  `financas/mf ListarMovimentos` (cNatureza=P, janela de 3–7 dias), cruzando `nCodTitulo = codigo_lancamento_omie`, gravando a data numa
  tabela nova do Financeiro; Fornecedores só lê. Antes: uma leitura medida no Omie (autorização do Jose Guilherme).
- **§9.4 ACEITO:** ler `fin_catalogo_*` só leitura, pelo servidor.

Tabela original das opções:
| # | Pergunta | Opções | Recomendação |
|---|---|---|---|
| P1 | Como criar a solicitação | **(a)** rota nova no Financeiro (`POST /financeiro/api/integracoes/medicoes`, segredo de serviço) que reaproveita `interpretarEnvio`/`montarPayload`/`gravarSolicitacao`; Fornecedores chama na aprovação com retentativa · **(b)** Fornecedores grava a medição aprovada em `frn_*` e o Financeiro busca por agendador e cria | **(a)** — uma só implementação das regras de prazo/catálogo; resposta síncrona dá o nº FIN na hora (mockup mostra) |
| P2 | Quem é o solicitante no Financeiro | **(a)** quem abriu a medição · **(b)** Eduardo | **(a)** — quem tem a NF e o código de pagamento é quem recebe a devolução e reenvia |
| P3 | Data real de pagamento | O Financeiro não guarda. Consulta ao Omie (`ConsultarContaPagar` por `HUBFIN-<nº>` ou `ListarContasPagar` incluindo pagos) — **quem consulta e onde grava a definir**; formato do campo não medido | Financeiro (que já fala com o Omie e tem agendador) grava a data na solicitação; Fornecedores só lê (função de leitura) e chama `frn_registrar_pagamento`. Evita 3º consumidor da chave Omie |

Impacto no código do Fornecedores: só o módulo `lib/integracoes/financeiro.ts` e a rota/agendador de retorno (fatia F6). Telas, schema
e funções já preveem `aprovada → pagamento_solicitado → paga` com `fin_ref`/`pago_em` qualquer que seja a escolha.

### 9.4 Catálogo Omie (fornecedor, departamento, categoria, tipo de documento)
Padrão adotado: **ler o catálogo que o Financeiro já sincroniza** (`fin_catalogo_fornecedores`, `fin_catalogo_departamentos`,
`fin_catalogo_categorias`, `fin_catalogo_tipos_documento`) — só leitura, pelo servidor, com service role — e copiar o mínimo do
fornecedor para `frn_fornecedores` no primeiro uso. Motivo: os códigos têm que ser os mesmos que a solicitação do Financeiro aceita, e
não cria um 3º consumidor da chave Omie (bloqueio de 5 min derruba Compras e Financeiro — LEV A5). Alternativa: catálogo próprio
sincronizado do Omie (mais trabalho, mais risco de bloqueio). **Confirmar com o João junto com P1** (mexe na regra "não ler `fin_*`" só por leitura).

---

## 10. Itens de dívida aceitos (vão para `docs/DIVIDAS.md` do repo novo)
- Medição em contrato com vigência vencida é permitida (só aviso).
- Arquivo enviado ao storage e não registrado (abandono do formulário) fica órfão.
- Sem notificação por e-mail (D10).
- Tela de gestão de papéis: v1 por SQL.

---

## 11. Fatiamento para implementação paralela

Repo novo `manfac-facilities/fornecedores` (molde Compras: Next 16.3.5, React 19.2.4, `output: standalone`, Biome, Vitest, PGlite para SQL).
SQL em `supabase/hub-install/00N_frn_*.sql`. Critério de paralelismo: **nenhum arquivo em duas fatias**.

| Fatia | Conteúdo | Arquivos/áreas (exclusivos) | Depende de | Duração alvo |
|---|---|---|---|---|
| **F0 Esqueleto** | scaffold copiado do Compras (proxy, sessão, env, supabase clients, health, Dockerfile, next.config, layout com menu e contadores, componentes base: pill, money input, estado vazio/erro, diálogo), tipos do domínio `lib/tipos.ts` (escritos a partir do schema-rascunho) | `proxy.ts`, `next.config.ts`, `Dockerfile`, `lib/env.ts`, `lib/supabase/*`, `lib/auth/*`, `lib/tipos.ts`, `app/(modulo)/layout.tsx`, `app/api/health/*`, `components/ui/*` | — | 3 h (bloqueia F3–F5 só no layout/tipos) |
| **F1 Banco** | schema-rascunho → migrations `001_frn_acesso`, `002_frn_cadastros` (+seed), `003_frn_contratos`, `004_frn_medicoes`, `005_frn_funcoes`; seção 0, verificação OK/FALHOU; testes PGlite de RLS e de cada função (CA-*.x marcados "função") | `supabase/hub-install/*`, `tests/sql/*` | — (contrato = este spec + schema) | 1 dia |
| **F2 Regras puras** | sugestão, parcelas, saldo, aceite/retenção, competência, vencimento R-40 (cópia de `prazos.ts` do Financeiro, só leitura), formatação BRL; testes de paridade com F1 (mesma tabela de casos em `tests/casos-regras.json`) | `lib/regras/*`, `tests/regras/*`, `tests/casos-regras.json` | — | 4 h |
| **F3 Contratação A** | telas 1 e 2 + documento imprimível; Server Actions `salvar/enviar/cancelar` e upload de proposta/certidões; busca de fornecedor/CC no catálogo | `app/(modulo)/contratos/page.tsx`, `contratos/novo/*`, `contratos/[numero]/editar/*`, `contratos/[numero]/documento/*`, `lib/catalogo/*`, `lib/anexos/*` | F0 (layout/tipos), F2; F1 para testar de verdade | 1 dia |
| **F4 Contratação B** | telas 3 e 4 (aprovações, homologação, ficha, linha do tempo, aditivos, aceite final, encerrar) | `app/(modulo)/aprovacoes/*`, `app/(modulo)/contratos/[numero]/page.tsx` + `_ficha/*`, `lib/eventos/*` | F0, F2 | 1 dia |
| **F5 Medição** | telas 5, 6, 7 (atendimentos, fechamento, fila, acompanhamento) | `app/(modulo)/medicoes/*` | F0, F2; usa `lib/anexos` de F3 (só importa) | 1 dia |
| **F6 Integração** | `lib/integracoes/financeiro.ts` (criar solicitação + retentativa), retorno de pagamento, rota de tarefa agendada; do lado Financeiro, a rota/coluna escolhida em P1/P3 (**repo financeiro, PR separado**) | `lib/integracoes/*`, `app/api/tarefas/*` (+ repo financeiro) | **P1/P2/P3 decididos**; F1 | 4–6 h |
| **F7 Deploy e hub** | projeto EasyPanel próprio, domínio `/fornecedores` (HTTPS no domínio, destino HTTP porta 80), card no painel do hub fora de `hasSystemAccess`, seed de papéis (e-mails de Eduardo/José), tela opcional de papéis | repo hub: painel do dashboard; `docs/deploy-easypanel.md` do repo novo | F0 (para o build) | 2 h |

**Ordem e simultaneidade**
1. Hora 0: F0, F1, F2, F7 (infra) em paralelo — não compartilham arquivo.
2. Quando F0 entregar layout + `lib/tipos.ts`: F3, F4, F5 em paralelo (pastas de rota distintas; `lib/anexos` é de F3, F5 só importa —
   F3 publica a assinatura no primeiro commit).
3. F6 só depois de P1–P3; até lá F5 chama `lib/integracoes/financeiro.ts` por interface (`criarSolicitacao(medicaoId) → {ref} | erro`) com stub.
4. Fechamento: aplicar F1 em produção (tabelas novas e vazias, sem tocar nada existente) **com autorização do João**, revisão independente
   do SQL e das Server Actions (quem executa ≠ quem revisa), deploy F7.

---

## 12. Dúvidas que só o cliente responde
Ver lista no fim da resposta do agente e em `schema-rascunho.sql` (cabeçalho). Até a resposta, vale o padrão indicado entre parênteses.
- **C1** A obra do contrato é a obra da Gestão de Obras (`obras_obra`)? (padrão: sim, lista de obras ativas de lá.)
- **C2** Fornecedores que já estão no Omie hoje contam como homologados? (padrão: sim, todos os do catálogo no go-live; só os
  incluídos depois passam por homologação.)
- **C3** Eduardo pode aprovar contrato/medição que ele mesmo abriu? (padrão: pode; fica registrado.)
- **C4** Medição de contrato **emergencial** deve ir ao Financeiro como emergencial (passa pelo diretor)? (padrão: não; R-40.)
- **C5** E-mails exatos de Eduardo e José no hub.
