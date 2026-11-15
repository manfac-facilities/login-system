# Almoxarifado: autorização dos SQL dos grupos 3 e 4 (15/11/2026)

Mensagem do João no chat, literal:

> pode aplicar os grupos 3 e 4

Arquivos: **013 → 014 → 015 → 016** (grupo 3) e **020 → 021** (grupo 4) do repositório
`manfac-facilities/almox`, branch `fase-1`, commit `fbf2662`, no banco `iyytcavcgukfjnjjrerx`.

## Aplicação (15/11/2026)

Antes, só leitura: cada arquivo roda numa transação e só cria ou grava objetos `public.alx_*`; o
único dado inicial é o das 2 pendências do projeto do 021 (aviso na tela inicial). Aplicados em
ordem, nenhum erro.

Conferido depois, só leitura: 42 tabelas `alx_*`, todas com RLS; nenhuma tabela sem policy dá
acesso a `authenticated`; `anon` sem acesso a tabela nem a função; ninguém trunca; `service_role`
sem TRIGGER/REFERENCES; 140 funções, as security definer com `search_path` fixo; nenhum job
agendado; os 857 saldos intactos; Cockpit sincronizando com sucesso depois.

Ainda não aplicados: 004 (agendador, espera os segredos do cofre) e 008 (avisos, espera aprovação
dos textos).
