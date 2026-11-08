# RH: o que é do João na manhã de 08/11

## Atualização de 08/11, 16h

- **A porta do Financeiro aceita o segredo, e a versão nova dele está no ar** (às 15h59: 400 em pedido incompleto, reconhece `seguro` e `celular`). O 401 das conferências de 08/11 era erro do teste do Claude: `C:\Users\joao-\.manfac-rh-integracao-secret` guarda a linha inteira `RH_INTEGRACAO_SECRET=valor`. Para testar, envie só o valor.
- **Correções do code review juntadas na `main` do RH**, com 2205/2205 testes. **Só valem depois de um novo Deploy do RH.** Até lá, ninguém envia seguro, celular nem VR pelo RH.

## Atualização de 07/11, 23h (depois que você saiu)

- **Deploy continua com você, amanhã.** Correção em 08/11: a conferência das 22h40 não valia, porque `/rh` e `/financeiro` sem sessão redirecionam ao `/login` e os chunks lidos eram do hub.
- **Pendências da revisão final juntadas na `main` do RH** (`aabac50`), com code review e 2182/2182 testes:
  - aviso na tela de que diretoria e administradores leem o motivo de concluir e o de cancelar (BK1, só texto);
  - backlog da F6 em `DIVIDAS.md`, sem B1 e B3, que já estavam corrigidos (BK5);
  - teste do fuso corrigido no 012 e no 014 (BK7).
- **Next 16.4.5 + nodemailer 10** prontos na branch `rh-next-16-4b`, **não juntados**, com code review sem bloqueio.
  - `npm audit --omit=dev` cai de 11 vulnerabilidades (1 crítica) para 0.
  - O limite do anexo de 10 MB passa a dar a mensagem certa.
  - **Falta rodar o build e a suíte no último commit (`f089558`):** o sistema parou a verificação por falta de memória RAM. Esse commit só trocou o limite do proxy para 12mb e removeu `@types/nodemailer`. tsc e lint passaram. O commit anterior (`49e2805`) passou em tudo: build e 2182/2182 testes.
  - Recomendo juntar **depois** do Deploy de amanhã confirmado, num segundo Deploy. Assim, se algo quebrar, dá para saber se foi o RH novo ou o Next. Para isso, escreva no chat: "junta o Next".
- **Decisão nova sua (BK1 de fundo):** esconder no banco, para quem não é `rh`, o motivo de concluir e o de cancelar. Muda uma função do 006 em produção; hoje a tela só avisa quem lê.
- **Disco C:** chegou a 2,2 GB livres; voltou a 8 GB sozinho. Nada foi apagado. Sua autorização está em `docs/cliente/2026-11-07-autorizacao-limpeza-disco.md`.

## Feito na noite de 07/11 (com a autorização do João)

- **Migrations:** 005 a 015 aplicadas em produção (`iyytcavcgukfjnjjrerx`), uma por vez, todas as verificações `OK`.
  - Os 50 colaboradores estão lá antes e depois.
  - O cron `rh-aplicar-vigencias` ficou agendado (`5 3 * * *`).
- **Pasta `rh-arquivos`:** criada privada, com limite de 10 MB, só PDF, JPG e PNG, e sem policy. Todas as policies do storage filtram pelo nome da pasta.
- **Junções:**
  - `rh-modulos` na `main` do RH (`f2e30b7`), com os tipos do banco regenerados;
  - `fin-seguro-celular` na `main` do Financeiro (`7d58a2a`).

## Faça agora, nesta ordem (Deploy)

**Enquanto o RH novo não subir, a tela antiga não deixa editar nem importar pessoa.** Ela recusa e nada se grava. Por isso o Deploy do RH logo cedo.

1. **Financeiro:**
   1. No EasyPanel, abra o app `financeiro` e a aba Environment.
   2. Confira se `RH_INTEGRACAO_SECRET=` está igual ao arquivo `C:\Users\joao-\.manfac-rh-integracao-secret`, na mesma linha e sem espaço.
   3. Clique em Save e depois em **Deploy**.
2. **RH:**
   1. No EasyPanel, abra o app `rh` e a aba Environment.
   2. Confira `FINANCEIRO_URL=https://hub.manfac.com.br` e o mesmo `RH_INTEGRACAO_SECRET`.
   3. **Opcional:** copie do app `compras` as cinco variáveis `SMTP_*`. Sem elas, os avisos ficam "sem configuração" e o RH registra o aviso à mão.
   4. **Nunca** coloque `RH_VITRINE`.
   5. Clique em Save e depois em **Deploy**.
3. **Me avise "subiu".** Eu confiro os chunks, confiro se o 401 sumiu da porta do Financeiro e abro as telas com o papel `rh`.
4. **Teste de fumaça** `TESTE - APAGAR`. Pede autorização separada e aviso ao Financeiro antes.

## Ações manuais

1. **Porta do Financeiro (401).** No EasyPanel, app `financeiro`, aba Environment: conferir a linha `RH_INTEGRACAO_SECRET=` igual à do arquivo local `C:\Users\joao-\.manfac-rh-integracao-secret`, salvar e clicar em Deploy. No app do RH, conferir `FINANCEIRO_URL=https://hub.manfac.com.br`. Sem isso, nenhum pagamento sai do RH.
2. **Pedir ao RH os 50 e-mails.** Todos os colaboradores estão sem e-mail; sem ele ninguém recebe aviso.

## Autorizações (escrever no chat)

3. Aplicar em produção as migrations do RH `005` a `015` e criar a pasta privada `rh-arquivos`.
4. Juntar `rh-modulos` na `main` do RH e `fin-seguro-celular` na `main` do Financeiro, e depois o Deploy dos dois.
5. Teste de fumaça com `TESTE - APAGAR`, valor simbólico, cancelado logo depois, com aviso prévio ao Financeiro.

## Decisões abertas

- Categorias do Omie para seguro (`2.03.13`) e celular (`2.04.05`): confirmar com o José.
- Existência da caixa `rh@manfac.com.br`, para os avisos por e-mail.
- Tolerância do boleto do VR (hoje R$ 10,00) e Transporte Urbano como despesa fixa.

## Estado das frentes (atualizado 07/11, noite)

Todas as frentes foram revisadas, sem bloqueio, e juntadas em `rh-modulos` (`d3c64db`): tsc, 2182 testes, 15 migrations do zero, lint e build verdes. Revisão final do conjunto em andamento (`docs/rh/2026-11-07-revisao-final.md`).

| Item | Situação |
|---|---|
| RH `rh-modulos` | Junção pronta; aguardando revisão final |
| Financeiro `fin-seguro-celular` | Revisado, 0 bloqueios |
| Next 16.4.5 `rh-next-16-4` | Pronto, mas sobre a `main` antiga; **não autorizado**. Recomendo refazer sobre a `main` nova depois do merge |
| Produção hoje | Só 001 a 004 do RH; nenhuma pasta `rh-*` no storage (consultado 07/11) |
| Categorias Omie | `2.03.13` = "Seguro de Vida", `2.04.05` = "Telefonia", ativas no catálogo de produção (consultado 07/11) |

Autorizado pelo João em 07/11 (`docs/cliente/2026-11-07-rh-autorizacao-producao.md`): migrations 005 a 015, pasta `rh-arquivos`, merges de `rh-modulos` e `fin-seguro-celular`. Executo só se a revisão final não tiver bloqueio. **O Deploy dos dois apps fica com o João**, primeiro o Financeiro (com o `RH_INTEGRACAO_SECRET` corrigido), depois o RH.

## Decisões pequenas que deixei reversíveis

- Cancelar férias no dia do início gasta 1 dia (tirar o `+ 1` em `rh_cancelar_gozo` se a regra for outra).
- Reserva de e-mail presa 15 min libera reenvio (pode chegar duas vezes, em vez de nunca).
- Admissão cancelada volta o candidato a "sem decisão".
- E-mail do gestor de contrato visível ao admin sem papel (igual à lista de Pessoas).
- Seguro sem prêmio informado não confere o valor do boleto.
- Número completo da linha de celular visível ao admin sem papel (dá para mascarar).
- Funcionário CLT afastado continua ganhando períodos de férias.

## Decididas

- 07/11, João no chat: "ok, pode seguir com só salário". A correção do total da folha depois do eSocial fica liberada enquanto nenhum pagamento do tipo `salario` daquele mês tiver sido enviado ao Financeiro. Os outros tipos não travam. Implementado em `rh-f3fix` (`66b17b6`).
