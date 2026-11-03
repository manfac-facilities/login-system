# Descoberta: integração "Compras da obra" (app Compras)

Somente leitura. Fontes: repo `C:\Users\jguil\claude\compras` (CLAUDE.md, `docs/superpowers/specs/2026-10-05-compras-design.md`, `supabase/hub-install/001..015_*.sql`, `lib/obras/leitura.ts`, `app/(modulo)/solicitacoes/nova/page.tsx`) e consultas SELECT no banco iyytcavcgukfjnjjrerx (31/10/2026). Literais do cliente: anotações leva1 item 14 (custos da obra: compras, financeiro, medições; orçado x realizado; margem; CC "DPSP – OBRAS" com várias obras) e SGO do Eduardo (entidade Compra: dataPedido, fornecedor, descricao, itemOrcamentoId, quantidade, valorTotal, previsaoEntrega, entregaReal, status Cotação|Pedido emitido|Entregue|Cancelado, nf; Locacao: equipamento, fornecedor, quantidade, inicio, fimPrevisto, devolucaoReal, valorDiarioUnitario, itemOrcamentoId; custoReal = Σ compras não canceladas + Σ custoAcumulado das locações; locação VENCIDA quando passa do fim previsto).

## Achado principal
O Compras já foi desenhado para isso: `cmp_solicitacoes` tem `obra_id` (uuid, sem FK) + foto `obra_os/obra_loja/obra_descricao`; a tela `/compras/solicitacoes/nova?obra=<id>` já abre com a obra preenchida (comentário no código: "o botão futuro na ficha da obra"); e o Compras lê `obras_obra` só por service role (`lib/obras/leitura.ts`, colunas id, os, loja, descricao, com cancelado_em nulo). Hoje 27 das 57 solicitações já têm obra_id. Falta o lado do hub (botão + listagem) e o vínculo com atividade/restrição.

## 1) Modelo de dados (tabelas cmp_*)
- `cmp_solicitacoes` (57): id, ambiente, numero, etapa, tipo (material|servico|locacao|ferramental), solicitante_email/nome, cc_codigo/cc_descricao (um CC só, sem rateio), obra_id/obra_os/obra_loja/obra_descricao (constraint: ambos nulos ou ambos preenchidos), prazo_necessario, recebimento (base|obra|retirada), endereco_entrega, valor_estimado_centavos, urgente/urgencia_*, enviado_em, comprador_email, total_mapa_centavos, pedido_omie_numero, pedido_registrado_em, sla_desde, entregue_em, concluida_em, modelo_id. Índice parcial `cmp_solicitacoes_obra_idx`.
- `cmp_solicitacao_itens` (315): solicitacao_id, ordem, produto_codigo_omie, descricao, unidade, quantidade, observacao, qtd_estoque/qtd_comprar. Sem preço nem vínculo com obra/atividade.
- Cotação = "mapa": `cmp_mapas` (solicitacao_id, rodada, situacao rascunho|enviado|devolvido|aprovado, total_centavos), `cmp_mapa_fornecedores` (fornecedor_codigo_omie, razao_social, frete, prazo_entrega_dias, pagamento, validade), `cmp_mapa_precos` (item_id, preco_inicial/final_centavos), `cmp_mapa_escolhas` (item -> fornecedor vencedor).
- Pedido: `cmp_pedidos` (36; 1 por fornecedor escolhido; sequencia, mapa_fornecedor_id, total_centavos, omie_codigo_pedido, omie_numero, situacao na_fila|gravando|emitido|falha, previsao_entrega, entrega_situacao pendente|confirmada|divergencia|resolvida, entrega_em, divergencia_*, pago_em, nf_numero, nf_em, concluido_em). Pedido não tem itens próprios: itens vêm de `cmp_mapa_escolhas`.
- Fornecedores: `cmp_catalogo_fornecedores` (espelho do Omie, 1276 linhas). Catálogos: produtos (1267), departamentos (= CC, 11), categorias, parcelas, locais de estoque.
- Auditoria: `cmp_eventos` (linha do tempo imutável, inclui `previsao_atualizada` com de/para), `cmp_anexos`, `cmp_avisos`.
- Recorrente: `cmp_modelos`/`cmp_modelo_itens` (também com obra_id).
- Não existe tabela de locação/devolução; locação é só `tipo='locacao'` (2 solicitações).
- Referências: CC por `cc_codigo` Omie (ex. 10159908939 "DPSP - OBRAS", 15 solicitações; Macaé é uma obra dentro desse CC). Não há project do Omie; OS só como foto `obra_os`.

## 2) Status e datas
- Etapas da solicitação (valores vistos no banco): decisao_estoque, aguardando_cotacao, em_cotacao, pronta_para_pedido, pedido_emitido, concluida, atendida_estoque, cancelada (contagem: pedido_emitido 16, cancelada 23, concluida 10, aguardando_cotacao 5, pronta_para_pedido 4, atendida_estoque 1). Lista completa nas constraints de 008/010.
- Datas: solicitada = `enviado_em`/`criado_em`; necessária = `prazo_necessario`; cotação = `cmp_mapas.enviado_em`; pedido = `pedido_registrado_em`/`cmp_pedidos.criado_em`; prometida = `cmp_pedidos.previsao_entrega` (editável só por papel compras via `cmp_atualizar_previsao`, que grava evento com de/para; preenchida em 37 pedidos); entregue = `cmp_pedidos.entrega_em` (confirmada por quem pediu, ou almox se Base) e `cmp_solicitacoes.entregue_em`; paga = `pago_em`; NF = `nf_numero/nf_em`.
- Atenção: previsao_entrega é do pedido inteiro (fornecedor), não por item; sem previsão informada vira "hoje" na emissão (012, linha ~345), então não distingue "sem promessa" de "promessa hoje".

## 3) Papéis e RLS
- Papéis em `cmp_papeis`: compras, almoxarifado, gestor (por cc_codigo), diretor; admin do hub via `compras_is_admin()`. Qualquer pessoa logada no hub é solicitante e cria solicitação própria (`cmp_criar_solicitacao`, chamada no servidor).
- RLS `cmp_solicitacoes_select`: dono OR admin OR compras OR diretor OR gestor do CC OR almox (recebimento base / requisição de estoque). `cmp_pedidos` e `cmp_solicitacao_itens` herdam por EXISTS em solicitações. Escritas só por funções security definer (execute revogado de authenticated).
- `obras_obra` é lido pelo Compras com service role no servidor (decisão P2-8). Inverso: o hub lendo cmp_* precisa de função própria ou service role, pois a RLS do Compras é mais restrita que a do módulo Obras.

## 4) Ganchos existentes
- Hub/Obras: deep link `?obra=<id>` pronto; foto da obra na solicitação; busca de obra no formulário (`buscarObrasAction`). Regra do Compras: nunca escrever em obras_*, fin_*, hub_*.
- Financeiro: só reaproveitamento de padrões (porteiro, fornecedor Omie); sem ligação de dados. Pedido nasce direto no Omie (`omie_codigo_pedido`, `omie_numero`, CC como departamento); `pago_em/nf_*` marcados manualmente (`cmp_marcar_pago`, `cmp_marcar_nf`).
- Orçamento/PEF: nenhum gancho.

## 5) O que falta
1. Vínculo com atividade (`numero` do cronograma) e/ou restrição (id): não existe coluna. Nível certo é o item (`cmp_solicitacao_itens`); pedido é por fornecedor.
2. Previsão por item/entrega parcial e data "prometida inicial" vs "reprogramada" (histórico só em `cmp_eventos`).
3. Item de orçamento (`itemOrcamentoId` do SGO) na solicitação, para orçado x realizado.
4. Preço por item no pedido (existe em `cmp_mapa_precos` + `cmp_mapa_escolhas`, não consolidado; total do pedido em `total_centavos`).
5. Locações: sem início/fim previsto/devolução/diária nem alerta de vencimento.
6. Botão e listagem no hub (lado login-system), com leitura para quem vê a obra mas não é solicitante nem papel do Compras.
7. `obra_id` é opcional: nada obriga compra do CC "DPSP - OBRAS" a ter obra (15 solicitações no CC; conferir furos).

## 6) Proposta mínima e de baixo risco
- Fase A (zero migração, só hub): botão "Pedir material/cotação" na ficha da obra abrindo `https://hub.manfac.com.br/compras/solicitacoes/nova?obra=<id>` (já suportado). Opcional, pequena mudança no Compras: aceitar `&tipo=` e `&cc=` para pré-preencher.
- Fase B (leitura): função `public.compras_da_obra(p_obra_id uuid)` SECURITY DEFINER com `set row_security = off`, execute só para service role, devolvendo numero, tipo, etapa, prazo_necessario e por pedido (sequencia, fornecedor, total_centavos, previsao_entrega, entrega_situacao, entrega_em, pago_em, nf_numero). O hub chama no servidor após checar acesso à obra. SQL novo `016_*` em `supabase/hub-install` do Compras (aplicado à mão). Aba "Compras" somente leitura, com link para a solicitação.
- Fase C (vínculo): preferir tabela no lado Obras (ex. `obras_compra_vinculo`: solicitacao_id, item_id, atividade_numero, restricao_id), preenchida na tela da obra, para respeitar "Compras não escreve em obras_*" e não tocar o Compras. Alternativa: colunas nulas `atividade_numero`/`restricao_id` em `cmp_solicitacao_itens`, preenchidas no formulário quando há obra.
- Entrega alimentando a restrição: Material no Lookahead mostra previsto = `previsao_entrega` do pedido ligado e entregue = `entrega_em` quando `entrega_situacao in ('confirmada','resolvida')`; por leitura, sem copiar (data manual do Lookahead só como fallback). Não resolver a restrição sozinho: sugerir "pronta para resolver" e a pessoa confirma (divergência pode manter aberta).
- Orçado x realizado: realizado de compras = Σ `cmp_pedidos.total_centavos` com `situacao='emitido'` das solicitações da obra (fora canceladas e falhas); orçado vem do PEF. Por item de orçamento só depois da Fase C.
- Locações: criar `obras_locacao` no módulo Obras (início, fim previsto, devolução, diária; alerta de vencimento como no SGO), com `solicitacao_id` opcional. Não criar no Compras.

Risco de migração: baixo se tudo aditivo (função nova, tabela de vínculo no Obras, colunas nulas). Atenção: banco compartilhado (regra 0 do CLAUDE.md do Compras; `tests/hub-install-safety.test.ts` trava); 27 solicitações já com obra_id (sem backfill); previsão default "hoje" gera falso atraso; RLS do Compras mais restrita (resolver pela função definer com checagem de acesso à obra); valores em centavos aqui, reais no SGO.

## Perguntas abertas para o José
1. Vínculo por item (porcelanato) ou por solicitação inteira? Uma compra pode atender várias atividades/restrições?
2. Quem vê a obra pode ver valores e fornecedores, ou só gestão/financeiro?
3. Compra do CC "DPSP - OBRAS" sem obra deve ser bloqueada?
4. Obrigar o compras a informar prazo real na emissão (hoje padrão = hoje)? Entrega parcial é comum?
5. Custo da obra = pedido emitido, NF ou pago? Frete e impostos entram? Caixinha e compras fora do Compras entram como?
6. Locação: basta o pedido no Compras ou precisa de início/fim/diária/devolução na obra? Quem recebe o alerta e com quantos dias de antecedência?
7. Restrição Material fecha sozinha ao confirmar entrega ou só sugere?
8. Aditivo/OS filha: compras da OS-mãe e das filhas somam na mesma obra para a margem?
9. Qual item do orçamento/PEF recebe o custo (precisa ser informado na solicitação)?
