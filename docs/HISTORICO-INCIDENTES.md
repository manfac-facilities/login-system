# Histórico de incidentes

Este arquivo existe porque o `AGENTS.md` foi cortado de 445 para 199 linhas (commit
`514b5ba`) para caber no limite de contexto recomendado, e o corte manteve as regras mas
jogou fora o relato do incidente que gerou cada uma. Regra sem história vira regra que
parece exagero — e se contorna. O `AGENTS.md` aponta pra cá.

## O push que ficou travado por meses (até 10/09/2026)

**Custo:** todo deploy dependia do João estar disponível para dar push — isso custou os
deploys de 07/09, 08/09 e a primeira metade de 10/09.

A conta `Mainsis` (a do `git`, do `gh` e do Chrome nesta máquina) só tinha `pull` no
repositório `manfac-facilities/login-system`. Em 10/09/2026 o João concedeu **Admin**, e
`gh api repos/manfac-facilities/login-system --jq .permissions` passou a devolver
`{"admin": true, "push": true, ...}`. Colaboradores depois disso: `Josemanfac` (admin),
`Mainsis` (admin), `daduu27` (write — é o Duda; o convite estava pendente de aceite em
10/09).

Mesmo com o push liberado, o auto mode continuou barrando escrita — com
`[Sensitive-Source Provenance]` para push e `[Production Deploy]` para escrita em
produção. É trava de permissão pedindo autorização do João, não falha de credencial: não
investigar token quando uma delas aparecer. O jeito de não confundir os dois sintomas: o
403 do GitHub dizia `denied to Mainsis`; o bloqueio do auto mode não chega a tocar a
rede.

**A regra que nasceu disso:** distinguir 403 do GitHub (`denied to Mainsis`, falha de
credencial) de bloqueio do auto mode (`[Production Deploy]` / `[Sensitive-Source
Provenance]`, trava de permissão) antes de sair investigando token.

## O mockup do blog que aceitou digitação e não salvou nada (21/08/2026)

**Custo:** um subagente publicou o mockup do blog, o João preencheu os campos, e nada
foi salvo — o HTML servido voltou idêntico ao publicado, byte a byte. O trabalho de
preencher foi perdido.

A causa: a assinatura de documento vivo (a "live subscription" que grava o que é digitado
na página) só existe para a sessão interativa. Quando quem publica é um subagente, a
página aceita digitação e não tem para onde mandar o que foi digitado. O retorno da
publicação avisa quando isso acontece, com esta string exata:

```
Live subscription: skipped — only an interactive or SDK main-loop session holds the watch
```

**A regra que nasceu disso:** subagente desenha o mockup; a sessão principal publica.
Nunca o contrário.

## O `.docx` que ficou três dias sem ninguém ler (31/08 a 03/09/2026)

**Custo:** o arquivo `FEEDBACK CLIENTE CONTROLE DE OBRAS V01.docx` ficou solto na raiz do
repositório desde 31/08, sem versionar — e dentro dele havia uma pergunta do cliente que
ficou três dias sem resposta: **"como calcula esse avanço %?"**.

Arquivo que não vira texto versionado é arquivo que ninguém relê. O procedimento para
não repetir isso: o `.docx` é um zip — o texto está em `word/document.xml` e as imagens
em `word/media/`. Extrair o conteúdo, salvar o texto literal em `docs/cliente/` e guardar
o original em `originais/`.

**A regra que nasceu disso:** isso vale para `.docx`, PDF e planilha, não só para texto
colado no chat — todo material que o cliente manda vira arquivo versionado antes de
alguém agir sobre o conteúdo.

## As sessões como rede de segurança, não como arquivo

**Custo:** nenhum ainda — é uma prevenção, não um incidente fechado, registrada porque
já foi usada para resgate uma vez.

As sessões do Claude Code ficam em
`~/.claude/projects/C--Users-joao--projeto-01-elite-da-ia/*.jsonl` e dá para recuperar
mensagem literal dali — foi assim que a lista de 20/08 voltou depois de não ter sido
salva em arquivo na hora.

**A regra que nasceu disso:** são arquivos locais, sem backup — servem para resgate,
nunca como arquivo do projeto. Material do cliente sempre vira arquivo em
`docs/cliente/` no momento em que chega, não depois, confiando que dá para escavar da
sessão.

## O canal de retorno dos mockups

**Custo:** nenhum incidente de perda aqui — é o mapeamento de qual canal de feedback
realmente funciona, depois de o item 2 acima ter mostrado que campo dentro da página é
frágil.

Verificado em 21/08/2026: existem `action: "comments"` e `action: "reply"` no mecanismo
de artifact, e comentários do visualizador chegam ao Claude — uma nota anterior deste
projeto dizia o contrário e estava errada. Só que os campos `contenteditable`/radio
dentro da página precisam da instrumentação que o mecanismo usa para ancorar o texto —
campo sem essa instrumentação não persiste, mesmo publicado pela sessão certa (o mesmo
modo de falha do item 2, por outro caminho). Por isso a regra de conferir com um teste
real antes de mandar o João preencher: publicar, digitar, reabrir.

**A regra que nasceu disso:** apesar de comentários e campos instrumentados funcionarem
tecnicamente, a decisão atual do projeto é outra — feedback de mockup vem pelo WhatsApp,
colado no chat pelo João, porque é o único canal que nunca falhou.

## O painel de controle nos mockups

**Custo:** nenhum incidente isolado — é uma instrução de qualidade que endureceu depois
de mockups descritos só em texto serem difíceis de julgar.

Quando o pedido envolve animação ou interação, print não serve para julgar hover, scroll
ou pulso.

**A regra que nasceu disso:** publicar o mockup como artifact com painel de controle
para o João comparar variantes (opacidade, on/off) na própria tela, em vez de descrever
a variação em texto.
