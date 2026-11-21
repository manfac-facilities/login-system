# RH — autorização do SQL 019 (21/11/2026)

Mensagem do João no chat, literal:

> aplica a 019

Arquivo: `supabase/hub-install/019_rh_pagamentos_premiacao_ferias_aso.sql` (repositório rh, branch
`melhorias-jennypher`, commit `af5e144`). Premiação, férias e despesas com ASO em Pagamentos do mês
(sugestão 6 da Jennypher). Só aditivo: coluna `rh_pagamentos.referencia`, tabela
`rh_aso_fatura_exames`, funções recriadas. O RH que está no ar continua funcionando com ela aplicada.

## Aplicação (21/11)

- Antes: `rh_aso_fatura_exames` não existia, `rh_pagamentos.referencia` não existia, 0 linhas em
  `rh_pagamentos`; pré-requisito do 018 (`rh_pagamento_ligar_mes`) presente.
- 019 aplicado no `iyytcavcgukfjnjjrerx` sem erro.
- Verificação: 15 de 15 itens OK (coluna, tipos novos, índice único com referência, RLS e grants da
  tabela nova, nenhuma função exposta a `anon`).
- Tipos do RH regenerados e commitados na `melhorias-jennypher`.
