# Feedback 12 — áudio do cliente: quem cadastra, e OS aprovada × OS liberada

**Recebido em 10/09/2026, fim da noite**, transcrito pelo João a partir de áudio do
cliente. **É a resposta à pergunta 1** da página enviada em 10/09 ("Quem completa o que o
Field Control não manda, e até quando?") — a pergunta que bloqueava a frente 1a.

O canal foi o mesmo do feedback 06: o cliente responde por áudio ao João, não pelos campos
da página nem por comentário no artifact. **Terceira vez que isso se repete — o canal
confiável deste cliente é a voz, e a página serve para ele ler, não para responder.**

## Transcrição literal

> a questão do cadastro da obra  quem cadastra as informações: eu acho que nesse primeiro
> momento a gente pode deixar pra qualquer um cadastrar.
>
> Até pra gente não travar o processo colocando que a só o fulano de tal cadastra entendeu
>
> a gente pode acabar travando o processo até porque se esse cara sair depois pra gente
> mudar esse essa pessoa que cadastra, pode ser meio caótico
>
> E um ponto importante também:  nessa etapa de cadastro tem que levar em consideração
> aquela situação que eu te falei que tem OS que não são aprovadas em sistema então o
> cliente libera pra executar e depois ele aprova a os
>
> então tem que prever dois cenários que vamos chamar de OS aprovada e OS liberada,  por
> exemplo: às vezes a gente não vai  ter uma os aprovada, mas a gente pode ter uma OS
> liberada.
>
> Tipo: Eu vou fazer uma obra mas o cara não aprovou uma OS e é emergencial, exemplo: tem
> teve uma infiltração lá no telhado na loja tal preciso entrar lá pra fazer a obra
>
> Então eu não vou ter OS aprovado porque o cliente me ligou e acionou entendeu, aquele
> caso que eu já tinha te explicado.
>
> então por isso que tem na planilha OS liberada por (nome do analista + data da
> liberação)
>
> Porque depois esses cara sai de férias por exemplo que eu consigo falar com _ coordenador
> dele falar olha: o Leandro que aprovou essa OS no dia tal tá e a gente executou
>
> A  data da aprovação do OS no sistema às vezes é uma data diferente
>
> às vezes tem casos aqui que ela aconteceu tipo três meses depois do que a gente tinha já
> feito tudo, entendeu, e Isso é um indicador que a gente sempre cobra o cliente

## O que está decidido

**1. Qualquer pessoa cadastra.** Sem dono fixo, sem papel exclusivo. A razão dada é
operacional e boa: nomear um responsável único trava o processo quando ele falta, e trocar
o nomeado depois é caótico. **A frente 1a fica mais simples do que o previsto** — não
precisa de regra de permissão por papel, nem de campo "responsável pelo cadastro". Basta
que a tela exista e que **quem preencheu fique registrado** (autoria, não permissão).

**2. "Até quando" não foi respondido.** A pergunta tinha duas partes; o áudio responde
"quem" e não menciona prazo. Tratar como **sem prazo definido** — e não inventar um.

**3. `OS aprovada` e `OS liberada` são coisas diferentes, e as duas precisam existir.**
Este é o conteúdo mais importante do áudio.

## OS aprovada × OS liberada — o que isso significa de verdade

| | O que é | Quem faz | Quando |
|---|---|---|---|
| **OS liberada** | Autorização para **executar**, dada de viva voz / por acionamento direto | Um analista do cliente, com nome | Antes da obra, às vezes no telefone |
| **OS aprovada** | Aprovação **formal, no sistema** do cliente | O processo da DPSP | Depois — **às vezes três meses depois de tudo pronto** |

O caso concreto que ele deu: infiltração no telhado, emergência, o cliente liga e manda
entrar. **Não existe OS aprovada nesse momento e a obra acontece assim mesmo.** Por isso
a planilha tem "OS liberada por" com **nome do analista + data da liberação** — e a razão
é rastreabilidade humana, nas palavras dele: quando o analista sai de férias, dá para
procurar o coordenador e dizer *"o Leandro liberou essa OS no dia tal e a gente executou"*.

**E a defasagem entre as duas datas é um indicador que eles cobram do cliente.** Não é
ruído de cadastro: é métrica de negócio. Uma obra executada em janeiro cuja OS só foi
aprovada em abril é exatamente o tipo de coisa que a Manfac leva para a reunião.

## O que isso significa no código — verificado, não suposto

O modelo **já previu isso** na decisão I (feedback 05): `obras_obra` tem as quatro colunas
— `os_aprovada` (boolean), `aprovacao` (date), `liberado_por` (text), `liberado_em`
(date) — e a ficha já sabe falar do estado "sem cobertura" (obra executando sem OS e sem
ninguém que tenha liberado). `_lib/tipos.ts` tem `liberada()` e `semCobertura()`.

**Estado real de cada campo, medido em 10/09** (e isto corrige uma pendência do
`ESTADO.md`, que listava "campo de liberação na Triagem" como não construído — ele está):

| Campo | Gravável hoje? | Onde |
|---|---|---|
| `liberado_por`, `liberado_em` | ✅ **sim** | `_actions.ts:151-152`, na Triagem |
| `pcm`, `equipe`, `prioridade`, `inicio_plan`, `duracao` | ✅ sim | idem |
| `tipo`, `valor`, `origem`, `analista_cliente`, `aprovacao` | ❌ **não** | lugar nenhum |
| `os_aprovada` | ❌ **não** | lugar nenhum |

**Duas consequências, e a segunda é grave:**

**1. A liberação só pode ser registrada enquanto a obra estiver em `definir`.** A Triagem
aparece apenas quando `etapa === 'definir'` (`page.tsx:103`), e o `update` ainda reforça
com `.eq('etapa', 'definir')`. O caso emergencial do áudio — cliente liga, manda entrar,
obra começa — é registrável **se alguém triar antes**. Depois que a obra anda, o nome de
quem liberou não entra mais. E é justamente na obra que já andou que essa informação é
cobrada.

**2. `os_aprovada` nunca é escrito por nada, e a esteira depende dele.** A ficha desenha o
desvio da esteira com `if (k === 'aprovarOS' && obra.os_aprovada)` (`_ficha.tsx:162`) —
o caminho da obra que já tinha OS aprovada e pula o "Pendente fechamento". Como o campo é
sempre falso, **esse desvio nunca acontece**. O sistema tem o desenho dos dois cenários
que o cliente acabou de descrever, e só consegue percorrer um.

Ou seja: `liberado_por` e `liberado_em` não são detalhe de cadastro, são **a prova
documental de que a obra podia ser feita** — nas palavras dele, o que permite procurar o
coordenador e dizer "o Leandro liberou no dia tal". O sistema sabe guardar isso; só não
deixa guardar na hora em que a informação aparece.

## Consequência direta para a frente 1a

A tela de completar a obra precisa, no mínimo:

- Os cinco campos que o Field não traz: `tipo`, `valor`, `origem`, `analista_cliente`, `aprovacao`
- **`liberado_por` + `liberado_em`** — com o nome do analista do cliente que autorizou
- `os_aprovada` como estado próprio, independente de `aprovacao` ter data
- Estar disponível **em qualquer etapa**, não só quando `etapa = definir`
- Aberta a qualquer usuário, **com registro de quem preencheu e quando**

E a defasagem `aprovacao - liberado_em` merece virar número visível — é indicador que o
cliente já cobra hoje, e o sistema tem tudo para calcular sozinho.

---

## A pergunta 03 foi encerrada pelo João, sem resposta do cliente

Na mesma noite, o João:

> ignora o avanço de % por agora, nao é tao relevante assim, é mais visual

**A pergunta 03 sai da fila.** Ela estava aberta desde 31/08, foi feita pelo cliente no
`.docx` ("como calcula esse avanço %?"), ficou três dias sem ninguém ver porque o arquivo
estava solto na raiz do repositório, e depois entrou na página de perguntas de 10/09.
Encerra agora **por decisão do João, não por resposta do cliente** — o campo continua
como está: digitado à mão, sem regra.

**O que fica registrado, para quem reabrir isso:** a razão de a pergunta existir não era
estética. A planilha tem `0.9` numa linha e `95` em outra querendo dizer a mesma coisa, e
foi **o cliente** quem perguntou, não nós. Enquanto não houver regra, o avanço não serve
para comparar obras nem para alimentar relatório — serve só para dar uma noção na tela,
que é exatamente o uso que o João descreveu. A proposta que estava pronta (declarado no
diário em passos de 10%, com a foto do dia como evidência) segue em
`pergunta-03-como-calcula-o-avanco.md`, sem prazo.

**Consequência prática imediata:** a página de perguntas enviada ao cliente em 10/09 tinha
duas perguntas. As duas estão fechadas — a 1 pelo áudio acima, a 3 por esta decisão.
**Não há mais nada pendente com o cliente.**
