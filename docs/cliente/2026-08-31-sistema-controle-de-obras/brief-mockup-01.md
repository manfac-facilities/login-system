# Brief do mockup 01 — Controle de Obras (COP)

Documento de trabalho. Base: `transcricao-reuniao-2026-08-31.md`,
`framework-transcricao.md`, `planilha-dpsp-rev02-dump.txt` e
`decisao-01-resposta-do-cliente.md`, todos nesta mesma pasta.

Este mockup **não** é implementação. É o artefato que o cliente (José Guilherme,
dono da Manfac) vai olhar para aprovar o desenho antes de existir spec.

---

## 1. O problema que o mockup precisa deixar óbvio

Uma obra planejada para durar 7 dias ficou **123 dias** parada sem ninguém
perceber. O cliente (Pacheco) percebeu antes da Manfac e cancelou **R$ 100 mil**
de faturamento. A causa: ninguém registra o que aconteceu em cada obra, cada dia.

Hoje o registro depende de um funcionário do controle operacional sentar com o
analista de obras (Yuri) e bater linha a linha numa planilha, ou mandar a planilha
para ele preencher e devolver. O dono quer eliminar essa etapa.

Se o mockup não faz alguém olhar e pensar *"com isso eu teria visto a obra parada
no terceiro dia"*, ele falhou.

---

## 2. Decisão já tomada pelo cliente (não reabrir)

**Opção D:** a tela do sistema é a fonte da verdade e vem primeiro. O Yuri
responde o diário. Numa segunda etapa entra um agente de IA no WhatsApp —
**conversacional, não bot de formulário** — gravando no mesmo lugar.

**Consequência obrigatória no desenho:** o diário é feito de poucos campos
fechados. Nada de textarea como fonte principal. O mesmo registro tem que ser
preenchível por clique numa tela e por um agente lendo "hoje não andou não, tá
faltando a tinta ainda". Campo de observação livre pode existir, mas como
complemento opcional, nunca como o dado.

---

## 3. As três telas

### Tela 1 — Diário do dia (a principal)

O Yuri abre de manhã. Vê **só as obras dele que estão em andamento**. Responde e
sai. Meta: 11 obras em menos de 5 minutos, sem sair da tela, sem abrir modal por
obra.

Por obra, três respostas (as duas primeiras são palavras do cliente, minuto 37):

1. **Andou hoje?** — sim / não
2. **Faltou algum item?** — não / sim + qual (o "qual" é uma lista curta:
   material, ferramenta, equipe, documento/ART, outro)
3. **Se não andou: por quê?** — lista fechada de bloqueios, retirada da planilha
   real: Clima · Cliente/loja · Disponibilidade de equipe · Contratação de
   prestador · Falta de material · Sem bloqueio

Campo opcional de observação em uma linha, escondido atrás de um "+ observação".

Regras de comportamento:
- Obra já respondida hoje sai da fila (ou colapsa marcada como feita) — o Yuri
  precisa ver a fila esvaziando.
- Obra que está no mesmo bloqueio há mais de 3 dias aparece destacada, com o
  contador de dias. É o sinal que teria evitado o caso dos 123 dias.
- Resposta "não andou" pela terceira vez seguida deve pedir/insinuar uma ação —
  não pode ser tão barato responder "não andou" quanto responder qualquer outra
  coisa.

### Tela 2 — Base de obras (a "planilha viva")

O cliente ficou explicitamente indeciso na reunião: *"talvez em formato de
Kanban... não necessariamente precisa ser Kanban, mas uma parada que visualmente
tem uma lógica e funcione"*.

**Desenhar as DUAS variantes, alternáveis por um seletor no topo da própria
tela**, para ele comparar vendo:

- **Variante A — tabela.** Próxima da planilha que ele já usa, com as colunas
  que hoje existem. Ordenável, com filtro por analista/PCM e por etapa.
- **Variante B — Kanban por etapa da obra.** Colunas: Levantamento/planejamento ·
  Em andamento · Paralisado · Finalizado. Card mostra loja, tipo, PCM, dias desde
  a aprovação e o bloqueio atual.

Nas duas variantes, **dias desde a aprovação tem que ser visível e gritar quando
passar do razoável** — é o número que ninguém enxerga hoje.

### Tela 3 — Ficha da obra

Aberta ao clicar numa obra em qualquer das duas telas anteriores.

- Identificação: nº OS, loja, descrição do chamado, tipo, valor, analista, PCM
  responsável, equipe/prestador, origem
- **Cronograma no modelo novo:** data de início + **duração em dias** (não data
  final planejada — decisão do cliente no minuto 18). A data final é calculada e
  aparece como consequência, visualmente secundária.
- **Remarcações:** lista com data e motivo de cada uma. A planilha atual já conta
  quantas vezes cada obra foi remarcada; aqui isso vira histórico legível.
- **Linha do tempo do diário:** dia a dia do que foi respondido. É a tela que
  mostraria a obra do Bairro de Fátima parada desde sempre.
- Espaço reservado (pode ser placeholder) para o relatório fotográfico e o
  fechamento da OS que vêm do Field.

---

## 4. Dados para popular o mockup

Usar dados reais da planilha, não lorem ipsum. Estas são as **11 obras do Yuri** —
o mesmo número que o cliente citou na reunião ("tem onze linhas aqui"), o que faz
a tela bater com o que ele conhece.

| Nº OS | Loja | Descrição | Tipo | Valor | Analista | Equipe | Etapa | Bloqueio | Avanço |
|---|---|---|---|---|---|---|---|---|---|
| 0226-014989 | DP BAIRRO DE FATIMA | Forro do estoque caiu | TELHADO | 28.520,46 | LEANDRO | MANFAC-7 | Em andamento | Disponibilidade de equipe | 0% |
| 0226-005730 | DP BARRA DE SAO JOAO | Infiltração no teto, pingando sobre produtos | TELHADO | 35.706,12 | LEANDRO | ERLI/RICARDO | Em andamento | Clima | 90% |
| 0526-013724 | DP NILOPOLIS 5 | Caminho Cliente — pintura fachada | CIVIL | 35.399,80 | JUAN | ALEXANDRE | Em andamento | Sem bloqueio | 50% |
| 0826-004428 | DP PETROPOLIS 5 | Mão de obra para pintura da fachada | CIVIL | — | AMANDA | MANFAC-27 | Em andamento | Sem bloqueio | 95% |
| 0826-004429 | DP PETROPOLIS 6 | Mão de obra para pintura da fachada | CIVIL | — | AMANDA | MANFAC-19 | Em andamento | Sem bloqueio | 10% |
| 0826-007431 | DP PETROPOLIS 4 | Pintura da retaguarda (visita do presidente DPSP) | CIVIL | — | AMANDA | MANFAC-26 | Em andamento | Sem bloqueio | 90% |
| 0526-013745 | DP LUCIO COSTA | Caminho Cliente — pintura fachada | CIVIL | 29.795,50 | JUAN | DEFINIR | Paralisado | Cliente/loja | 0% |
| 0526-013743 | DP PEDRA DE GUARATIBA | Caminho Cliente — pintura fachada | CIVIL | 28.050,15 | JUAN | DEFINIR | Paralisado | Clima | 0% |
| 0226-011320 | DP PRACA DO O | Loja com infiltração | TELHADO | 18.919,37 | LEANDRO | ALEX | Paralisado | Disponibilidade de equipe | 20% |
| 0526-013772 | DP NILOPOLIS 4 | Caminho Cliente — pintura fachada | CIVIL | 33.356,92 | JUAN | MANFAC-19 | Paralisado | Cliente/loja | 10% |
| 0126-018429 | DP RECREIO 7 | Água minando nas paredes, avaria em fraldas | CIVIL | 17.702,92 | JUAN | ALEX | Levantamento | Sem bloqueio | — |

Pendências reais que existem hoje nessas obras, para usar como texto de apoio:
"Aguardando chegar tinta" (Lúcio Costa), "Aguardando estabilidade de clima"
(Pedra de Guaratiba), "Pagamento ART e andaime 8m" (Nilópolis 5), "Aguardando
liberação da gerente para escolha de data" (Copacabana 8).

**Caso obrigatório no mockup:** a obra do **DP BAIRRO DE FATIMA** deve aparecer
com o alerta de obra aprovada em 30/04/2026 e ainda não concluída — 123 dias.
Duração planejada: 7 dias. É o caso que o dono usou para justificar o projeto
inteiro; ele precisa ver esse número na tela.

Para a tela 2, usar também obras já finalizadas da aba Pipeline, para as colunas
não ficarem vazias. Total real da base: 187 obras.

---

## 5. Identidade visual

Tema do hub Manfac, já em produção:

- Fundo `#0a1628` · navy `#0d2050` · laranja `#f05a28` (ação/destaque)
- Texto secundário `#94a3b8` · bordas `#1e3a5f`
- Fonte: system stack. Sem biblioteca de UI externa.

É uma ferramenta de trabalho diário, não uma landing page: densidade de
informação alta, clique curto, nada de animação decorativa. A única animação que
se justifica é a que dá retorno ao responder (a obra saindo da fila).

---

## 6. Requisitos do artifact

- HTML único, interativo de verdade: responder uma obra tem que funcionar, o
  seletor tabela/Kanban tem que alternar, clicar numa obra tem que abrir a ficha.
- Estado em memória (JS puro). Sem backend, sem framework externo.
- Responsivo. O Yuri pode responder do celular.
- **Campos de feedback embaixo de CADA seção** (`contenteditable` + radio
  aprova/ajusta), nunca um bloco consolidado no fim.
- Tema claro e escuro conforme a preferência do visualizador.
