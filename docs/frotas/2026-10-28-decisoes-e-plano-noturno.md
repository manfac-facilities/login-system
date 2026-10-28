# Decisões de 27/10 (noite) e plano da madrugada de 28/10/2026

João, antes de dormir: "Todas essas sugestões que você deu, você pode prosseguir com elas."

## Etapa 1 (rodada 2, branch `frotas/rodada2-integracao`) — respostas ao pacote de 26/10
1. KM excedido depois de correção: **aceito como regra** — correção não altera o desconto; quem decide é quem olha Descontos.
2. Auditoria: **sim**, `revoke update, delete on public.audit_log from authenticated`.
3. Revisão atrasada só por KM: **sim**, conta em "Urgência Alta".
4. **Autorizado aplicar os SQLs do Frotas em produção de madrugada**, com a condição dada por mim: só se o código
   hoje no ar (master) continuar funcionando com o banco novo. Se não der para garantir, fica para logo antes do
   Deploy da manhã.

## Etapas 2 e 3 — decisões E1–E4
Em `docs/superpowers/specs/2026-10-28-frotas-extratos-cadastros-design.md`.

## Plano da madrugada
- A. Compatibilidade "master no ar + SQL da rodada 2" (agente revisor, só leitura) → se OK, aplico os SQLs na ordem do
  pacote e confiro as verificações.
- B. Decisão 3 implementada na integração da rodada 2 + revisão independente.
- C. Mockup das Etapas 2/3 (agente) → eu reviso e publico. Telas esperam aprovação do João.
- D. Backend das Etapas 2/3 (SQL não aplicado, leitura dos arquivos com testes, views) → revisão independente.
- Merge da rodada 2 no master só depois do SQL aplicado (deploy com código novo sem SQL quebra o Frotas).

## Estado (atualizar a cada passo — é daqui que se retoma se a sessão cair)
- [x] A (compatível nos 4 passos; build do master ok)  - [ ] SQL aplicado — BARRADO pela trava de permissão às ~20h; fica para a manhã, logo antes do Deploy. Arquivos prontos no scratchpad r2/, ordem: peças → gestor (+teste) → correções (+teste) → revoke audit_log  - [x] B (merge 4a0670c na integração, 451/451 testes, pushado)  - [x] C (publicado https://claude.ai/artifact/5HaVsqgsUPZbe13KDzXvkx)  - [x] D (feat/frotas-extratos-backend, review sem bloqueante, pushado)  - [ ] merge (integração já com master junto, 84fef2c, 548 testes + build ok)  - [ ] deploy (João)


Resumo para a manhã: docs/frotas/2026-10-28-resumo-da-manha.md
