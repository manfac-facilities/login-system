# Almoxarifado — João autoriza o SQL 008 (19/11/2026, noite)

Mensagem do João no chat, literal:

> aplica o qsl 008

Arquivo: `supabase/hub-install/008_alx_avisos.sql` (repositório almox, fase-1). Cria a tabela
`alx_avisos` (RLS: cada usuário lê só os próprios avisos), gatilhos de guarda e as funções
`alx_avisos_*`. Não agenda job nenhum e não liga e-mail: `ENVIO_DE_EMAIL_LIGADO = false` no
código, então todo aviso fica `simulado` até a decisão de ligar o envio (remetente, destinatários,
textos, SMTP — `docs/validacoes.md` do almox, "Antes de ligar o envio de e-mail dos avisos").
