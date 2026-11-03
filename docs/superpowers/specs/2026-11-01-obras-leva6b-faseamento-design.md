# OBRAS — Leva 6b: planta de faseamento

**Data:** 01/11/2026 · **Fontes:** `docs/cliente/2026-10-29-sgo-especificacao-eduardo.md` §2.2 e §8 (conteúdo da prancha da Fase 1); respostas do José em `docs/cliente/2026-11-01-obras-leva6b-faseamento-respostas.md`. **Mockup aprovado:** https://claude.ai/artifact/BrpPaGa3saBmavP5drqDvv. **Depende da Leva 6** (mapa: `obras_mapa.planta_path`).

## 1. Intenção
Cada fase da obra (Fase 1 — demolição e reforço, Fase 2 …) tem uma prancha A3 paisagem: o layout da loja como base, camadas desenhadas por cima (zonas, drywall, balcão, portas, fluxos, segurança), regras impressas e carimbo. O engenheiro monta no hub, emite uma revisão (R0, R1 …), o PDF sai do sistema, o cliente vê no portal e o envio fica registrado em Comunicação.

## 2. Decisões
1. **Quem edita/emite/envia:** engenheiro da obra, admin **e coordenador** (José). *Chamada minha:* coordenador = `obras_obra.coordenador_email` (por obra, como `engenheiro_email`), gravado só por admin em **Dados da obra**. Não mexe em `hub_user_roles`.
2. **Cliente vê no portal:** aba Mapa do portal ganha a seção "Faseamento" com a **última revisão emitida** de cada fase (prévia + abrir PDF). Rascunho nunca aparece.
3. **Sem aceite do cliente.** Basta registrar o envio em Comunicação: novo tipo de envio `faseamento` ligado à revisão (mesma obra, revisão emitida). *Chamada minha:* destinatários = os mesmos do relatório de fase (tipo `fase`).
4. **Fase:** nome, número por obra (atribuído no banco), ordem. **Revisão:** número 0,1,2… por fase; `rascunho` (editável) → `emitida` (congelada: camadas, regras, carimbo e o status da trava). Só uma revisão em rascunho por fase; "Nova revisão" copia a última emitida.
5. **Camadas** (jsonb na revisão, coordenadas relativas 0–1 à planta; ≤ 300 camadas): zonas (`zona_obra`, `zona_salao`, `zona_atend`, `zona_uso`, `restrita`; retângulo + rótulo), linhas (`drywall`, `balcao`; polilinha), portas (`porta_obra`, `porta_exist`; ponto), fluxos (`fluxo_cli`, `fluxo_obra`; polilinha com seta), ícones (`extintor`, `emerg`; ponto). Legenda automática = tipos usados.
6. **Regras impressas:** lista de textos (≤ 12, cada um com até 200 caracteres; decisão do coordenador para a prancha caber em 1 página A3). **Regra de trava** opcional: liga a prancha à `obras_obra.atividade_trava` (já existe); na emissão grava o status dessa atividade e das bloqueadas e a prancha imprime "Status na geração (data): …".
7. **Carimbo:** título, cliente, obra (automático), desenho, base (texto, padrão "Layout aprovado do térreo · sem escala"), responsável técnico (nome/CREA), data (da emissão), revisão.
8. **Base:** a planta do mapa (Leva 6). Obra sem planta → prancha em quadro branco (só camadas), com aviso.
9. **PDF:** `@react-pdf/renderer` (já usado nos relatórios), A3 paisagem, gerado sob demanda a partir da revisão congelada (sem arquivo no storage). Planta embutida via URL assinada curta lida no servidor.
10. **Celular:** editor só em tela ≥ 768 px; no celular a fase mostra a prévia e o PDF.
11. **Fora:** polígonos livres, cotas, camadas por foto, aceite do cliente.

## 3. Dados (`sdd-sql-obras-leva6b.sql`, seção 0 exige leva6)
- `obras_obra.coordenador_email text null` — entra na guarda de "só admin" dos parâmetros da obra.
- Função `obras_pode_fasear(p_obra uuid)` (definer, revogada de public/anon/authenticated): `obras_engenheiro_ou_admin(p_obra)` ou e-mail do JWT = `coordenador_email` (comparação lower/trim, NULL nunca passa).
- `obras_fase` (id, obra_id, numero, nome, ordem, autoria). RLS leitura = acesso `obras`; escrita = `obras_pode_fasear`.
- `obras_fase_revisao` (id, fase_id, obra_id coerente com a fase, revisao, status `rascunho|emitida`, camadas jsonb, regras text[], carimbo jsonb, usa_trava bool, trava_snapshot jsonb null, emitida_em/por, autoria). Guardas: emitida é imutável e não volta; uma só rascunho por fase; revisão = max+1; jsonb validado (tipo array, ≤ 300).
- `obras_envio`: tipo `faseamento` + `fase_revisao_id` (mesma obra, revisão emitida) — mesmo padrão de `relatorio_id`.
- Portal: leitura das revisões emitidas pelo caminho que o portal já usa (cliente admin no servidor, filtrado pela sessão do portal).

## 4. Telas
- Sidebar da obra: **Faseamento** sob Mapa (`app/obras/obras/[id]/faseamento/`): lista de fases, editor de camadas (como no mockup), aba Prancha A3 (prévia + campos de carimbo e regras), Emitir revisão, Nova revisão, Gerar PDF, Enviar (vai para Comunicação).
- PDF: rota `faseamento/[revisaoId]/pdf`.
- Dados da obra: campo "Coordenador (e-mail)" para admin.
- Comunicação: o envio `faseamento` aparece na linha do tempo com link do PDF.
- Portal: seção Faseamento na aba Mapa + rota de PDF do portal.

## 5. Restrições
AGENTS.md; tema claro Manfac (`.obra-tema`), toque ≥ 44px, sem emoji; SQL só em arquivo (José aplica); nada de R$; cliente nunca vê rascunho nem dado interno.
