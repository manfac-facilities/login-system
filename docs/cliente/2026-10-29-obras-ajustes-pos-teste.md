# OBRAS — ajustes pedidos no teste da Fase 1 (José Guilherme, 29-30/10/2026)

Mensagens literais, na ordem. Lista consolidada no fim (mapeamento do Claude, a confirmar com o José).

---

**1. Reprogramação**

> criei a revisão, mas ao editar por exemplo a data de inicio nao me da essa opção, se a ideia é replanejar nao faz sentido concorda? eu tenho que ter a data de cronograma atual replanejada, e ao mesmo tempo ter a "foto" do cronograma base para podermos depois comparar os desvios

Proposta do Claude aceita ("pode ser assim"): na revisão, Início e Fim editáveis (Início digitado fixa a data; Fim recalcula a duração em dias úteis; sem data fixa segue as predecessoras; data antes do fim da predecessora aceita com alerta amarelo); colunas Início base / Fim base / Δ dias por atividade; base v1 continua travada; revisões com motivo.

**2. Visão do cronograma**

> pode ser assim, a visão do cronograma está ruim, o ideal era ter um totalizador da etapa que a gente possa abrir ou fechar e abaixo as atividades aparecendo ou escondidas/fechadas. pensa aqui numa estrutra por exemplo do ms project. falta também uma visão de cronograma de gantt.. vai mapeando tudo que eu falar e depois tiramos as duvidas pra revisões

**3. Atualização do cronograma**

> a forma também de atualização do cronograma está ruim, porque você não se inspira em algum modelo de sistema de gestão de obras legal da internet? pensando no last planner system nessa estrutura de acompanhamento..

**4. Referência**

> sugestões de features https://sienge.com.br/prevision-obras/

**5.**

> use o playwright navegue nessa pagina e capte as ideias e funcionamento

(Vídeos de demonstração da página: dashboard-visao-economica.mp4 — Avanço físico Base/Previsto/Realizado, Curva S, Progresso mensal/semanal, Evolução por pacote de trabalho; ai-prev-video-02.mp4 — "Prevision IA" no WhatsApp respondendo custo orçado × realizado com data da última medição. Os demais vídeos são depoimentos.)

**6.**

> agora navegue no https://obraprima.eng.br/ buscando por funcionalidades e layouts que possamos melhorar também use o playwright e navegue nas funcionalidades etc

(Navegado: home, portal-do-cliente, cronograma-de-obra, diario-de-obra, rdo-para-obras-publicas, aplicativo, gestao-de-tarefas, previsto-x-realizado, medicao-de-obra, bi. Vídeos do YouTube do canal bloquearam por anúncio/erro 153 — não vistos.)

**7. Respostas às 12 perguntas (fechamento da lista)**

> a principio fechou a lista, manda as perguntas se vc tiver

> 1 a 4 ok
> 5a 7 ok
> 8 e 9 ok
> 10 pdf sem assinatura botao de gerar pdf
> 11 ok
> 12 colocar sugestão de IA um botao, mas nao obrigatorio e que vai fazer sempre
>
> Nao precisa fazer mockup, mas quero que vc pense em um layout muito melhor, ta muito pobre use as skills de ui-ux-pro-max e impecable e se inspire em sistemas parecidos com esse escopo no figma, behance e dribble use o playwright se for necessario

---

## Mapa de ajustes (vivo)

| # | Ajuste | Origem | Dúvidas em aberto |
|---|---|---|---|
| A1 | Revisão com Início/Fim editáveis + comparação por atividade com a base (Início/Fim base, Δ dias) | msg 1 | fixar prazo máximo (fim) independente da duração? |
| A2 | Cronograma em estrutura tipo MS Project: linha-resumo por etapa (início, fim, duração, % e peso da etapa) que abre/fecha, atividades indentadas embaixo | msg 2 | totalizador mostra o quê exatamente? abrir/fechar todas de uma vez? |
| A3 | Visão de Gantt (barras por atividade e por etapa, linha de hoje, base × atual) | msg 2 | lado a lado com a tabela (como o Project) ou aba separada? escala dia/semana? |
| A4 | Atualização no ritmo LPS em 3 níveis: plano mestre (base+revisões) · lookahead 3–6 semanas com restrições por atividade (pronta / com restrição) · plano semanal comprometido com PPC e causa do não cumprido; o diário só responde o plano da semana | msg 3 (pesquisa: Procore Lookahead, Outbuild, Prevision/Sienge, LPS) | quem fecha o plano semanal e em que dia? restrições: checklist fixo ou livre? |
| A6 | Restrições em quadro Kanban (a liberar → em tratativa → liberada), ligadas a Compras/suprimentos e ao cliente | msg 4 (Prevision) | colunas do quadro? quem move? |
| A7 | IA: sugere o plano da semana e escreve o resumo de desvios/gargalos com impacto e oportunidade de recuperação (entra no e-mail semanal/interno) | msg 4 (Prevision) | IA escreve e o engenheiro revisa antes de ir ao cliente? |
| A8 | Assistente no WhatsApp (texto/áudio): "como está Macaé?", atrasos, relatório em PDF | msg 4 (Prevision) | para o time interno, cliente ou os dois? |
| A9 | Criar cronograma com IA a partir do escopo/orçamento (atividades, durações, dependências) — o "macrofluxo" | msg 4 (Prevision) | entrada: LPU/orçamento xlsx, laudo, texto livre? |
| A10 | Avanço por pacote/local (ambiente) — liga ao mapa da Fase 4 | msg 4 (Prevision) | — |
| A11 | Físico-financeiro: desembolso previsto pelo avanço, previsto × real × projetado de custo (Fase 6 do Eduardo) | msg 4 (Prevision) | — |
| A12 | Visão de portfólio: todas as obras numa tela (CEO) | msg 4 (Prevision) | — |
| A13 | Painel no padrão Prevision: 3 séries em tudo — **Base** (v1) · **Previsto** (versão vigente) · **Realizado** — em barras de avanço físico, curva S e progresso semanal/mensal (alternável), com "dados até a data da última atualização" | msg 5 (Playwright no vídeo do dashboard) | em % físico (nosso caso) e não R$? |
| A14 | "Evolução por pacote de trabalho": avanço de cada etapa base × previsto × realizado | msg 5 | — |
| A15 | Página do cliente com **Documentos** (pastas: projetos, laudo, ART, layout, termos) e **galeria de fotos por data e por etapa** | msg 6 (Obra Prima: portal do cliente) | quais pastas fixas? cliente pode subir arquivo? |
| A16 | **Mensagens da obra** centralizadas no portal (histórico por obra, substitui o grupo de WhatsApp para decisões/aprovações do cliente) | msg 6 (Obra Prima) | o cliente responde por aqui ou só pelo e-mail? |
| A17 | **RDO formal em PDF** (modelo oficial: cabeçalho, serviços, equipe, equipamentos, clima, ocorrências, fotos, assinaturas do engenheiro e do fiscal/cliente com "ciente") — anexo do e-mail diário e prova contratual | msg 6 (Obra Prima: RDO / RDO obras públicas) | precisa de assinatura do cliente? |
| A18 | **Clima por turno** (manhã/tarde: bom, nublado, chuva, impraticável) no diário, padrão de RDO | msg 6 (Obra Prima) | — |
| A19 | Solicitar material direto do app de campo (vira solicitação no Compras com prazo necessário) | msg 6 (Obra Prima: aplicativo) | já previsto na Fase 5 |
| A5 | Atualização rápida semanal tipo "data de status" do MS Project: para as atividades em andamento, informar % e **dias restantes** (não só %), datas reais automáticas; a projeção recalcula a entrega | msg 3 | % ou dias restantes como principal? |
