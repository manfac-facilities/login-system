# Autorização do João para produção do RH (07/11/2026, no chat)

Texto literal:

>  - aplicar em produção as migrations 005 a 015 e criar a pasta rh-arquivos;
>  - juntar rh-modulos na main do RH e fin-seguro-celular na main do Financeiro.

Dada em resposta à proposta: executar depois de a junção e a revisão final do conjunto passarem sem bloqueio. O Deploy (clique no EasyPanel) continua com o João.

## Teste de fumaça (08/11/2026)

Texto literal do João, no chat:

> Faz o teste de fumaça

Às 15h31 o teste **não rodou**. Nada foi criado em produção. O 401 que justificou isso era erro do teste do Claude: o arquivo local guarda a linha `RH_INTEGRACAO_SECRET=valor`, e o teste mandava a linha inteira. Às 15h59, mandando só o valor, a porta respondeu 400, como esperado.

## Migration 016 (08/11/2026)

Texto literal do João, no chat:

> Aplica 016

Pergunta a que responde: esconder no banco, para quem não é do RH, o motivo de cancelar e o de concluir um encerramento.

Aplicada em 08/11/2026: 9 de 9 verificações `OK`; 50 colaboradores antes e depois.

## Migration 017 (09/11/2026)

Texto literal do João, no chat:

> Aplica 017

Pergunta a que responde: aplicar em produção a `017_rh_tour.sql` (uma tabela e duas funções do tour, só aditiva), antes do Deploy do RH com layout e tour.

Aplicada em 09/11/2026 pela `main` do RH (`94c73ad`), no ref `iyytcavcgukfjnjjrerx`: 13 de 13 verificações `OK`; 50 colaboradores antes e depois; `rh_tour_conclusoes` vazia, com RLS ligada e uma policy. Falta o Deploy do RH.
