# Feedback 08 — o cliente vai fazer um pente fino no Field

**Recebido em 10/09/2026, à noite**, pelo João, no chat. É a resposta do cliente à
questão de qual OS o sistema deve puxar do Field Control: as antigas, já abertas, ou só
as que abrirem daqui para frente.

## Texto literal, como o João transmitiu

> o cliente respondeu que: ele junto do colaborador dele vao fazer : melhor cenário é
> fazer um pente fino no field, ver oq tem de OS la, cruzar com a planilha pra ver oq tem
> OS aberta no field, ai fechamos as obras que já finalizaram no field, E as obras em
> andamento a gente abre as OS no field ai o sistema de gestao de obras puxa

## O que isso é

**É uma resposta operacional, não uma escolha entre as opções que estavam na mesa.** O
cliente não escolheu "puxa antigas" nem "puxa só novas": ele se comprometeu a **sanear o
Field antes**, de modo que "OS aberta no Field" passe a ser a verdade sobre o que está em
andamento.

O trabalho que ele assume, com o colaborador dele:

1. Pente fino no Field — levantar o que existe de OS lá
2. Cruzar com a planilha
3. **Fechar no Field** as obras que já terminaram
4. **Abrir OS no Field** para as obras em andamento que ainda não têm OS
5. A partir daí, o sistema puxa do Field

> **Nota sobre a fonte.** Este texto é o relato do João sobre o que o cliente disse, não
> a palavra do cliente em primeira mão. Não houve áudio nem documento desta vez. Se
> aparecer divergência sobre o combinado, é esta a limitação a lembrar.

## Consequências para o sistema — o que muda

**1. A decisão de escopo da sincronização está resolvida, e é a Opção B.**
O corte é **por estado da OS (em aberto), nunca por data de criação**. E a razão fica
ainda mais forte com o pente fino: uma obra que está em andamento há oito meses vai
ganhar uma OS **aberta hoje**. Qualquer regra do tipo "só o que abrir de hoje em diante"
ou "só OS criadas nos últimos 12 meses" passaria a funcionar por coincidência — e
quebraria em silêncio no dia em que o cliente abrisse uma OS retroativa.

**2. O corte de segurança por data deixa de ser necessário.** Ele existia para não
arrastar OS velha esquecida aberta. O pente fino resolve isso na origem, que é o lugar
certo.

**3. A conciliação com a planilha continua obrigatória.** As obras que entrarem pela
planilha e as que vierem do Field vão se encontrar. A chave é o **número da OS**
(`identifier` no Field, único por construção). A exceção conhecida é a obra "GARANTIA",
que não tem número de OS.

**4. E esta é a consequência mais séria: a frente 1a deixa de ser importante e passa a
ser bloqueadora.** As OS que o cliente vai abrir agora nascem no Field com **três campos
apenas** — número, loja e descrição. `tipo`, `valor`, `analista_cliente`, `origem` e,
criticamente, **`aprovacao`** não vêm. Hoje o sistema não tem onde digitar esses campos
depois da Triagem, e `aprovacao` nula significa que a obra **nunca vira crítica** — ou
seja, ela afunda exatamente como afundava na planilha. O mecanismo que justifica o
projeto inteiro depende de a 1a existir antes de a sincronização entrar.

## Pergunta que esta resposta tornou desnecessária

*"Todas as obras em andamento hoje estão na planilha, ou existem OS abertas no Field que
nunca entraram nela?"* — ia ser a terceira pergunta ao cliente. **Não precisa mais ser
feita:** o pente fino é justamente o ato de descobrir isso, e ele vai ser feito por quem
tem acesso aos dois lados.

## Pergunta que esta resposta ABRE, e que precisa de resposta do João

**Importar a planilha agora, ou esperar o pente fino terminar?** As duas têm custo real e
a decisão é de operação, não de código — está registrada em `ESTADO.md`, no bloco de
10/09 à noite.

---

## Complemento da mesma noite — o cliente define a prioridade

Ainda em 10/09, pouco depois, o João transmitiu:

> o cliente falou: é melhor trabalhar na integração e amanha eu sento com o cara e faço
> esse pente fino com a equipe

**Duas coisas ficam decididas por isso, e nenhuma delas é nossa:**

1. **A prioridade de construção é a integração com o Field**, não mais o caminho da
   planilha. A planilha era a ponte enquanto não havia credencial de API — e a credencial
   existe desde 08/09.
2. **O pente fino tem data: 11/09**, feito pelo cliente com o colaborador dele e a
   equipe. Deixa de ser prazo indefinido, o que muda o cálculo da pergunta acima: esperar
   a base saneada passa a custar um dia, não um mês.

**Consequência de escopo, e ela é boa:** as 187 obras da planilha deixam de ser a base
definitiva e viram **carga de teste**. A base real nasce do Field, depois do pente fino.
Isso simplifica a conciliação — em vez de casar dois cadastros vivos para sempre, é uma
carga só, descartável, com `delete from public.obras_obra` enquanto ninguém tiver
respondido diário.

**E reforça a ordem das frentes:** a integração (1c do João, F1 do Duda) só entrega valor
se a **1a** existir antes. As OS que o cliente vai abrir amanhã nascem com três campos e
`aprovacao` nula — obra que nunca vira crítica. Construir a sincronização antes da tela
de preencher é encher o sistema de obras invisíveis, rápido.
