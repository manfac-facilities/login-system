# Conselho — voto do líder de operação pragmático

Lente: 167 OS Spot hoje, poucos analistas, um administrador clicando um botão (D3 depois
automatiza), cliente que já avisou que vai **excluir e reabrir OS com o mesmo número** e
que vai **subir tudo de uma vez**. Ou seja: o cenário "cliente exclui e reabre com mesmo
número" não é edge case aqui — é o motivo pelo qual a D2.1 existe. Isso muda a
classificação de vários itens que, num produto genérico, eu chamaria de raros.

---

## A. Classificação item a item

| Item | Classificação | Frequência real estimada | Impacto / reversível? | Custo do fix |
|---|---|---|---|---|
| **D2.1 I1** (herança sem checar se a OS antiga está na própria varredura → fusão de duas OS ativas numa obra híbrida) | **BLOQUEIA MERGE** | Precisa de exclusão+reabertura **e** troca de número no mesmo ciclo de 15 min (D3) ou no mesmo clique manual. Não é o caso principal, mas com 167 OS reorganizadas por um cliente que mexe em número e status, algumas dezenas de vezes por ano é plausível. | Cola histórico de uma loja na OS de outra loja. Silencioso — ninguém vê alerta, o card só passa a mostrar dado errado. **Não autocorrige nem é óbvio de perceber**; conserto é SQL manual depois de já ter enganado quem lê o histórico. | Baixo-médio: uma guarda de poucas linhas + 1-2 testes, já desenhada no pedido item 2. |
| **D2.1 I2** (motivo descartado; relatório sempre diz "tentaremos de novo" mesmo quando é permanente) | **ANTES DA 1ª CARGA REAL** | Alta — é o caminho **principal** do 2B do cliente (excluir e reabrir com mesmo número). Vai acontecer toda vez que isso ocorrer, ou seja, rotineiramente assim que o cliente operar de verdade. | Não corrompe dado (falha aberta = sem herança). Mas engana o operador PCM, que vai ficar esperando uma "próxima tentativa" que nunca resolve sozinha, até abrir chamado achando que é bug. Reversível (é só texto), mas custa confiança no relatório. | Baixo: repassar `motivo`, já resolvido pelo pedido item 3. |
| **D2.1 I3** (404 sem prova, único caminho de fusão sem evidência positiva) | **Superado pelos fatos.** Antes da J3 real, isso seria BLOQUEIA MERGE — apostar fusão de dado em um código HTTP nunca verificado é exatamente o tipo de coisa que corrompe sem ninguém perceber. | — | — | A J3 (chamada real) resolveu isso de graça: `archived` existe e é confiável; o pedido item 1 já joga o 404 fora do critério. Não sobra trabalho extra aqui além do item 1. |
| **Pedido 1** — herança só com `archived === true` | Necessário para o merge, incorporado ao veredito acima (**BLOQUEIA MERGE** se não entrar) | — | Fecha o buraco do I3 com dado real, não suposição. | Baixíssimo — é trocar a condição em `consulta-ordem.ts`. |
| **Pedido 2** — levar `archived` para `OsNormalizada`, checar presença na própria varredura antes de consultar | **BLOQUEIA MERGE** (é o fix do I1) | Ver I1 acima. | Ver I1 acima. | Médio: mexe em `tipos.ts`, `cliente.ts`, `_sincronizacao.ts`; precisa de teste de ordem (a OS antiga pode vir antes ou depois da nova na lista, já que `sort=id` não tem relação com "qual é a antiga"). Ver ressalva na seção B. |
| **Pedido 3** — motivo chega ao relatório, separa transitório de permanente | **ANTES DA 1ª CARGA REAL** (fix do I2) | Ver I2 acima. | Ver I2 acima. | Baixo. |
| **Pedido 4** — comentário + teste: `archived:true` na listagem não conta como presente-e-ativo | **ANTES DA 1ª CARGA REAL** | Mesma frequência do I1/I2 — é o mesmo dado (`archived`) sendo usado em dois lugares (herança e presença/disjuntor). Se não testar isso, uma OS arquivada mas ainda listada poderia "salvar" uma obra do alerta de ausência indevidamente, ou o inverso. | Silencioso, mas de baixo dano isolado (afeta só a contagem do disjuntor/ausência, que já é conservador). | Muito baixo — é reaproveitar o campo que o pedido 2 já traz. |
| **D2.1 M1** — sem teto de consultas por execução (pode virar 167 GETs, ~3 min, e ainda disparar o disjuntor) | **ANTES DA 1ª CARGA REAL**, não antes do merge | É literalmente o evento da primeira carga: o cliente disse que vai subir tudo de uma vez. É provável que aconteça **uma vez**, não recorrente. | Sync fica lento e pode não confirmar nenhum alerta naquela execução — mas é autolimitado (a varredura seguinte volta ao normal) e ninguém perde dado. Um admin vendo "demorou e não confirmou nada" clica de novo depois; resolve em minutos. | Baixo (um teto configurável), mas não precisa travar o merge de hoje — travar a **primeira carga em massa** sem esse teto, sim. |
| **D2.1 M2** — 1 consulta HTTP desperdiçada para OS que o plano vai descartar de qualquer jeito | **DESCARTAR** | Sempre que há um conflito de renumeração qualquer — mas custa 1 req a mais numa fila de 1 req/s. Com 167 OS isso é irrelevante. | Nenhum. | Não vale o código extra para evitar uma chamada HTTP grátis. |
| **D2.1 M3** — disjuntor proporcional não segura perda de página em base >500 obras | **BACKLOG** | Zero hoje: são 167 OS de um cliente. Só importa se a operação escalar para múltiplos clientes/bases muito maiores. | — | Registrar e não tocar até a base realmente crescer nessa ordem de grandeza. |
| **D2.1 M4 / D2 N5** — página extra quando o total é múltiplo de 100; mantido pelo Duda | Ver **C** abaixo — decisão do Duda está correta. | — | — | — |
| **D2.1 M5** — retrato do banco envelhece um pouco mais durante as novas consultas | **DESCARTAR** | A tolerância de 20h já absorve isso; o próprio revisor reconhece que é o mesmo tema do M2 da rodada anterior, "só piorado". | Nenhum efeito prático adicional além do que já foi aceito. | Não vale reabrir. |

---

## B. O pedido atual (itens 1–4) é factível numa rodada só?

**Sim**, e é uma rodada bem menor do que a lista de 4 itens sugere à primeira vista, porque
os itens 1, 2 e 4 compartilham o mesmo trabalho de fundo: trazer `archived` para dentro de
`OsNormalizada` uma única vez e usá-lo em dois lugares (decisão de herança e decisão de
presença/ausência). Não é "4 frentes", é "1 campo novo + 2 pontos de uso + 1 mensagem de
relatório". Dá para fazer sem abrir buraco novo, com uma ressalva técnica real:

- **Ordem de iteração.** `sort=id` não garante que a OS "antiga" apareça antes ou depois da
  "nova" na mesma página/varredura. O fix do item 2 precisa montar o mapa
  `idField → archived` **numa passada sobre `doField` inteiro antes** de decidir qualquer
  herança ou conflito — não pode confiar em "já vi esse id antes no loop". Isso já está
  implícito no pedido ("se o `field_id` antigo veio na listagem"), mas vale deixar
  explícito no code review como critério de aceite, porque é exatamente o tipo de detalhe
  que já mordeu essa branch duas vezes (I1 nas duas rodadas anteriores era isso: "olhar só
  parte da informação disponível").
- **Simplificação possível para a 2B do cliente:** não vejo forma mais simples que cumpra a
  mesma garantia. A alternativa "não checar a listagem, só confiar no GET" é literalmente o
  bug que está sendo corrigido; a alternativa "sempre consultar, nunca confiar na listagem"
  desperdiça uma chamada HTTP por conflito à toa, já que a listagem já trouxe o dado de
  graça. O desenho do pedido (checar listagem primeiro, só consultar quando ausente) é o
  caminho mais barato, não o mais caro — não é excesso.
- **Único corte que eu faria:** o teste de "renumeração com número novo na mesma
  varredura" citado no item 2 é bom e barato — mantenho. Não cortaria nada do pedido; é
  enxuto para o que resolve.

**Veredito B: factível numa rodada, sem excesso.** É a rodada mais "vale a pena" das três,
porque nasceu de uma chamada real à API (J3), não de leitura de documentação — é
justamente o tipo de achado que evita dano de verdade, ao contrário de parte dos menores.

---

## C. O N5 do Duda (página extra quando total é múltiplo de 100) — decisão certa?

**Sim, está certa, e a decisão dele é a correta pelo motivo certo.** Comparando as duas
opções:

- **Manter (como está):** com 167 OS, isso nem dispara hoje (167 não é múltiplo de 100). Se
  um dia bater 200, 300 etc., custa **uma chamada HTTP a mais que devolve vazio** — sub-
  segundo, dentro da fila de 1 req/s que já existe. Pior caso documentado (a API responder
  4xx em vez de `items: []` nesse offset): a sincronização falha **de forma segura**, sem
  marcar nada — o admin vê erro, roda de novo. Resolve em minutos, sem intervenção.
- **Confiar em `totalCount` para evitar a chamada extra:** é reintroduzir exatamente a
  classe de bug que a I1 da primeira rodada (D2) já pegou — `totalCount` pode estar
  defasado e cortar a leitura antes do fim, criando ausências falsas. Essa classe de bug
  **corrompe silenciosamente** (marca obra como sumida quando não sumiu); a "economia" de
  N5 **reabre** um buraco que já foi fechado com custo real de revisão.

Trocar "uma chamada HTTP grátis, ocasional" por "risco de reintroduzir ausência falsa" é
mau negócio. O Duda acertou em manter, e o argumento dele (não voltar a confiar em
`totalCount`) é o correto. **Isso deveria ter sido fechado como decisão definitiva já na
primeira vez que apareceu (D2, como N5)** — reaparecer como M4 na D2.1 é o tipo de
reabertura que gera a sensação de ping-pong que o João descreveu. Recomendo registrar no
critério (`criterio-ausencia-field-d2.md`) a frase "decidido: N5 não será corrigido, ver
trade-off" para que nenhuma rodada futura reabra isso de novo.

---

## D. Calibração — o que foi valioso e o que foi rigor excessivo

**Valioso de verdade (evitou dano provável, ou destravou um design que estava errado):**

- D2 I1 (varredura parcial contando como completa → alerta em massa) — clássico "vira
  alarme falso pra base inteira", cheap fix, achado correto.
- D2 I3 (`!== null` acendendo alerta com coluna `undefined` antes da migration) — é
  exatamente a armadilha "código mergeado ≠ schema aplicado" já documentada no AGENTS.md;
  vale a pena continuar caçando essa classe específica de bug neste projeto.
- Adendo N1 (disjuntor conta alerta já confirmado e se autodesliga para sempre) — bug real,
  permanente, silencioso; sem esse achado a detecção de ausência morreria sozinha depois de
  algumas exclusões legítimas.
- D2.1 I1/I2/I3 em bloco, e a decisão do coordenador de mandar fazer a J3 (chamada real à
  API) antes de aprovar — **o achado mais valioso das três rodadas**. Sem isso, a D2.1
  teria sido mergeada apostando fusão de histórico de cliente num código HTTP (404) nunca
  visto na prática. A verificação real virou o pedido atual, que é mais simples e mais
  seguro do que o design original.

**Rigor excessivo (ping-pong que não evitou dano proporcional ao esforço de resposta):**

- D2.1 M2 (1 requisição HTTP desperdiçada) e M5 (retrato levemente mais velho, "mesmo tema
  do M2, só piorado") — achados que o próprio revisor já classificou como menores mas que
  ainda assim entraram como itens numerados exigindo resposta linha a linha. Zero dano,
  zero chance de alguém notar em produção.
- D2.1 M3 (disjuntor não escala além de 500 obras) — correto tecnicamente, mas é
  engenharia para uma escala que esta operação (1 cliente, 167 OS) não tem e não tem
  indício de que vai ter tão cedo. Registrar em uma linha bastava; não precisava do mesmo
  peso de um achado importante.
- N5/M4 relitigado duas vezes (D2 e D2.1) sem nunca ser marcado como "decisão fechada" —
  isso é sintoma de processo, não de o achado ser ruim: o achado era válido a primeira vez,
  a segunda menção é que sobrou.
- M1 (teto de consultas na carga em massa) fica no meio-termo: tecnicamente correto e
  barato, mas foi cobrado como se fosse bloqueio de merge quando na real é um cuidado da
  **operação de subir a base**, não do código que está sendo revisado agora.

**Régua de severidade proposta para as próximas revisões deste módulo:**

1. **BLOQUEIA MERGE** só quando o código pode gravar ou fundir dado de cliente de forma
   silenciosa e difícil de desfazer, **no caminho que esta operação real percorre** (167
   OS, poucos usuários, botão manual/depois cron a cada 15 min) — não em caminho que exige
   duas coincidências improváveis encadeadas.
2. **ANTES DA 1ª CARGA REAL**: pode mergear, mas não pode rodar contra dado do cliente sem
   isso — cobre o que o cliente já disse que vai fazer (excluir/reabrir com mesmo número,
   subir tudo de uma vez).
3. **BACKLOG**: só aparece em escala ou cenário que esta operação não tem hoje, ou que um
   humano corrige em minutos olhando a tela (erro relatado, sem dado perdido).
4. **DESCARTAR**: o custo da falha é uma chamada HTTP a mais, uma mensagem cosmética, algo
   que já foi decidido numa rodada anterior, ou uma otimização que só importa em escala
   hipotética.
5. Pergunta de corte para qualquer achado: **"quantas vezes por ano isso acontece nesta
   operação, e quando acontecer alguém percebe e conserta em 5 minutos?"** Se a resposta é
   "sim" para as duas partes, no máximo BACKLOG — nunca bloqueia merge.
6. Achado já decidido (aceito ou recusado com justificativa registrada) não volta a
   aparecer em rodada futura como se fosse novo — só se o fato que sustentava a decisão
   mudar (ex.: escala crescer, API se comportar diferente).
7. Revisor se cala quando o achado é menor **e** o fix custa mais linhas de discussão em
   texto do que linhas de código — nesse caso, corrige direto ou registra numa lista única
   de backlog sem exigir resposta item a item do Duda.
