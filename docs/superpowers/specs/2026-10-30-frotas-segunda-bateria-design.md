# Frotas — segunda bateria: visão geral, bases com exportar, e-mail diário — design

**Data:** 30/10/2026. **Mockup aprovado:** https://claude.ai/artifact/7W9i2oHr7V1nKV6HoD8tv1
(arquivo `docs/frotas/mockups/2026-10-30-mockup-segunda-bateria.html`, commit `1c760db`).
**Aprovação:** João, 30/10/2026 madrugada, no chat: "tudo aprovado, prossiga" (todas as seções 1, 2, 3, 4).

**Fonte do pedido:** `docs/cliente/2026-10-20-reuniao-frotas-igor-jose-transcricao.md` — [05:09] visão geral,
[19:19] base em tabela "igual gestão de obras" + exportar, [23:01]–[23:07] disponibilidade, [23:58] e-mail ao Igor,
[26:28] histórico equipe×carro×motorista. Cobrança de prazo: `docs/cliente/2026-10-27-frotas-cobranca-prazo-jose.md`.

O mockup é a fonte da verdade de telas, textos, estados e colunas. Esta spec registra só o que o mockup não decide.

## Escopo

1. **Visão geral nova** — substitui `app/(operacoes)/sofia/page.tsx` (seções 1.1 a 1.4 do mockup).
2. **Bases em tabela com "Exportar Excel"** — Abastecimentos, KM diário, Motoristas, Veículos (2.1–2.4), padrão de
   `app/obras/base/` (exceljs já é dependência). Exporta tudo o que está filtrado, `.xlsx`,
   nome `frotas-<base>-AAAA-MM-DD.xlsx`. Ficha do veículo em gaveta com histórico carro×equipe×motorista.
3. **E-mail diário de alertas** (seção 3) — 07:00 BRT, segunda a sexta, para os gestores de frotas
   (`sofia_gestores`), pelo mesmo caminho do e-mail diário de Obras (`app/api/obras/relatorio-diario/route.ts`,
   SMTP Locaweb, `pg_cron` chamando rota protegida por segredo).

**Fora desta rodada:** 2.5 (Revisões/Multas/Sinistros/Documentos em formato de base), revisão automática 10 mil km,
manutenção corretiva, fotos/aba de avaria, comparação de checklist, processo de multa refeito.

## Decisões em aberto do mockup — resolvidas pela recomendação (João aprovou o mockup inteiro)

| # | Decisão | Adotado |
|---|---|---|
| 1 | Usuário comum registra? | **Mantém o comportamento atual do código**: registrar (abastecimento, KM, motorista, veículo, multa, sinistro, revisão) continua aberto a quem tem Sofia; corrigir/excluir só gestor/admin. Nenhuma guarda nova |
| 2 | "Em revisão" × "no mecânico" | **Sem dado novo nesta rodada**: um estado só, "Na oficina" (`veiculos.status = 'manutencao'`). Separar fica para a rodada de manutenção corretiva (exige schema) |
| 3 | Regra de disponibilidade | **Disponível = ativo fora da oficina ÷ (todos menos inativos)**. Inativos ficam fora da conta. Vale para a visão geral (a tela Disponibilidade antiga não muda nesta rodada) |
| 4 | Combustível duas vezes | **Custo do mês usa o lançado no hub** (como a tela Custos); extrato aparece separado por centro de custo, sem somar |
| 5 | Dia sem pendências | **Manda o e-mail curto "nada pendente"**; se a montagem falhar, manda aviso de falha |
| 6 | Cobrança de KM diário | Toda equipe ativa com carro, em dia útil (seg–sex); fim de semana não cobra |
| 7 | CNH vencida | Passa a aparecer (vencida + vencendo em 30 dias) no alerta e na visão geral |
| 8 | Equipe/motorista do abastecimento | Resolvidos pelo histórico de responsabilidade na data do abastecimento |
| 9 | Correções F1–F3 / extratos | Já aplicados em produção (28 e 29/10); chip "corrigido" e bloco de extratos entram |
| 10 | Gestor × admin no Frotas | Iguais dentro do Frotas (decisão D2 de 26/10) |
| 11 | Destinatários e horário | Só `sofia_gestores` (hoje o Igor), 07:00 BRT seg–sex, sem administradores do hub, sem tela de configuração |

## Restrições

- Fase "menor mudança" do AGENTS.md. Nada de schema novo, exceto o job do `pg_cron` do e-mail (SQL novo, aplicado só
  com autorização escrita do João).
- Leitura respeita RLS do usuário logado (nada de service role nas telas). O e-mail usa a mesma abordagem da rota de
  Obras (service role só no servidor, rota protegida por segredo em env, nunca versionado).
- Exportar: só leitura; nenhuma escrita nova.
- Tema do hub; telas usáveis a 375px.
