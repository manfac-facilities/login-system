# Pacote de aprovação — Gestão de Frotas, rodada 2 — 26/10/2026

Tudo abaixo está pronto, revisado por agente independente e integrado no branch `frotas/rodada2-integracao`
(453 testes do Frotas/admin/auth passando, `tsc` limpo, `npm run build` ok). **Nada foi aplicado em produção e
nada está em `master`**: o código novo depende de SQL aplicado antes do deploy.

## O que entra no ar

| Frente | O que muda na tela | Revisão |
|---|---|---|
| B5 | Revisão atrasada também por KM; "vence em breve" a 1.000 km na lista e no painel | aprovada |
| B6 | Detalhe da revisão (clicar na linha) + campo "Peças trocadas" | aprovada |
| Botões | Ações que falhavam em silêncio ficam escondidas de quem não pode | aprovada |
| D2 | Papel **gestor de frotas**: Igor faz tudo no Frotas e nada fora dele | spec + código aprovados |
| F1 | Editar equipe (código e motorista); trocar carro continua pelo checklist | spec + código aprovados (1 bloqueador corrigido) |
| F2/F3 | Corrigir KM diário (recalcula o KM do carro) e abastecimento, com histórico na Auditoria | idem |

## Decisões que só o João toma

1. **KM excedido depois de uma correção (dinheiro).** Hoje a correção avisa "Este mês tem registro de KM excedido
   para o {placa}. A correção não altera esse registro — confira em Descontos." e **não altera** o desconto.
   **Recomendação: aceitar esse comportamento como a regra** (nada apaga desconto sozinho; quem decide é quem
   olha Descontos). Sem essa resposta o revisor bloqueou o deploy de F1-F3.
2. **Proteger o histórico de auditoria contra alteração.** Hoje qualquer usuário do Frotas consegue alterar ou
   apagar linhas da Auditoria pelo navegador (antigo, não criado nesta rodada). **Recomendação: sim**, aplicar
   `revoke update, delete on public.audit_log from authenticated` — uma linha, o app só grava e lê.
3. **Revisão atrasada só por KM conta em "Urgência Alta" nas Pendências?** Hoje não conta (fica vermelha na lista,
   mas fora do indicador). Recomendação: incluir, mudança pequena — só se você quiser.

Aviso (não precisa decidir agora): ao lançar multa/sinistro, o sistema sugere o motorista que está com o carro
**hoje**, não o da data da infração. Já era assim; com a edição de equipe as trocas ficam mais frequentes. O campo é
editável. Registrado em `docs/DIVIDAS.md` (B7).

## Autorizações de produção, na ordem (a trava do auto mode barrou o Claude em todas)

0. **Leituras** (só consulta): corpos das funções do Frotas iguais aos arquivos; os triggers `trg_bloquear_*`;
   policies SELECT de `hub_system_access`/`hub_user_roles`; motoristas duplicados na mesma equipe; KM fora de
   ordem; e-mail do Igor em `auth.users`.
1. `sdd-sql-revisoes-pecas-trocadas.sql` → verificação 4/4 OK.
2. `sdd-sql-sofia-gestor-frotas.sql` → 18/18 OK; depois `sdd-sql-sofia-gestor-frotas-teste.sql` → 37/37 OK, 0 fixtures.
3. `sdd-sql-sofia-correcoes-f1-f3.sql` → 12/12 OK; depois `-teste.sql` → 35/35 OK, 0 fixtures.
4. (se decisão 2 = sim) revoke no `audit_log`.
5. Merge `frotas/rodada2-integracao` → `master`, push, **João clica Deploy**; Claude confere `Last-Modified` dos
   chunks e faz fumaça como admin (botões nas 5 telas).
6. Conceder o papel ao Igor (insert em `sofia_gestores`); fumaça com ele; `/admin/acessos` deve redirecionar.

**Por que essa ordem:** deploy antes do passo 1 quebra o registro de revisão para todo mundo; deploy antes do
passo 2 tira as ações do Frotas até dos administradores.

Como liberar: autorizar o Claude a rodar os passos 0–4 e 6 pelo PAT (regra de permissão para o Bash), ou rodar
você mesmo no SQL Editor os arquivos na ordem.
