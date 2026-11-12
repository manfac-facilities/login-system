# Almoxarifado — resumo da madrugada de 11 para 12/11/2026

Escrito pelo Claude para o João, ao fim da madrugada. Origem do trabalho:
`docs/cliente/2026-11-12-almoxarifado-prosseguir-na-madrugada.md`.

## Em uma frase

Todo o código que **não depende de decisão nem de autorização** está escrito, revisado por agente
independente, corrigido e junto na branch `fase-1` do `manfac-facilities/almox` (commit `c8157b9`,
`tsc` limpo e **2.396 testes passando**, rodados por mim). **Nada novo foi aplicado em banco, nada
foi publicado, nada grava no Omie e nenhum e-mail sai.**

## O que existe em produção hoje

- Só o SQL `001` (papéis, configurações, eventos), aplicado em 11/11 com a sua autorização.
- Nenhum app do almox no EasyPanel. Nenhuma tela publicada.

## O que está pronto na `fase-1` (código + testes; SQL escrito, não aplicado)

| Parte | SQL | Tela |
|---|---|---|
| Estrutura (estoques, contratos, equipes) | 002 | sim, **sem mockup aprovado** |
| Cópia do Omie (produtos, locais, saldos, movimentos) e agendador | 003, 004 | — |
| Posição de estoque + "Em compra" | — | sim (mockup aprovado, Seção 1) |
| Mínimos e estoque alvo | 005 | sim, **sem mockup aprovado** e diferente do mockup 2B |
| Colaboradores e portal do técnico (convite, PIN, sessão) | 006 | entrar e convite (mockup aprovado, com mudanças — ver abaixo) |
| Pedidos, pedido do técnico no celular, aprovação | 007 | sim (mockup aprovado, Seções 2 e 3) |
| Avisos e lembretes — **envio de e-mail desligado no código** | 008 | — |
| Fila de gravação no Omie — **gravação real desligada no código** | 009 | não |
| Assinaturas (PIN + traço) | 010 | não |
| Transferência entre estoques, devolução de sobra | 011, 012 | não |
| Recebimentos (conferência) e sugestão de reposição | 013, 014 | não |
| Inventário (ondas, contagem) e ajustes | 015, 016 | não |
| Ferramentas, consertos, cargas do colaborador | 017, 018 | não |
| Indicadores (cálculo e foto mensal), resumo do dia | 020, 021 | não |
| Separar, entregar, não retirado, cancelar pelo hub, reagendar | 022 | não |
| Fecho de privilégios da chave de serviço nas tabelas do 001 | 023 | — |
| Papéis e configurações | (001) | sim, **sem mockup aprovado** |

Fora de propósito: a conferência de saída de colaborador (Task 31), por causa da regra de nunca
mencionar o assunto; a mudança no repositório do Compras (Task 26) e no do RH; a requisição de
estoque vinda do Compras (Task 24); o gravador pelo Field.

## Mockups publicados (privados — só você abre até compartilhar)

- Rodada 1 (aprovada em 11/11): https://claude.ai/artifact/SHrkbksmuf2ErjTjEZtxkv
- Rodada 2A — início, separação, retirada com assinatura, transferências, devolução, colaboradores:
  https://claude.ai/artifact/4CGE8T9HiPSLgeeVdUZxEn
- Rodada 2B — entregas e conferência, mínimos e reposição, contagem, ajustes, ferramentas e ficha,
  indicadores: https://claude.ai/artifact/AQK6v2ge9NE9huPVBvzoXa

As telas "não" da tabela acima dependem da aprovação das rodadas 2A e 2B.

## Erros de processo meus (para você saber, não para descobrir)

1. **Quatro telas foram construídas sem mockup aprovado:** Papéis, Configurações, Estrutura
   (copiadas do Compras, como o plano mandava) e Mínimos. A de Mínimos ainda ficou diferente do que
   o mockup 2B propõe. Recomendo incluí-las na próxima rodada de mockup e ajustar o código.
2. **A tela de entrar do portal mudou em relação ao mockup aprovado:** duas etapas (CPF/celular,
   depois PIN), sem "Olá, Carlos", com mensagens genéricas. Foi para não revelar a um estranho quem
   é funcionário. Recomendo manter; é mudança sobre algo que você aprovou.
3. **Frases do mockup que prometem aviso foram trocadas** por frases verdadeiras hoje (o envio de
   avisos está desligado). As originais estão guardadas no código para voltar quando o envio for
   ligado.
4. **Uma instrução minha enfraqueceu o bloqueio do PIN** por algumas horas (tirei o bloqueio
   manual para evitar que um estranho travasse um técnico); a revisão automática pegou e foi
   corrigido antes de qualquer coisa ir a banco.
5. **O `master` do hub continua divergente do GitHub** (hoje ~70 commits locais sem push, 33 no
   remoto, conflito em `docs/DIVIDAS.md`). Todos os registros do almox em `docs/` estão só nesta
   máquina até você me autorizar o merge.

## O que as revisões independentes pegaram (e foi corrigido)

- A trava que impede SQL perigoso tinha furos herdados do Compras (os mesmos devem existir no
  Compras e nos módulos derivados — **dívida aberta**, não conferi os outros repositórios).
- "Não é número" (NaN) passa em regras como "quantidade ≥ 0" no Postgres: fechado em toda coluna
  numérica, com um teste geral que falha para SQL futuro sem a proteção.
- Portal: PIN fácil de adivinhar, tempo de resposta revelando quem é funcionário, um IP travando o
  login de todos, estranho tirando um técnico do ar.
- Fila do Omie: quatro caminhos de gravação duplicada (só valeriam com a gravação ligada).
- Pedidos: aprovar com data de retirada no passado; OS, loja e descrição vindas do navegador.
- Conta do disponível: EPI liberando reserva sem baixa no Omie; reserva saindo antes de o saldo
  atualizar; transferência aceita travando o pedido.
- Indicadores: cobertura de 10 dias onde o certo era 90; compra nova contada como estoque parado;
  furto e sobra se anulando.
- Planilha de mínimos: "1.500" virando 1,5; coluna deslocada gravando número errado.

## O que eu preciso de você — por ordem do que destrava mais

### 1. Autorizações (uma frase sua por item)

- **Merge do `master` do hub** e push dos docs.
- **SQL do grupo 1** (primeira tela): `002`, `003`, `005` e `023`. Pré-checagem já feita em
  produção por leitura: `alx_papeis` está vazia e a coluna do Compras que "Em compra" lê existe.
- Os demais grupos eu trago quando houver app e mockups aprovados. A ordem e as consultas de
  conferência estão em `docs/validacoes.md` do almox.

### 2. Decisões suas

- **Onde o app roda no EasyPanel** (você adiou). Sem isso não há tela publicada. Pesa na decisão:
  o portal do técnico é público e precisa saber o IP real de quem acessa.
- **PIN de 6 dígitos fixos** em vez de "4 a 6"? Recomendo 6. Com 30 palpites até suspender, a
  chance de acerto é 0,33% com 4 dígitos e 0,003% com 6.
- **Regra de suspensão do PIN:** depois de 4 bloqueios longos o PIN é suspenso (não entra nem
  assina) até o almox desbloquear ou reemitir convite; a sessão aberta não cai. Alternativa: nunca
  suspender (só recomendo com 6 dígitos).
- **Aprovador vê a tela de Estoque?** O mockup aprovado se contradiz; hoje o menu mostra e a tela
  nega.
- **Bloquear pedido quando a cópia do Omie estiver velha?** Hoje só avisa.
- **Biblioteca de PDF** (`pdf-lib`) — sem ela não há documento de requisição nem termo em PDF.
- **Pasta privada de arquivos no storage** (`almox-arquivos`) — sem ela nenhuma assinatura é
  registrada. É SQL em produção.
- **E-mails:** remetente e servidor (Locaweb?), quem recebe o quê (o emergencial vai a todos os
  gestores?), e o texto de cada um — proposta em
  `docs/almox/2026-11-12-proposta-textos-emails.md`.
- **Mockups 2A e 2B:** seu veredito e, se aprovar, o envio ao Jose.

### 3. Perguntas para o Jose (prontas para o WhatsApp)

**Mensagem A — Omie e Field (a que mais destrava):**

> Jose, para o Almoxarifado andar preciso de 4 coisas suas, sobre Omie e Field:
>
> 1. *Chave do Omie:* o Almoxarifado pode usar a mesma do Compras? Se sim, preciso dela e do segredo do agendador no cofre do Supabase (te mando os nomes).
> 2. *Chave do Field:* a do seu computador venceu. Pode colocar a válida (a do Cockpit) no cofre e me avisar?
> 3. *Baixa automática:* quando o técnico aplica material numa OS do Field, o Field dá baixa sozinho no estoque da equipe no Omie? Está ligado para todas as equipes?
> 4. *Teste de 1 unidade:* preciso fazer com você uma transferência de 1 item barato (DPSP → uma MANFAC), uma vez pelo Omie e uma pelo Field, e estornar. Uns 15 min. Qual item, qual equipe e que dia?

**Mensagem B — regras do pedido:**

> Jose, 6 dúvidas rápidas sobre o pedido de material:
>
> 1. O almox trabalha sábado? (Se não, pedido aprovado no fim de semana fica para terça, não segunda.)
> 2. Aprovou às 16:00 em ponto: ainda vale para o dia seguinte ou já passou do corte?
> 3. Pedido emergencial que não foi aprovado no dia: o aprovador escolhe a nova data ou o sistema empurra sozinho?
> 4. Pedido não retirado: o técnico pode remarcar sozinho ou precisa aprovar de novo?
> 5. Faltou um item na prateleira na hora de separar: o pedido segue com o resto e o item sai do pedido?
> 6. Obra já faturada ou encerrada ainda pode receber material?

**Mensagem C — ferramentas, inventário e números:**

> Jose, mais 6, sobre ferramentas e inventário:
>
> 1. Quem contou o estoque pode aprovar o próprio ajuste?
> 2. O almoxarife pode ver o saldo do sistema enquanto conta? (Hoje ele vê na tela de estoque.)
> 3. Quem pode importar a planilha de ferramentas? E vale importar só uma vez?
> 4. O PIN de quem não tem celular é criado pelo almoxarife no balcão. Quer algum controle a mais (ex.: outra pessoa confirmar)?
> 5. Quem pode ver os indicadores? Só gestor e admin, ou o aprovador vê os do contrato dele?
> 6. Reposição do estoque BASE: qual centro de custo paga? E a agenda de entregas deve mostrar o nome do fornecedor?

Ficam para depois, com você e o RH: o texto do termo de responsabilidade (o desenho do Jose pede
"responsabilidade e desconto"; o padrão novo não fala em desconto), como registrar ferramenta
perdida, e a conferência de saída de colaborador.

## O que NÃO pode acontecer antes da hora

- **Não abrir o portal a técnico real** antes de: telas de separação/retirada aprovadas e
  construídas, job de "não retirado" agendado, e (na prática) o teste de 1 unidade com o Jose.
- **Não ligar a gravação no Omie** antes das 10 medições listadas em `docs/validacoes.md`. A mais
  séria: não há evidência de que o Omie tenha consulta de ajuste por código de integração, e toda a
  proteção contra duplicar se apoia nela.
- **Não lançar à mão no Omie** o que for entregue pelo sistema enquanto a gravação estiver
  desligada (o disponível fica errado e o movimento sai em dobro ao ligar).
- **Não liberar entrega de EPI/uniforme pela ficha** antes de a saída estar ligada à fila.
- **Não ligar o envio de e-mail** antes de você aprovar remetente, destinatários e textos.
- **Não aplicar o `004` (agendador)** antes do app no ar, da sondagem do Omie e dos segredos no cofre.

## O que só dá para saber com o sistema de pé

- Nenhuma tela foi vista publicada nem com sessão real — só com dados falsos, em celular e computador.
- Todo SQL além do 001 só rodou no banco de teste local (uma conexão só): as travas de concorrência
  foram conferidas pelo texto das funções, não com duas sessões reais.
- O formato dos movimentos do Omie nunca foi medido (falta a chave): giro, consumo e estoque parado
  saem marcados "aproximado" até a sondagem.
- De onde vem o IP atrás do proxy do EasyPanel.
- O teste que mede tempo de resposta do login é sensível à carga da máquina (falhou algumas vezes
  com tudo rodando junto; sozinho passa).

## Onde está cada coisa

- Código: `C:\Users\joao-\almox`, branch `fase-1` (pushada). Roteiro de aplicação e validações:
  `docs/validacoes.md` de lá.
- Material do cliente, autorizações e aprovações: `docs/cliente/2026-11-11-almoxarifado-*` e
  `2026-11-12-almoxarifado-*` (hub, só local até o merge).
- Mockups (fonte): `docs/almox/*.html`.
- Sobras desta madrugada que posso apagar quando você disser: 14 pastas de trabalho
  `C:\Users\joao-\almox-wt-*` e as branches `frente-*` no GitHub (tudo já está na `fase-1`).
