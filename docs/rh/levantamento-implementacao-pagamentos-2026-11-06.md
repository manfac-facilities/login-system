# RH: levantamento técnico dos pagamentos via Financeiro (06/11/2026)

Somente leitura. Nada de código, banco, commit ou push foi alterado. Sem nome, CPF, salário ou chave PIX de pessoa aqui.

**Legenda:** **[V]** verificado (arquivo:linha ou medição agregada em produção) · **[H]** hipótese, não provada · **[M]** medição só de leitura em `iyytcavcgukfjnjjrerx`, hoje de manhã.

**Caminhos:** `F/` financeiro, `R/` rh, `O/` orcamento, `N/` fornecedores, todos em
`C:\Users\joao-\AppData\Local\Temp\claude\8b487bef2614d2fb\7645a9ed-944e-4d64-8425-05f5ec28725e\scratchpad\repos\`.

| Repo | Commit | Pull |
|---|---|---|
| financeiro | `375f72ae` (05/11 22:11) | atualizou, mesmo raso |
| rh | `d446a8dc` (05/11 09:17) | atualizou, mesmo raso |
| orcamento | `595e9b94` (04/11 23:46) | já atualizado |
| fornecedores | `4ce329fb` (04/11 12:38) | já atualizado |

## Correções aos documentos anteriores

| Documento dizia | O que é | Evidência |
|---|---|---|
| Folha com colegas de mesmo valor e dia dispararia a duplicidade [H] | **Falso.** A chave inclui o documento | [V] `F/lib/solicitacoes/repositorio.ts:116-121` |
| 24 de 26 PJ estão no catálogo | 26 de 26 têm cadastro ativo pelo CPF; **24 têm chave PIX** e 24 têm histórico nesse cadastro | [M] |
| José precisa incluir as categorias | **Quase nada:** nenhum CLT tem CC de OBRAS/SPOT. Só Transporte Urbano já foi alcançado (item 5) | [M] |
| Rateio 47/2/1 pessoas | Os 3 com várias linhas **são todos PJ**; os 24 CLT têm 1 linha | [M] |

---

## 1. Porta `POST /financeiro/api/integracoes/medicoes`

**Autenticação [V]**
- `Authorization: Bearer <FORNECEDORES_INTEGRACAO_SECRET>`, tempo constante, segredo com 32+ caracteres; sem segredo no servidor, ninguém passa: `F/app/api/integracoes/medicoes/route.ts:53-54`, `F/lib/catalogo/agendador.ts:9-15`.
- O porteiro libera qualquer POST em `/api/integracoes/` sem sessão: `F/lib/auth/porteiro.ts:21`, `:60-65`. **Rota nova embaixo desse prefixo não exige mudar o porteiro.**

**Validações, na ordem [V]** (`F/lib/integracoes/medicoes.ts`)
1. Segredo (`:128`). 2. Chave `medicao.id` uuid e `medicao.numero` (`:39-48`, `:132`). 3. Chave conhecida devolve 200 sem validar o resto (`:137-138`).
4. Corpo: `solicitanteEmail` + `solicitacaoFormSchema`, a mesma regra da tela (`:50-57`, `:140`). 5. E-mail precisa ser conta do hub, senão 422 (`:145-152`).
6. Catálogo + `interpretarEnvio`: fornecedor ativo, documento com 11 ou 14 dígitos, categoria, tipo de documento e todos os CCs ativos (`:154-161`; `F/lib/solicitacoes/preparar.ts:74-81`, `:173-188`).
7. Trava de obra (`:166-186`). 8. Duplicidade **só etiqueta, não recusa** (`:188`; `preparar.ts:296`). 9. Grava (`:205`). Banco: rateio tem de fechar valor e 100% (`006:287-289`).

**Idempotência [V]**
- PK `(ambiente, origem, chave)`, trava `pg_advisory_xact_lock`: `F/supabase/hub-install/023_fin_integracao_medicoes.sql:17-24`, `:50-61`.
- Repetir devolve a primeira **em qualquer etapa**, inclusive recusada ou cancelada (`023:57-60`). Reenviar exige chave nova; o Fornecedores usa "tentativa": `N/lib/integracoes/financeiro.ts:143-157`.
- Em produção só existe a origem `fornecedores_medicao`, com 5 linhas [M].

**O que barra a origem RH hoje [V]**
- CHECK do banco: `023:19` (confirmado em produção [M]).
- Constante e tipos: `medicoes.ts:36`, `:134`; `F/lib/solicitacoes/repositorio.ts:142`.
- A chave tem de ser uuid (`medicoes.ts:41`). O texto de erro e o evento falam em medição (`:150`, `:195-203`).
- Categorias: **não há lista permitida**, qualquer categoria ativa passa. As seis existem e estão ativas [M]:

| Categoria | Código | Formas no histórico [M] | Tipo de documento usado [M] |
|---|---|---|---|
| Salários | 2.03.01 | `pix_chave` | PIX |
| FGTS | 2.03.07 | `pix_qrcode` | PIXQC, GFD |
| Vale Refeição | 2.03.12 | `pix_qrcode`, `pix_chave` | PIXQC, PIX |
| Vale Transporte | 2.03.11 | `pix_qrcode`, `boleto` | PIXQC, BOL |
| Transporte Urbano | 2.04.96 | `pix_chave` | 99999, PIX |
| Remuneração PJ | 2.03.99 | `pix_chave` | PIX, 99999 |

Não existe categoria de consignado no catálogo [M]. As 2 solicitações com "consign" na descrição estão em FGTS [M]. **[H]** A guia de consignado segue em FGTS; o Financeiro precisa confirmar.

**Recomendação: porta nova, `POST /financeiro/api/integracoes/rh/pagamentos`, com segredo próprio (`RH_INTEGRACAO_SECRET`).**

| | Porta nova | Generalizar `receberMedicao` |
|---|---|---|
| Fornecedores em produção | Intocado (`medicoes.ts` não muda) | Risco de regressão numa porta de dinheiro em uso |
| Segredo vazado | Cada um só cria a sua origem | Um segredo cria folha e medição |
| Guardas próprias da folha (abaixo) | Natural | Viram `if` por origem |
| Custo | Cerca de 100 linhas de orquestração repetidas | Menos linhas |

Reaproveita as primitivas que já são compartilhadas: `solicitacaoFormSchema`, `interpretarEnvio`, `montarPayload`, `gravarSolicitacao`. Combina com a regra do projeto de abstrair só com 3 ou mais usos reais.

Guardas que a porta RH deve acrescentar:
- Lista permitida de categoria e forma.
- Só `fornecedor.origem = catalogo`.
- `documentoEsperado` igual ao documento lido no catálogo.
- Bloqueio duro de duplicidade (item 10).
- Resposta com `valor_centavos`, `etiquetas` e `codigo_lancamento_omie`.

Chave de texto, por exemplo `rh:salario:2026-10:<colaborador_id>:t1`, cabe no limite de 100 caracteres (`023:20`).

---

## 2. Chave PIX

**Como funciona hoje [V]**
- **O catálogo não guarda a chave.** Guarda só `tem_chave_pix`, tipo e os 4 últimos caracteres: `F/supabase/hub-install/003_fin_catalogo.sql:18-20`, `F/lib/catalogo/mapear.ts:49-69`.
- **A chave de verdade fica no cadastro do Omie**, lida ao vivo na hora de lançar: `F/lib/omie/gravar.ts:363-371`, `F/lib/lancamento/executar.ts:392-426`, e vai no título em `pix_qrcode`: `F/lib/lancamento/titulo.ts:139-144`.
- `fin_solicitacao_chaves_pix` só recebe chave de fornecedor novo ou completada pelo financeiro: `preparar.ts:191-199`, `F/supabase/hub-install/008_fin_decisoes.sql:322-363`. **Com fornecedor de catálogo, a chave enviada no corpo é ignorada** (`preparar.ts:191`).
- `pix_recebedor` só vem de QR Code; não é chave: `preparar.ts:314`.
- `completar_chave_pix` nasce quando é `pix_chave`, catálogo e `tem_chave_pix = false` (`preparar.ts:293-295`) e **impede validar**: `F/lib/solicitacoes/etiquetas.ts:41`, `008:228-232`. Só o financeiro completa: `F/lib/solicitacoes/etapas.ts:84`.
- Chave do cadastro diferente da informada no pedido faz o lançamento falhar: `executar.ts:413-417`. Não troca chave existente: `gravar.ts:388-390`.

**O RH precisa guardar? Não.** Herdar é o caminho de menor risco:
1. RH manda `fornecedor: {origem: "catalogo", codigoOmie}`, `formaPagamento: "pix_chave"`, `chavePix: ""`.
2. Antes de enviar, a tela mostra tipo e final lidos de `fin_catalogo_fornecedores`, leitura já permitida pela regra 4 (`R/CLAUDE.md`). Mesmo formato do Financeiro: `F/lib/programacao/leitura-pagar-hoje.ts:62`, `:80-81`.
3. Pessoa sem chave no catálogo não sai do RH; aparece como pendência.

Por quê: guardar chave abriria um segundo cadastro de dinheiro, que divergiria do Omie e faria o lançamento falhar (`executar.ts:413`).

**Situação real [M]**

| | CLT (24) | PJ (26) |
|---|---|---|
| Cadastro ativo pelo CPF | 24 | 26 |
| Com chave no catálogo | 24 | 24 |
| Último pagamento no mesmo código Omie | 24 de 24 | 24 de 24 com histórico |
| CPF com mais de um cadastro ativo | 0 | 0 |
| Chave tipo CPF, final igual ao CPF da pessoa | 11 | 11 |
| Chave de outro tipo (e-mail, telefone, aleatória, CNPJ) | 13 | 13 |
| `fornecedor_omie_codigo` preenchido no RH | **0** | **0** |

**Limite a registrar:** em 26 pessoas, nada prova que a chave é da pessoa. Vale o que está no Omie, como já acontece hoje.

**Armadilha do PJ em CNPJ [M]:** há 3 CNPJs em Remuneração PJ, nenhum achado pelo CPF, todos com primeiro e último nome batendo com um PJ ativo. Dois PJ não têm chave, histórico nem salário no cadastro ([H] podem ser os mesmos). Resolver só pelo CPF pagaria pelo cadastro errado ou travaria. E a ligação manual hoje não aceita CNPJ: `R/supabase/hub-install/002_rh_colaboradores.sql:704`, `R/supabase/hub-install/003_rh_salario.sql:131`.

---

## 3. Anexos

- **A porta não aceita** [V]: `F/lib/integracoes/medicoes.ts:32-33`.
- Hoje só pela tela, pelo próprio solicitante, com sessão, em `aguardando_diretor`, `aguardando_financeiro` ou `devolvida`: `F/lib/anexos/actions.ts:23-24`, `:52-62`; `F/lib/solicitacoes/etapas.ts:71`.
- Formatos e limites [V]: PDF, JPG, PNG, conferidos pelo conteúdo do arquivo; 10 MB cada; 10 por solicitação: `F/lib/anexos/conteudo.ts:7-25`, `006:121-122`, `006:405-406` (bucket confirmado [M]).
- `fin_registrar_anexo` exige autor igual ao solicitante: `006:367-369`.
- Limite de corpo no Financeiro: 21 MB (`F/next.config.ts:105`, `:108`).
- **No RH não há `bodySizeLimit`** [V] `R/next.config.ts:100-104`, então subir PDF exige configurar. [H] O padrão do Next é 1 MB. O próprio Financeiro avisa que o proxy corta em silêncio (`F/next.config.ts:107`).
- Do Financeiro ao Omie: 3 anexos por rodada, uma vez por rodada [V] `F/lib/lancamento/anexos.ts:77`, `F/lib/lancamento/rodada-do-agendador.ts:120-123`. **24 anexos levam cerca de 40 minutos** depois dos títulos.

**Uso real [M]:** FGTS 8 de 8, Vale Transporte 2 de 2, VR 5 de 7, PJ 1 de 61. Salários: 0 de 24 em outubro, **23 de 23 em novembro**. Maior arquivo: 187 KB. Nenhuma regra exige anexo para validar [V] (`etiquetas.ts:41`). **O time já anexa nas guias, e na folha desde novembro, então vale incluir no escopo.**

**O que é preciso:** rota irmã `POST /api/integracoes/rh/anexos` (multipart), mesmo segredo, reaproveitando `tipoPeloConteudo`, `caminhoDoAnexo` e `fin_registrar_anexo`, com o solicitante da solicitação como autor.

**PDF ou imagem do QR não substitui o código.** `pix_qrcode` exige o copia e cola: `F/lib/solicitacoes/codigo.ts:20-22`, `:31`.

---

## 4. Prazos e lançamento em lote

**Regra [V]** `F/lib/solicitacoes/prazos.ts`
- Dia de referência: envio em dia útil até 17h00:00, senão o próximo dia útil (`:79-83`). Feriado conta como dia útil (`:2-3`).
- Data mínima: referência + 2 dias úteis (`:18`, `:87-88`). Primeira janela: próxima segunda, quarta ou sexta (`:20`, `:89-90`).
- **Emergencial automático: `vencimento < primeira_janela`** (`:95`). Vai para `aguardando_diretor` (`006:249`). Não pede justificativa (`F/lib/solicitacoes/schemas.ts:118`).

| Vencimento | Último envio sem emergencial | Efeito de enviar depois |
|---|---|---|
| Seg 09/11 | Qui 05/11 até 17h | **Enviando hoje, as 24 viram emergenciais** |
| Qui 19/11 (FGTS) | Seg 16/11 até 17h | Ter 17/11 cai na janela de sex 20/11 |

Bate com o medido [M]: 06/10, 24 de 24 emergenciais; 27/10 para 09/11, nenhuma.

**24 de uma vez**
- **O envio não toca no Omie** [V]: só banco (`medicoes.ts:205`). Consulta à Receita só em `cnpj_novo` (`:156`). Cada chamada percorre a lista de contas do hub (`route.ts:25-37`). **A porta não tem limite de taxa nem lote.**
- Passar das 17h no meio empurra as restantes para outra janela (cálculo por chamada, `preparar.ts:285`). A tela do RH precisa mostrar isso.
- E-mails: 1 aviso por chamada, para os 2 de cada papel (`route.ts:77-100`; `F/lib/avisos/avisar.ts:44-50`, `:69`; 2 financeiro e 2 diretor [M]). **Cerca de 48 e-mails, como já acontece à mão.** Vai para `docs/DIVIDAS.md`, não para o escopo.
- **Se forem emergenciais, o diretor aprova uma a uma** [V]: lote só existe para validar (`F/lib/solicitacoes/decisoes-actions.ts:190-203`, até 50 em `F/lib/solicitacoes/decisoes.ts:38`). Não achei aprovação em lote do diretor.

**Omie, depois da validação [V]**
- Por título: `ConsultarCliente`, `ConsultarContaPagar`, `IncluirContaPagar`, com 0,35 s antes de cada chamada: `executar.ts:399`, `gravar.ts:407-409`, `F/lib/omie/cliente.ts:135`, `:197`.
- 5 títulos por lote, 10 s entre eles (`executar.ts:43-44`), respiro de 10 s (`F/lib/lancamento/rodada.ts:27`), orçamento de 3 min por rodada incluindo faturamento e entrega (`rodada.ts:26`), rodada a cada 5 min (`010:21-22`, ativo [M]).
- Só um processo fala com o Omie por vez (`F/lib/omie/vez.ts:7-11`, `035`); a vez é dividida com as outras filas e com o Orçamento.
- Bloqueio medido: 10 títulos em 1 minuto bloquearam a chave por ~30 min (`executar.ts:36-41`). Erro temporário para a rodada toda e reespaça em 5, 10, 15, 30, 60 min (`F/lib/lancamento/espera.ts:9`, `rodada.ts:74`).
- Catálogo sincronizando (minuto 17) pula a tarefa sem gastar tentativa (`executar.ts:329-341`).
- **Conta teórica:** até ~18 títulos por rodada, 24 em duas rodadas (~10 min) [H, sem concorrência]. **Medido [M]:** primeiro a último lançamento de Salários levou 114 min em 28/10 e 303 min em 06/10 ([H] parte é a validação humana espaçada; o de 06/10 tem o bloqueio).
- **Nenhuma fila nova é necessária:** a validação abre a tarefa (`decisoes-actions.ts:174-180`).

---

## 5. Trava `fin_obra_exige` e `fin_obra_categorias_fixas`

**Regra [V]:** exige obra se **qualquer linha do rateio** tem OBRAS ou SPOT no nome do CC **e** a categoria não é fixa: `F/supabase/hub-install/044_fin_obra_vinculos.sql:98-114`, `F/lib/obra/regra.ts:135-160`. Corte: criadas desde 01/11/2026 (`regra.ts:166`).

| Categoria | Fixa? [M] | Rateio do cadastro em OBRAS/SPOT [M] | Histórico em OBRAS/SPOT [M] | Efeito |
|---|---|---|---|---|
| Salários | Não | 0 de 24 CLT | 0 | Não alcança hoje |
| FGTS / consignado | Não | 0, se rateado pelos CLT | 0 | Não alcança hoje |
| Vale Refeição | **Sim** | 0 | 2 | Nunca barra |
| Vale Transporte | Não | 0, se rateado pelos CLT | 0 | Não alcança hoje |
| Transporte Urbano | Não | depende da pessoa | **1 de 3** | **Barra** quem estiver nesses CCs |
| Remuneração PJ | **Sim** | 9 de 26 PJ | 21 de 61 | Nunca barra |

**Onde barra [V]:**
- **Pela tela:** recusa ao criar: `044:313-315`, `:340-357`, `F/lib/obra/divisao.ts:153-154`.
- **Pela porta:** **não recusa.** Cria como `"pendente"`, pelo `023`: `medicoes.ts:163-186`, `repositorio.ts:161-163`. Vai para a fila "Sem obra".
- **Barra ao validar**, só no TypeScript: `decisoes-actions.ts:168-170`. O banco não confere (`008:215-232`).

**Conclusão:** pela porta nova, a trava **não impede o RH de criar**; só deixa pendência. O caso real é Transporte Urbano. Incluir categoria fixa não precisa de migration em arquivo: há função própria com trava de papel (`044:489`). **Não achei tela que a chame** [V, busca em `app` e `lib`], então é uma chamada à mão, com o José.

**Recomendação:** o José decide só sobre Transporte Urbano. Salários, FGTS e VT não precisam entrar agora. Marcá-las como fixas tiraria a trava de vez, sem benefício hoje.

---

## 6. Situação e cancelamento

**Ler o estado [V]**
- Corpo só com a chave é consulta: 200 se existe, 400 se não existe, sem criar: `medicoes.ts:73`, `:132-138`. Precedente: `N/lib/integracoes/financeiro.ts:389-403`.
- Devolve `numero, id, etapa, vencimento, motivo`: `repositorio.ts:186-194`.
- Pago: `fin_pagamentos_por_solicitacao(uuid[])`, chamada com chave de serviço: `F/supabase/hub-install/024_fin_pagamentos_omie.sql:228`, `:250`; uso em `N/lib/pagamentos/repositorio.ts:69`. Não aparece em consulta do papel de leitura [M], mas o `grant` está no arquivo. Fonte: rotina diária (`024:5-9`).

**Lacunas [V]**
- Não devolve valor nem etiquetas. O solicitante pode reenviar a devolvida com outro valor, e o RH não veria.
- `motivo` só em recusada ou cancelada: `repositorio.ts:213-225`. Devolvida vem sem motivo.
- O Fornecedores consulta por agendador. O RH não tem nenhum agendador hoje [V] (só `app/api/health`).

**Cancelar ou devolver: não há porta** [V] (só `app/api/integracoes/medicoes`).
- Cancelar: Server Action com sessão; o banco exige autor igual ao solicitante e etapa aberta: `006:329-334`, `etapas.ts:70`.
- Devolver: só diretor ou financeiro: `etapas.ts:74-75`. Reenviar: solicitante, pela tela do Financeiro: `etapas.ts:72`.

**Recomendação:** primeira versão sem porta de cancelamento. O solicitante é a própria pessoa do RH logada, e ela cancela no Financeiro. O RH mostra o link e relê a situação ao abrir a tela. Recusada ou cancelada liberam "tentativa 2", com chave nova, igual ao Fornecedores.

---

## 7. RH: estrutura e onde entra

**App [V]**
- Rotas: `R/app/(modulo)/page.tsx`, `novo`, `[id]`, `importar`, `papeis`; menu em `R/app/(modulo)/layout.tsx:18-21`.
- Server Actions: `R/lib/colaboradores/actions.ts`, `R/lib/papeis/actions.ts`, com `requireSessao` e papel antes de tudo (`actions.ts:31-34`), retornando `ActionResult`.
- Escrita por RPC com chave de serviço: `R/lib/colaboradores/repositorio.ts:31-35`. Leitura com cookie, o banco decide a máscara: `R/lib/colaboradores/queries.ts:6`.
- Papéis: `rh` edita, `diretoria` vê, admin só consulta: `R/lib/auth/permissoes.ts:24-37`. Salário só `rh` e `diretoria`: `003:39-46`. Quem não tem papel vai para `/sem-acesso`: `R/lib/auth/sessao.ts:49`. Produção: 2 `rh`, 1 `diretoria` [M].
- Auditoria: `rh_auditar` e tabela imutável: `002:63-97`, `:101-134`. Serve para tabela nova, com gatilho igual.
- Testes: `R/tests/` tem `hub-install-pglite` e `hub-install-safety`, mais Vitest por módulo. A safety proíbe alcance global (`hub-install-safety.test.ts:15-40`).
- Regras a respeitar: `R/CLAUDE.md` 4 (só escreve em `rh_*`), 7 (nunca Omie), 9 (segredo), 10 (CPF mascarado). **A porta HTTP respeita todas; escrever direto em `fin_*`, mesmo com chave de serviço, não.**

**Rateio [V]**
- `rh_colaborador_rateios`: vigência no dia 1, `numeric(5,2)`, soma 100: `002:49-58`, `R/lib/rateio/vigencia.ts:20-38`, `:42-50`.
- Conversão para o Financeiro: texto com vírgula e até 2 casas: `F/lib/solicitacoes/rateio.ts:24-30`. **"33.33" é recusado.** A sobra vai para a última linha (`rateio.ts:66-73`). Máximo de 20 linhas (`schemas.ts:17`).
- CC inativo é recusado (`preparar.ts:185-186`); hoje 0 pessoas nessa situação [M].
- O cadastro é vivo. O envio precisa guardar o **rateio do mês** em cópia, por `rh_pagamentos`.
- PJ já paga com o rateio do cadastro no histórico: 9 solicitações com 2 ou 4 linhas [M]. CLT: 100% com 1 linha, sem mudança no Omie.

**Colaborador para fornecedor [V + M]**
- `fornecedor_omie_codigo` existe, com índice único: `002:29`, `:42-44`. Está vazio em 50 de 50 [M].
- Caminho: função `rh_ligar_fornecedores_por_cpf`, lendo o catálogo com ajuste de zeros à esquerda, como `002:699-702`. Ela só liga 1:1 e devolve o que sobrou. A confirmação é humana na primeira vez.
- CNPJ precisa ser ligado à mão e exige afrouxar `003:131` e `002:704` para PJ.
- Não reutilizar `rh_buscar_fornecedor_pf`, que é só busca da tela.

**Telas novas** [H de organização]: `app/(modulo)/pagamentos/` com competência; subir arquivos e conferir; lista de envio; situação. `app/(modulo)/pagamentos/pj/`. Tudo só para o papel `rh`; `diretoria` lê; admin sem valores. Respeita a regra de 05/11 (`R/CLAUDE.md`).

**Orçamento: o que não pode mudar [V]**
- Lê as tabelas direto, em SQL, sem view: `O/supabase/hub-install/022_orc_colaborador_salario.sql:113-131`, `016_orc_headcount.sql:260-282`, `007_orc_direcionadores.sql:103-110`, `:237`, `:775`, `:905-922`, `008_orc_valores.sql:128`, `:185`, `024_orc_inss_retido.sql:359`, `:416`. Regra em `O/CLAUDE.md`.
- **Não renomear nem remover:** em `rh_colaboradores`, `id, nome, cargo, tipo_contratacao, admissao, desligamento, status, salario_centavos`; em `rh_colaborador_rateios`, `colaborador_id, vigente_desde, departamento_omie_codigo, percentual`.
- **Não mudar o sentido:** vigência é a maior `<=` ao mês; `socio` fica fora; soma 100.
- **Não gravar o líquido em `salario_centavos`:** o Orçamento leria como salário base (`022:131`). Líquido fica só em tabela nova.
- **Não trocar a categoria da folha:** o orçado lê o realizado por categoria (`O/docs/superpowers/specs/2026-10-16-orcamento-design.md:34`).
- Coluna nova e tabela nova não afetam.

---

## 8. Leitura de PDF e foto de nota

**Bibliotecas [V, `package.json` de cada app]**

| App | Instalado | Serve? |
|---|---|---|
| RH | nada de PDF ou IA | — |
| Financeiro | `pdf-lib` (só monta, em `lib/faturamento/ranf.ts:1`), `@anthropic-ai/sdk` | IA sim; texto de PDF não |
| Hub | `pdfjs-dist` (só navegador, `app/obras/obras/[id]/mapa/montar/_pdf-para-imagem.ts`), `openai`, `@react-pdf/renderer` | Outro app |
| CRM | `@ai-sdk/anthropic`, `@ai-sdk/openai` | Outro app |
| Orçamento, Fornecedores, Compras, Cockpit | `exceljs` em alguns; nada de PDF | — |

Nenhum app tem decodificador de QR Code (`jsqr`, `zxing`) [V].

**Chaves, só os nomes [V]**
- Financeiro: `ANTHROPIC_API_KEY`, opcional (`F/lib/env.ts:46`). **[M] Indício de que está ativa:** 16 leituras em `fin_fat_leituras`, a última hoje.
- Hub: `OPENAI_API_KEY`, `OPENAI_MODEL` (`app/obras/obras/_lib/ia-semanal.ts:10-13`). Não confirmei se está no ar.
- Cockpit: `ANTHROPIC_API_KEY` nas Edge Functions (`supabase/functions/relatorio-diario/index.ts:27`).
- CRM: documenta `LLM_PROVIDER`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`. RH: nenhuma (`R/.env.example`).

**Padrão pronto para copiar [V]:** imagem em base64, resposta em JSON Schema, conferida com Zod: `F/lib/faturamento/email/ia.ts:178`, `:225-231`. O Financeiro **não** usa bloco de PDF. [H] A API aceita PDF direto; não testei.

**Menor opção, sem dependência nova:**

| Arquivo | Proposta | Por quê |
|---|---|---|
| **Relatório de Líquidos** | **Primeiro abrir um PDF real.** Se tiver texto: copiar e colar na tela, com o leitor que o RH já tem (`R/lib/importacao/ler-colado.ts`) | Determinístico, sem terceiro, sem chave. Não é o "subir PDF" pedido, mas entrega hoje |
| Guias FGTS e consignado | Colar o copia e cola; valida por CRC (`F/lib/pagamento/pix.ts:61-67`) e anexar o PDF | Sem decodificador de QR. [H] O PDF pode trazer o código em texto |
| Foto de nota do PJ | IA com `fetch` e o padrão de `ia.ts`, nova `ANTHROPIC_API_KEY` no RH; depois conferir com o cadastro | Foto não tem camada de texto. Risco baixo: a pessoa confere |
| Upload do PDF da folha com IA | Segunda etapa | **Decisão do João:** manda CPF e líquido de 24 pessoas a um terceiro. Nada do Financeiro faz isso hoje com folha |

**Bloqueio:** os PDFs ainda não foram lidos (`2026-11-05-impacto-respostas-do-cliente.md:43`). Sem isso, não sei se há texto, CPF ou matrícula. **Sem CPF no PDF, casar só por nome vira decisão de dinheiro.**

---

## 9. Migrations e deploy

Manuais, sem CLI, só o arquivo novo, depois `npm run types`: `F/CLAUDE.md` regra 1, `R/CLAUDE.md` regra 2. **Schema pede autorização do João (AGENTS.md); no Financeiro, também do José.**

| Ordem | Arquivo | O que faz |
|---|---|---|
| 1 | `F/047_fin_integracao_rh.sql` | Troca o CHECK de `origem` para aceitar `rh_pagamento`. Só amplia; não afeta o Fornecedores. Ajustar `F/tests/hub-install-pglite.test.ts:2925` |
| 2 | `R/004_rh_pagamentos.sql` | `rh_competencias` (mês, situação, total do relatório, arquivo) e `rh_pagamentos` (tipo, colaborador, fornecedor, documento esperado, valor, vencimento, forma, cópia do rateio, chave, tentativa, retorno do Financeiro). Único por competência + colaborador + tipo ativo. RLS, `revoke`, auditoria, funções `rh_*`, valor escondido de quem não vê salário |
| 3 | `R/005_rh_fornecedor_pagamento.sql` | Coluna `emite_nota` em `rh_colaboradores`; afrouxa PF para PJ (`003:131`); função de ligar por CPF; leitura de tipo e final da chave; fornecedor de guia (FGTS 1, VR 3, VT 1 no histórico [M]) |
| 4 | `R/006_rh_arquivos.sql` | Bucket privado e registro de arquivo com hash, para detectar reenvio. Só se os PDFs ficarem guardados no RH |
| — | Sem migration | Categoria fixa de Transporte Urbano: chamada à função do `044`, decisão do José |
| — | Sem migration | Bloqueio de duplicidade: TypeScript na porta; o índice `006:100` já serve |

**Deploy, nesta ordem:**
1. Aplicar `047`.
2. Definir o mesmo `RH_INTEGRACAO_SECRET` nos dois apps, mais `FINANCEIRO_URL` no RH.
3. Deploy do Financeiro. Conferir `Last-Modified` dos chunks. Sem chamador ainda, a rota fica parada.
4. Aplicar `004`, `005`, `006` no RH.
5. Deploy do RH.
6. **Teste de fumaça:** uma solicitação com descrição `TESTE - APAGAR`, que nunca vai ao Omie (`executar.ts:290-296`, `F/lib/lancamento/conferir.ts:82-84`), e cancelar depois.
7. **Primeiro título real pede autorização do José:** `F/CLAUDE.md` regra 4.

Cada ponta sobe sozinha. Nenhuma das mudanças exige alterar Orçamento, Fornecedores ou o hub.

---

## 10. Riscos de dinheiro

| Risco | Evidência | Guarda necessária |
|---|---|---|
| **Pagar de novo a folha de 10/2026** | 23 solicitações já `lancada`, vencimento 09/11 [M]. A contabilidade fala em 07/11; a duplicidade atual só casa valor **e vencimento iguais**, e **só etiqueta, não bloqueia** (`repositorio.ts:116-121`, `etiquetas.ts:41`) | **Primeiro envio real é a próxima competência.** Porta RH recusa (422) se houver ativa com mesmo documento + categoria + mês de vencimento, com liberação explícita e motivo para exceção como adiantamento (2 casos avulsos no histórico [M]) |
| Duplicidade por clique ou rede | PK e trava (`023:23`, `:50`) | Chave determinística gravada no RH **antes** de chamar; repetir devolve a mesma; nunca gerar chave aleatória |
| Reenvio do mesmo PDF ou PDF corrigido | Folha "não reabre" após eSocial | Hash do arquivo por competência; reenvio não recria. Valor mudou com chave já usada: **nunca sobrescreve**, exige cancelar lá e abrir tentativa 2 |
| Pagar a pessoa errada: `fornecedor_omie_codigo` errado | Hoje a RPC só exige PF existente (`003:127-134`) | `documentoEsperado` conferido na porta contra o catálogo. Primeira ligação de cada pessoa confirmada à mão. CNPJ: ligação manual, com nome à vista |
| Pagar a pessoa errada: troca de linha na leitura do PDF | PDF não lido | Casar por CPF. Sem CPF: nome normalizado exato e único, mais confirmação linha a linha. Linha sem par para o envio dela |
| Chave PIX errada no Omie | Chave lida ao vivo no lançamento (`executar.ts:399`); 26 chaves sem como provar o dono [M] | Mostrar tipo e final na conferência. Chave tipo CPF com final diferente do CPF: bloquear (hoje 0 casos [M]). Trocar a chave no Omie entre conferir e lançar **não é detectado**, igual a hoje: registrar em `docs/DIVIDAS.md` |
| Soma não fechada: lote | Não existe conferência de total | Bloquear envio se a soma das linhas diferir do total impresso no relatório, em centavos inteiros |
| Soma não fechada: quem falta | 23 solicitações para 24 CLT ativos [M], sem explicação | Listar CLT ativo sem linha e linha sem CLT ativo; envio só com cada caso resolvido por escrito |
| Soma não fechada: rateio | Banco recusa (`006:287-289`) | Enviar `percentual` no formato com vírgula; a sobra fica na última linha |
| QR de guia com valor errado ou vencido | **Todos os 14 QR de FGTS, VR e VT são dinâmicos** [M], então `valor_diverge_codigo` quase nunca ajuda (`pix.ts:97-99`, `preparar.ts:299`) | CRC já existe. Conferir valor com o PDF e mostrar recebedor (`pix_recebedor`). Enviar perto do vencimento; [H] o código pode expirar |
| Falha no meio dos 24 | Cada chamada é independente | Situação por linha no RH (`rascunho, enviando, criada, erro`); "enviar de novo" só refaz o que não confirmou, pela mesma chave. Resposta incerta conta como não confirmada |
| Lote enviado tarde vira emergencial | Diretor aprova uma a uma (item 4) | Tela mostra a janela e avisa antes de enviar. Não há como "forçar" não emergencial, e não deve haver |
| PJ sem nota | Decisão do cliente: paga pelo cadastro | `emite_nota = false` e `salario_centavos` preenchido; 2 PJ sem valor [M] ficam pendentes, nunca zero nem estimado |
| Vazamento | Regra 9 do Financeiro | Nunca chave inteira em log, tela ou e-mail. PDF em bucket privado. `descricao` e `observacao` vão ao Omie (`titulo.ts:213`): sem CPF |

---

## Em aberto

1. Layout real dos PDFs: bloqueia o desenho da leitura.
2. Se a guia de consignado fica em FGTS, e o motivo de 23 x 24.
3. Se a folha enviar CPF ao provedor de IA é aceitável (decisão do João).
4. Transporte Urbano como categoria fixa (decisão do José).
5. Quais PJ são pagos em CNPJ e quem são os 2 sem chave, pela tela do RH; aqui fica só a contagem.
6. Consultas feitas ao banco: `scratchpad\medir.py`, `medir2.py`, `medir3.py` (só agregados).
