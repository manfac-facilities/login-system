# OBRAS — modalidade de obra de médio/grande porte no Gestão de Obras

**Data:** 29/10/2026 · **Pedido:** José Guilherme (texto literal em `docs/cliente/2026-10-29-obras-modalidade-obra-pedido-inicial.md`) · **Base técnica de domínio:** especificação SGO do Eduardo (`docs/cliente/2026-10-29-sgo-especificacao-eduardo.md`) · **Mockups do brainstorming:** `.superpowers/brainstorm/7236-1793294762/content/` (`mapa-sem-planta.html`, `celular-supervisor.html`, `cliente-email-e-pagina.html`).

## 1. Intenção

Hoje o Gestão de Obras mistura numa lista só os SPOTs (pequenos, frequentes, pouco detalhe) e as obras grandes (Telhado CD Profarma, PLK Popeyes, DP Macaé 3 — R$ ~450 mil, CEO e diretoria da DPSP acompanhando). As obras grandes precisam de **outro jeito de trabalhar**: cronograma por atividade, diário de obra completo, registro de impedimentos com responsável e, no centro de tudo, **o cliente informado sem precisar perguntar**.

Dois porquês, nas palavras do pedido:

1. **Comunicação:** o cliente tem que olhar e pensar "esses caras têm todas as informações da obra na mão". Diário todo dia de execução, fechamento semanal e mensal: onde estamos, o que fizemos, para onde vamos, estamos no prazo.
2. **Proteção:** no PLK a Manfac avisou a loja que não podia molhar o piso; a loja lavou todo dia; ninguém avisou a manutenção do PLK, que agora cobra correções e atraso como se fosse erro da Manfac. Em outras obras, impedimentos do cliente não foram registrados e o cliente achou que o atraso era da Manfac. **Todo impedimento, com responsável, data e foto, tem que chegar por escrito a quem cobra do lado do cliente.**

Macaé 3 é a obra piloto e o modelo para todas as outras.

## 2. Objetivos, não-objetivos, anti-objetivos

**Objetivos**
- Separar SPOT e OBRA no Gestão de Obras; OBRA tem tela própria.
- Diário de obra preenchido no celular pelo supervisor de campo (com apoio de um administrativo), validado pelo engenheiro e enviado ao cliente por e-mail.
- Impedimentos registrados com responsável (Cliente / Manfac / Terceiro / Clima) e dias de impacto, inclusive "aguardando o cliente" antes de a atividade começar.
- Relatórios diário, semanal e mensal ao cliente, com destinatários configuráveis por obra e por tipo.
- Entregar em fases curtas, cada uma em produção quando pronta. **Fase 1 em produção o mais rápido possível** (pedido: "tem que funcionar agora").

**Não-objetivos (agora)**
- Câmera 360°, drone, BIM.
- Reproduzir a planilha do Eduardo inteira na Fase 1 (orçamento consolidado de 106 itens, conflitos REV×LPU, locações, medições com o cliente ficam para fase posterior — seção 6).
- App nativo/offline. É web responsiva.

**Anti-objetivos (seria fracasso mesmo funcionando)**
- O cliente ver custo, margem, fornecedor ou causa interna detalhada (Compras/Financeiro). **Nunca.**
- O supervisor achar o diário chato e parar de preencher. Tudo que puder vir pré-preenchido vem.
- Um impedimento do cliente acontecer e não sair por escrito no relatório daquele dia.
- Quebrar o fluxo dos SPOTs, a sincronização com o Field, o faturamento ou a conciliação.

## 3. Decisões tomadas pelo José (não reabrir)

1. **Uma OS só por obra.** A OS é aberta no Field "só para cumprir tabela"; a obra vive no hub. Macaé 3 = OS `1026-014683` (já existe em `obras_obra`, id `a6271663-d342-4669-8c32-f9dd97e8aa7c`, etapa `definir`).
2. **OBRAS é praticamente outro sistema** dentro do Gestão de Obras: inovador, mas prático.
3. **Preenchimento pelo celular**, pelo supervisor de campo, com um administrativo apoiando.
4. **Destinatários:** analista do cliente recebe o diário; coordenador recebe o semanal; diretor ainda indefinido. Cadastro de e-mails por obra e por tipo de relatório, definido no final.
5. **Primeira tela do e-mail responde:** status atual da obra, onde está travado, o que a Manfac evoluiu.
6. **"Impedimento", não "impedimento da loja".** Genérico, com responsável. É passo fixo do diário (não alerta em tempo real). É de extrema importância, inclusive para o caso "o cliente nos travou de começar".
7. **Cliente tem acesso à página da obra só se cadastrado:** digita o e-mail e entra sem senha (código/link no e-mail).
8. **Mapa da obra em 3 modos, escolhidos por obra:** planta (layout da loja com pontos e zonas), croqui (retângulos desenhados no app) ou ambientes (cartões, sem mapa). Mesmo dado por baixo; dá para trocar depois.
9. **E-mail do cliente ≠ e-mail interno.** O interno mostra a cadeia de causa entre áreas (ex.: material não chegou → Compras pediu no prazo → Financeiro pagou atrasado).
10. **A obra precisa oferecer, de dentro dela:** solicitar cotação (Compras), medição de fornecedor (Gestão de Fornecedores) e solicitação de pagamento (Financeiro).
11. **Entregar em fases e etapas, versões iniciais, melhorar depois.**

## 4. Estrutura do sistema (pilares)

Proposta aceita no brainstorming. Abas da obra: **Painel · Planejamento · Restrições/Impedimentos · Execução (diário) · Qualidade · Custos (interno) · Comunicação.** Comunicação é *saída* dos outros pilares ("registrar uma vez, usar em tudo" — princípio do Eduardo). Do Lean/Last Planner entram só: análise de restrições, plano da semana com **PPC** (% do prometido na semana que foi entregue) e **causas de não cumprimento classificadas por responsável**.

As abas aparecem conforme as fases ficam prontas; a Fase 1 só precisa de Painel (mínimo), Planejamento (leitura + % ), Execução, Impedimentos e Comunicação (destinatários + histórico de envios).

## 5. Fase 1 — o que entra agora (detalhado)

### 5.1 SPOT × OBRA
- Nova coluna `obras_obra.modalidade text not null default 'spot' check (modalidade in ('spot','obra'))`. A sincronização do Field não mexe nela.
- Marcação manual (admin) — na Fase 1, via SQL para Macaé 3; botão "Tornar OBRA" na ficha pode vir junto se custar pouco (decisão do builder).
- Nova aba **OBRAS** no topo do módulo (`_ui/abas-obras.tsx`), listando as obras com `modalidade='obra'`: nome, cliente, sinal (no prazo/atenção/atrasado), % previsto × realizado, último diário enviado. A aba Base continua mostrando tudo (não esconder OBRAs dos SPOTs na Fase 1 — evita quebrar KPIs e conciliação; *chamada minha*).
- Página da obra: `app/obras/obras/[id]/` (*chamada minha*; o builder pode escolher outro segmento se colidir com algo).

### 5.2 Cronograma (Planejamento)
Tabela de atividades por obra, com as regras e cálculos da seção 5 da especificação do Eduardo:
- campos: número, frente, etapa, descrição, saída/trava (texto), predecessora 1 e 2, duração em dias úteis, responsável (função), status (Não iniciado | Em andamento | Concluído | Bloqueado), % realizado, início/fim real, `bloqueia_por_trava`, `peso_valor` (R$).
- data-base da obra (`obras_obra` ou tabela de configuração da obra).
- calculados: início/fim previsto (dias úteis, feriados, predecessoras, recusa de ciclo), % previsto na data, avanço previsto/realizado da obra, desvio em p.p., situação (Concluída | BLOQUEADA | ATRASADA | INÍCIO ATRASADO | No prazo), previsão de término.
- **peso:** `peso_valor / Σ peso_valor`. *Chamada minha:* na Fase 1 o `peso_valor` de cada atividade é semeado com a soma dos itens do orçamento do Eduardo vinculados a ela (seção 10.2), sem importar os 106 itens. Atividade sem valor tem peso 0.
- **trava estrutural:** atividades com `bloqueia_por_trava` não podem ir para Em andamento enquanto a atividade-trava (Macaé: nº 6) não estiver Concluído — validado no servidor, e mostrado com cadeado no celular e como alerta no e-mail.
- tabela de feriados (seed da seção 10.5).
- Fase 1: edição do cronograma pelo engenheiro numa tabela simples (status, %, duração, datas reais). Gantt e curva S ficam para a Fase 2.
- Seed de Macaé 3: as 28 atividades da seção 10.1 com predecessoras, durações, status inicial e trava em 11, 12, 13, 14, 21.

### 5.3 Diário de obra (celular) — conforme mockup `celular-supervisor.html`
Um diário por obra por dia, estados **rascunho → validado → enviado**.
1. **Equipe:** efetivo (nº de pessoas, empresa/equipe), pré-preenchido com o do último diário. Clima: campo simples (sol/nublado/chuva/impraticável) — *automático por API de clima fica para depois (chamada minha)*.
2. **Fotos:** várias por dia (sem o limite de 1 do diário atual), comprimidas no celular (reaproveitar `diario/_foto.tsx` / `lib/sofia/comprimirImagem.ts`), bucket `obras-fotos`, caminho `{obra_id}/rdo/{data}/{uuid}.jpg`. Cada foto com legenda opcional e, quando houver, o ambiente/ponto (a estrutura de pontos fixos vem na Fase 4; na Fase 1 a legenda basta).
3. **O que andou:** lista das atividades em andamento ou com início previsto até hoje; o supervisor ajusta o % (arrastar ou digitar) e marca concluída. Atividade que não andou pede a causa tocando num chip: Cliente/loja, Material, Equipe, Clima, Projeto, Outro — cada uma mapeada para um responsável. Atividade travada aparece com cadeado e não deixa marcar.
4. **Impedimentos:** registro com tipo (Área não liberada · Cliente no local · Serviço danificado pelo cliente · Orientação descumprida · Decisão pendente do cliente · Material do cliente · Material Manfac · Equipe · Clima · Outro), **responsável** (Cliente | Manfac | Terceiro | Clima), atividade afetada, descrição (texto; ditado pelo teclado do celular serve), foto opcional, pessoa do cliente envolvida (texto), impacto estimado em dias (fração permitida, ex. 0,5), `exibir_ao_cliente` (padrão sim quando responsável = Cliente/Clima; padrão não quando Manfac/Terceiro — *chamada minha*). Impedimento pode ficar **aberto por vários dias** ("aguardando cliente desde 23/10") até ser encerrado; aberto aparece em todo diário com a contagem de dias.
   - **Orientação à loja** (ex.: "não molhar o piso por 72h") é um registro do mesmo tipo de tela: texto, quem recebeu (nome/função), data, foto; sai no diário daquele dia. Se depois for descumprida, vira impedimento ligado a ela.
5. **Amanhã:** texto da programação, pré-sugerido com as atividades cujo início previsto é o próximo dia útil.
- **Validar e enviar:** o engenheiro (ou admin) revisa no computador ou celular, pode editar, e aperta "Validar e enviar". O administrativo pode completar o rascunho. Permissões na Fase 1: qualquer usuário com acesso `obras` preenche; validar/enviar = admin ou a pessoa marcada como engenheiro responsável da obra (*chamada minha*; o hub hoje só tem papéis analista/administrador).
- Relação com o diário atual (`obras_diario`, uma linha por obra/dia de SPOT): OBRAs **não usam** o diário de SPOT; ficam fora da aba Diário atual (*chamada minha* — evita preencher duas vezes).

### 5.4 E-mail diário ao cliente — conforme mockup `cliente-email-e-pagina.html` (lado esquerdo)
HTML responsivo, ordem fixa:
1. Cabeçalho: MANFAC · DIÁRIO DE OBRA · obra · dia N · data · "validado por <engenheiro> às hh:mm".
2. **Sinal** (verde no prazo | amarelo atenção: desvio entre -5 e 0 p.p. ou impedimento do cliente aberto | vermelho atrasado: desvio < -5 p.p. ou previsão de término além da linha de base) + previsão de entrega. *Limiares são chamada minha, ajustáveis.*
3. Três números: % previsto, % realizado, **dias de impacto do cliente** (soma acumulada dos impedimentos com responsável Cliente).
4. **Onde está travado:** impedimentos abertos com `exibir_ao_cliente`, com responsável e "há N dias"; trava técnica (ex.: escoramento) como item próprio.
5. **O que a Manfac fez hoje:** atividades que avançaram (de→para %, concluídas) + até 6 fotos.
6. **Amanhã.**
7. (Fase 3) botão "Ver a obra completa".
- Nunca mostra custo, valor, fornecedor ou causa interna. Impedimento com responsável Manfac aparece só como "Manfac", sem área.
- Fotos: anexadas inline (CID), redimensionadas, porque URL assinada expira em 60 s (*chamada minha*).
- Envio pelo SMTP já usado (`app/api/obras/relatorio-diario/route.ts`, nodemailer Locaweb). Remetente e reply-to: definir com o José na configuração (ver seção 8).
- **E-mail interno do diário** na Fase 1 = o mesmo do cliente + bloco extra com impedimentos não exibidos ao cliente, enviado aos destinatários internos da obra. A cadeia de causa entre áreas é Fase 5.

### 5.5 Destinatários e histórico
- Por obra: lista de e-mails com nome, função, lado (cliente | interno) e tipos que recebe (diário, semanal, mensal, imediato). Tela simples na aba Comunicação.
- Todo envio registrado: tipo, período/data, quem validou, quem enviou, quando, destinatários, resultado do SMTP. Envio já feito não se apaga. Reenvio permitido (registra novo envio).

### 5.6 Painel mínimo da obra
Sinal, % previsto × realizado, desvio, previsão de término, atividades atrasadas, impedimentos abertos (por responsável, com dias), trava ativa, último diário enviado, diário de hoje (estado). É a mesma "primeira tela" do e-mail.

## 6. Fases seguintes (cada uma vira seu próprio plano)

- **Fase 2 — Semanal:** relatório semanal na sexta (antecipa se feriado), plano da semana comprometido + **PPC**, causas de não cumprimento, snapshot semanal do avanço (job), curva S e Gantt simples, versão interna do semanal. Conteúdo conforme item 11 da seção 6 do Eduardo.
- **Fase 3 — Página do cliente:** entrada separada do login Manfac (hoje restrito a `@manfac.com.br`) — e-mail cadastrado + código de uso único no e-mail; cliente vê só as obras em que está cadastrado; abas Visão geral, Cronograma, Impedimentos ("Aguardando vocês"), Diários, Relatórios. **Território de autenticação/RLS do AGENTS.md — tratar bordas.** Botão "Ver a obra completa" passa a ir nos e-mails.
- **Fase 4 — Mapa e fotos:** os 3 modos (planta, croqui, ambientes); pontos fixos de foto; ronda de fotos no diário; comparação antes/ontem/hoje; impedimentos e zonas de faseamento sobre o mapa.
- **Fase 5 — Integrações e causa interna:** botões na obra que abrem Compras (`/compras/solicitacoes/nova?obra=<uuid>`, já existe; `cmp_solicitacoes` tem `obra_id` e `prazo_necessario`), Fornecedores (medição, `frn_medicoes` via `frn_contratos.obra_id`) e Financeiro (solicitação de pagamento); leitura de volta dos status para montar a **cadeia de causa** do e-mail interno; relatório mensal (último dia útil), de fase e de entrega.
- **Fase 6 — Gestão interna do Eduardo:** orçamento consolidado (REV + LPU, % medido), conflitos de escopo, compras/locações da obra, medições e faturamento ao cliente, visão multi-obra do CEO, prancha de faseamento.

## 7. Restrições do projeto (do AGENTS.md / rules)
- SQL em arquivo `sdd-sql-obras-*.sql` na raiz, **aplicado à mão pelo José** no SQL Editor; conferir coluna a coluna antes do deploy. Deploy no EasyPanel é clique manual.
- Tabelas novas com RLS via `obras_has_access()` (território de exceção: tratar bordas).
- Server Actions em `_actions.ts`; testes em `__tests__/` ao lado; Tailwind v4 com as cores do tema do hub; sem shadcn.
- `export type` em arquivo `use server` derruba a tela (armadilha registrada).
- Next 16 com breaking changes: ler `node_modules/next/dist/docs/` antes de codar.

## 7.1 Decisões do José após a revisão do builder (29/10)
- **Atraso causado pelo cliente:** a atividade aparece como **AGUARDANDO CLIENTE** (situação própria, no lugar de ATRASADA/INÍCIO ATRASADO), **mas o atraso conta igual**: entra no desvio, empurra as sucessoras e pode mover a data de entrega. O que muda é a **atribuição**: painel e e-mail mostram o desvio e os dias de atraso quebrados por responsável (ex.: "previsão de entrega 17/02 (+5 dias: 4 do cliente, 1 da Manfac)").
- **Cronograma base e versões:** o cronograma do Eduardo (seção 10.1, data-base 26/10/2026, status iniciais como no seed: nº 6 Em andamento, demais Não iniciado) é carregado como rascunho do **cronograma base**; o engenheiro/admin pode editar e **salvar a base**. Depois de salva, a base **nunca é alterada**: cada reprogramação salva vira **v2, v3…** (com data, autor e motivo), como novos cronogramas. O previsto/realizado do dia usa a versão vigente; o painel compara vigente × base (término e desvio). *A forma de guardar as versões (cópia das linhas ou snapshot) fica com o builder.* Sinal vermelho = desvio < -5 p.p. **ou** término da versão vigente > término da base.
- **Página de configuração da obra (só admin do hub):** e-mails dos destinatários do cliente e internos (nome, função, lado, tipos de relatório), engenheiro responsável, data-base. Os admins cadastram; o cliente não se cadastra.
- **Remetente:** o mesmo SMTP/remetente atual (`manfac@manfac…`, variável `SMTP_REMETENTE`).

- **Classificação SPOT/OBRA com transferência pelo sistema (29/10, substitui a chamada da seção 5.1 sobre a aba Base):** a aba Base/visão SPOT passa a mostrar **só SPOTs**; OBRAs só aparecem na aba OBRAS. As obras grandes que já estão no hub (praticamente finalizadas — Telhado CD Profarma, PLK etc.) são transferidas **pelo código**, sem exigir cronograma, diário ou qualquer preenchimento: uma OBRA sem cronograma aparece na aba OBRAS como "sem cronograma" e não cobra diário. Admin reclassifica pela ficha ("Tornar OBRA" / "Voltar para SPOT"), registrado no histórico; a carga inicial vai por lista de OS no SQL. A obra continua em `obras_obra` com a mesma etapa, faturamento e conciliação.

## 7.2 Chamadas minhas após a revisão do builder (José pode vetar)
- **% do diário vai para o cronograma só na validação.** O diário guarda, por atividade, de→para % (e concluída); ao validar, aplica no cronograma. Painel e e-mail usam o validado. Se o engenheiro editar o cronograma no mesmo dia, a validação aplica o "para" do diário e registra no histórico.
- **Dias de impacto:** impedimento marcado "trava a atividade" conta os dias úteis em que ficou aberto; impedimento parcial conta a estimativa digitada (ex.: 0,5).
- **Diário em todo dia útil dentro da janela da obra**, inclusive sem execução: o supervisor marca "Sem execução hoje" + motivo (vira impedimento com responsável) e o diário sai curto. Painel alerta diário faltando no dia útil.
- **Engenheiro responsável = usuário do hub** (login `@manfac.com.br` com acesso `obras`), escolhido por obra. Validar e enviar = esse usuário ou admin, checado no servidor. Na Fase 1 é um botão só ("Validar e enviar"); separar validação de envio (COP) fica para depois se o José quiser.

## 8. Em aberto (não bloqueia o build — vira cadastro na página de configuração)
- Engenheiro responsável de Macaé 3 e os e-mails do analista (diário) e do coordenador (semanal) da DPSP — cadastrados pelos admins.
- Status real das atividades 1–6 — o engenheiro ajusta no cronograma base antes de salvá-lo.

## 9. O que fica para o builder
Nomes de tabelas/colunas (prefixo `obras_`), organização de arquivos, componentes, forma exata de cálculo de dias úteis (seguir a seção 5 do Eduardo), testes, como reaproveitar as peças de foto existentes.
