# Almoxarifado: SQL 001 aplicado em produção (11/11/2026, noite)

- Arquivo `001_alx_acesso_papeis_config.sql` do repositório `manfac-facilities/almox`, commit
  `3dd6306`, aplicado no banco `iyytcavcgukfjnjjrerx` numa transação, com a autorização de
  `2026-11-11-almoxarifado-autorizacao-consulta-e-sql-001.md`.
- Conferido depois, por consulta só de leitura: 3 tabelas `alx_*` com RLS, `anon` sem nenhum
  privilégio, `authenticated` só com o mínimo, ninguém trunca, funções de gatilho sem execute
  para ninguém, tabelas vazias, Cockpit sincronizando com sucesso.
- Detalhe em `docs/validacoes.md` do repositório do almox (commit `fad32af`).
- Não houve deploy: o app ainda não existe no EasyPanel (decisão de onde roda adiada pelo João).
