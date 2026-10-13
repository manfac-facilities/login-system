# Revisão independente — Frente H (PR #6, e-mail dos avisos)

Revisor: agente independente (não executor). Escopo: diff do PR `manfac-facilities/fornecedores#6` (head `67c6295`) contra
plano (Frente H), spec §1.4 (CA-D1 a CA-D5, tabelas de contrato e aditivo) e e-mails do mockup. Não rodei testes nem
toquei banco; revisão por leitura do diff.

## Veredito: APROVADA

Nenhum bloqueante.

## Verificações da régua (todas passam)

| Ponto | Resultado | Onde |
|---|---|---|
| Destinatários = spec (5 de contrato + 5 de aditivo), sem repetição | OK. Eduardo = `aprovador_contratacao` ativos, José = `aprovador_financeiro`; Para tem prioridade sobre Cópia; cópia do Eduardo na devolução só se o ator é José | `lib/avisos/mensagens.ts` `destinatarios` |
| Vazamento a quem não deveria | OK. Nenhum destinatário vem de entrada do usuário: só `frn_papeis` ativos e `criado_por` de contrato/aditivo lidos do banco | `avisar.ts` `papeisDeAprovacao`, `prepararContrato/Aditivo` |
| Injeção de HTML | OK. Todo valor dinâmico (inclui chaves e valores do bloco, tabela, fecho, link) passa por `escaparHtml` (`& < > " '`); texto vai cru, como a spec manda | `mensagens.ts` `montarMensagem` |
| Injeção de cabeçalho | OK. Assunto passa por `semQuebra` (remove `\r\n`); `to`/`cc` vêm de e-mails do banco e o nodemailer ainda sanitiza | `mensagens.ts` fim; `smtp.ts` |
| Falha de envio derruba a ação | OK. `avisarContrato`/`avisarAditivo` envolvem tudo em try/catch e nunca lançam; erro ao registrar só é logado; doc manda chamar em `after()` | `avisar.ts` fim |
| Segredo em log | OK. `logError` só grava `code`+`message` (200 chars); mensagens de erro construídas só com código; do SMTP só sai `EAUTH 535`-style, nunca a mensagem do servidor | `configuracao.ts` `codigoDoErroSmtp`, `avisar.ts` |
| Server-only | OK. `avisar.ts`, `smtp.ts`, `porta.ts` têm `import "server-only"`; `criarClienteServico` também. `mensagens/configuracao/tentativas` são puros (só importam tipos) | arquivos citados |
| Sem SMTP / D2 | OK. `lerConfiguracaoSmtp` nulo gera `sem_configuracao` registrado, nada enviado | `avisar.ts` `enviarEregistrar` |
| 4xx tenta de novo / D2 | OK. 30 s e 90 s, só 4xx; 5xx, EAUTH e conexão não repetem | `tentativas.ts` |
| 587 sem TLS em claro | OK. `requireTLS: !seguro` | `smtp.ts` |
| Dependências | OK. `nodemailer@9.1.1` e `@types/nodemailer@8.0.1` fixos, lockfile coerente | `package.json`, lock |
| Escopo de arquivos | OK. Só os arquivos previstos pelo plano |  |
| Evento x constraint de `frn_avisos` | OK. Os 9 nomes de evento do código estão na lista do check da spec (§2.4) | `avisar.ts` |
| Testes cobrem CA-D1 a CA-D4 | OK. 10 eventos, sem repetição, escape, assunto, sem_configuracao, falha sem lançar. CA-D5 é de produção (fica para o deploy) | `tests/avisos/*` |

## Melhorias curtas (nenhuma bloqueia)

1. **Sem destinatário não deixa rastro no banco.** Se `para` fica vazio (ex.: sem nenhum `aprovador_contratacao` ativo), só há
   `logError` e nada em `frn_avisos` (`avisar.ts`, bloco `para.length === 0`). A spec diz "cada envio registrado"; aqui o
   aviso some em silêncio se o papel ficar vazio. Registrar com `situacao: 'falhou'`, `erro: 'sem_destinatario'` e `para: ''` exigiria `para not null` aceitar vazio: ver com o SQL antes. Alternativa mínima: deixar como está e anotar em `docs/DIVIDAS.md`.
2. **Textos diferem um pouco do mockup**, sem mudar fato: o mockup abre com "Eduardo, ..." e "O José aprovou ..."; a PR usa voz neutra. E nos e-mails 1 e 2 o mockup mostra `Condição proposta: Nome (30% / 70%)`; a PR mostra só o nome (o resumo de parcelas só existe no "Antes/Depois"). Se o João quiser fidelidade ao mockup aprovado, é ajuste de texto em `corpoDoEvento`.
3. **`NEXT_PUBLIC_APP_URL` vazio** gera link relativo (`/contratos/CT-0001`), inútil num e-mail (`avisar.ts` `urlDoApp: ... ?? ""`). Vale checar que a variável está no Environment do app no deploy (o CI já a usa).
4. **`aprovado_alterado` lê o último evento `condicoes_alteradas` do contrato**, sem filtrar "desde o último envio". Está correto desde que quem chama escolha `aprovado` (e não `aprovado_alterado`) quando não houve alteração naquele ciclo; a Frente B/E deve garantir isso, e o teste de integração delas deve cobrir.
5. **A espera de até 120 s (30 + 90) acontece dentro do `after()`.** Para hospedagem própria no EasyPanel, sem problema; só registrar caso o app migre para ambiente com limite de duração de função.
6. `lerContrato` + `nomesDeCondicao` rodam a cada aviso (2 a 4 consultas). Volume baixo; não otimizar agora.
