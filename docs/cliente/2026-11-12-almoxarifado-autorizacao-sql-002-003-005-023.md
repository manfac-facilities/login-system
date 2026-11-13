# Almoxarifado: autorização dos SQL 002, 003, 005 e 023 e decisão do EasyPanel (12/11/2026)

Mensagens do João no chat, literal:

> roda o sql 2,3,5 e 23

> no easypanel vou criar um app só para almoxarifado

Arquivos: `supabase/hub-install/002_alx_estrutura.sql`, `003_alx_copia_omie.sql`,
`005_alx_minimos.sql` e `023_alx_fecho_service_role.sql` do repositório `manfac-facilities/almox`,
branch `fase-1`, commit `e92da82`. Banco `iyytcavcgukfjnjjrerx`.

## Aplicação (12/11/2026)

Antes, só leitura: existiam só as 3 tabelas do 001 e nenhum papel com `contrato_id`, então a chave
estrangeira do 002 não tinha como falhar. Os quatro arquivos foram aplicados em ordem, cada um numa
transação, e nenhum deu erro.

Conferido depois, só leitura: são 12 tabelas `alx_*`, todas com RLS e policies, todas vazias.
`anon` não tem nenhum privilégio, ninguém pode truncar, e `service_role` ficou sem TRIGGER e sem
REFERENCES em todas (a consulta do 023 volta 0). As funções `alx_copia_*` só executam pela chave de
serviço; gatilhos e funções de evento não executam para ninguém. O `authenticated` só grava em
contratos, equipes, estoques, mínimos, papéis e configurações, e passa pelas policies.

Não houve deploy. O app próprio do almox no EasyPanel ainda não existe.
