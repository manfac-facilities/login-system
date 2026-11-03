# OBRAS — Leva 6: mapa da obra e fotos por ponto

**Data:** 01/11/2026 · **Fontes:** item 5 da reunião (`docs/cliente/2026-10-31-obras-anotacoes-reuniao-validacao-leva1.md`), decisão 8 da spec da modalidade obra (`2026-10-29-obras-modalidade-obra-design.md`: "mapa em 3 modos, mesmo dado por baixo"), roadmap linha 6. **Mockup aprovado:** https://claude.ai/artifact/F4BbhhDtnASAifshDwfR3g ("mockup da leva 6 ficou otimo, pode seguir" — `docs/cliente/2026-11-01-obras-leva6-aprovacao-mockup.md`).

## 1. Intenção
O supervisor fotografa sempre os mesmos pontos (ronda) ou fotografa pela atividade, e cada foto fica ligada a um lugar da obra. O engenheiro e o cliente veem a obra num mapa colorido pelo avanço, com fotos por ponto e comparação antes × depois.

## 2. Decisões (aprovadas no mockup)
1. **Três modos por obra, mesmo dado:** `planta` (imagem/PDF do layout com ambientes e pontos desenhados por cima), `croqui` (retângulos desenhados no app, sem imagem), `ambientes` (só cartões). Trocar de modo não perde nada.
2. **Ambiente:** nome, área m² opcional, forma (retângulo em coordenadas relativas 0–1 da imagem/quadro; um ambiente = um retângulo nesta leva), ordem. **Ponto de foto:** número sequencial por obra, nome, ambiente, posição relativa 0–1.
3. **Atividade ↔ ambiente:** N:N pelo **número** da atividade (estável entre versões do cronograma). Uma atividade pode estar em vários ambientes.
4. **Avanço do ambiente** = média das atividades ligadas da versão vigente, ponderada pelo mesmo peso do cronograma (valor ou duração, `obras_obra` configuração da Leva 2); sem atividade ligada → sem cor ("—"). Faixas de cor: 0, 1–25, 26–50, 51–75, 76–100%.
5. **Diário (celular):** aba Fotos com dois modos — **Por ponto (ronda)**: lista dos pontos com a última foto do ponto como referência de ângulo; **Por atividade**: escolhe a atividade, aparecem o(s) ambiente(s) dela e seus pontos. Toda foto nova grava ambiente (obrigatório quando a obra tem mapa), ponto e atividade opcionais. "+ Foto avulsa" escolhe o ambiente. Ronda incompleta **não bloqueia** validar; o diário mostra "ronda incompleta (x de y)".
6. **Impedimento no mapa:** impedimento ganha ambiente opcional; o ▲ aparece no ambiente enquanto aberto.
7. **Antes × depois:** por ponto, comparação arrastável entre duas fotos (padrões: primeira foto × última; ontem × hoje; escolher datas) e linha do tempo do ponto.
8. **Portal do cliente:** aba Mapa com o mesmo mapa e avanço; só fotos de diário validado/enviado; impedimento só se `exibir_ao_cliente`; nenhum dado interno.
9. **Quem monta o mapa:** engenheiro da obra ou admin. Envio da planta: imagem (JPG/PNG/WebP) ou PDF (usa a 1ª página convertida no navegador para imagem). No celular o mapa vira a lista de ambientes.
10. **Fora (Leva 6b):** planta de faseamento (prancha A3 com zonas, legenda, regras, carimbo, PDF); polígonos livres; zonas de faseamento.

## 3. Dados (`sdd-sql-obras-leva6.sql`)
- `obras_mapa` (obra_id pk, modo `planta|croqui|ambientes`, planta_path null, planta_largura/altura px null, autoria).
- `obras_ambiente` (id, obra_id, nome, area_m2 null, x, y, w, h numéricos 0–1 null no modo ambientes, ordem, autoria).
- `obras_ponto_foto` (id, obra_id, numero sequencial por obra atribuído no banco, nome, ambiente_id, x, y 0–1 null, ativo, autoria).
- `obras_ambiente_atividade` (ambiente_id, atividade_numero, pk composta).
- `obras_rdo_foto` + colunas `ambiente_id`, `ponto_id`, `atividade_numero` (nulos para fotos antigas); foto congelada após validação continua imutável (inclusive esses vínculos).
- `obras_impedimento.ambiente_id` null.
- Storage: planta em caminho canônico `<obra>/mapa/<uuid>.<ext>` no bucket `obras-fotos`, mesma política dos outros caminhos.
- Guardas: só engenheiro/admin escrevem mapa/ambientes/pontos/vínculos; ponto e ambiente de outra obra recusados nas fotos e no impedimento; coordenadas entre 0 e 1; excluir ambiente com fotos → recusado (desativar ponto em vez de apagar).

## 4. Telas
- Sidebar: item **Mapa** (`app/obras/obras/[id]/mapa/`), com **Montar o mapa** (`mapa/montar/`) para engenheiro/admin.
- Diário: aba Fotos ganha os modos Por ponto / Por atividade (`[id]/diario/_fotos.tsx`).
- Ponto: linha do tempo + antes × depois (`mapa/ponto/[pontoId]/`).
- Portal: `app/portal-obra/(obra)/obras/[obraId]/mapa/`.
- Mapa desenhado em SVG (escala relativa sobre a imagem), sem biblioteca nova pesada; PDF→imagem no navegador com `pdfjs-dist` só se já existir dependência equivalente — senão aceitar só imagem nesta leva e registrar em DIVIDAS (*chamada minha*).

## 5. Restrições
AGENTS.md; tema claro Manfac; toque ≥ 44px; sem emoji; cliente nunca vê interno; SQL só em arquivo (José aplica); fotos via caminho canônico; nada de R$.
