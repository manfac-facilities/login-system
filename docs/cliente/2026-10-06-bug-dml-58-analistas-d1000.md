# 06/10/2026 — Bug: obra DML 58 sem nome dos analistas

**Origem:** mensagem do João no chat, 06/10/2026. Texto literal abaixo.

---

na obra dml 58 não aparece o nome dos analista da profarma, corrigir bug do controle de obras, Analistas D1000 
Leticia
Felipe

## Diagnóstico (Claude, 06/10/2026)

O select "Analista do cliente" é fechado: piso fixo `AMANDA, LEANDRO, JUAN` (todos DPSP) unido aos
valores já usados na base. Leticia e Felipe nunca foram usados, logo nunca aparecem. Produção:
as 17 obras D1000 (incluindo DML-58, OS 3134017) e a 1 obra PROFARMA estão com analista vazio.

Opções levadas ao João: (A) incluir os dois no piso global; (B) lista de analistas por cliente.

## Decisão do João (06/10/2026), literal

> 01) opçao b, 02)Sim

(01 = opção B, lista por cliente; 02 = a obra com cliente "PROFARMA" usa os mesmos analistas da D1000.)
