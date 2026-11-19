# Almoxarifado — João autoriza o SQL 025 (19/11/2026, noite)

Mensagens do João no chat, literais:

> pode aplicar o 025

> na tem pausa nenhuma, se pausei foi para continuar depois e aqui estou eu

> o uqe falta fazer?

Arquivo: `supabase/hub-install/025_alx_agendador_fila_omie.sql` (repositório almox, fase-1) — agenda
o job `almox-producao-omie` (a cada 5 min, minutos 4-59/5) que roda a fila de gravação no Omie.
Pré-requisitos do próprio arquivo: gravação ligada no ar (feito, `67315b9`) e os segredos
`almox_producao_cron_secret` e `almox_producao_omie_url` no cofre.

A segunda mensagem responde à pergunta pendente: não há pausa; cópia automática e gravação no Omie
seguem ligadas.

## Aplicação (19/11, ~23:08 UTC)

- Cofre conferido antes (só nomes): os dois segredos existem; a URL bate com a esperada. Rota sem segredo responde 401.
- 025 aplicado no `iyytcavcgukfjnjjrerx`: job `almox-producao-omie` (id 49), `4-59/5 * * * *`, ativo.
- 1ª rodada 23:14:00 UTC: `succeeded`, app respondeu **202**. Fila `alx_tarefas_omie` vazia (nenhum movimento ainda).
