# Decisões do João — 15/09/2026, manhã

Respostas dadas pelo João no Claude Code, por múltipla escolha, depois do feedback 14 (mockup
J4 v01) e do feedback 15 (prazo de 21/09). Registradas literais, como foram marcadas.

| Pergunta | Resposta do João |
|---|---|
| Como entender a fala do cliente sobre dispensar o funcionário em 21/09? | **Sistema substitui ele** — o sistema assume o controle que ele faz hoje e precisa estar operando com obras reais antes da saída |
| Seção C da J4: nome da etapa | **"Executado - pendende aprovação OS"** (grafia do João; na UI: "Executado - pendente aprovação OS"). O Claude havia recomendado "Pendente aprovação da OS pelo cliente", fala literal do cliente no feedback 14; o João escolheu a outra |
| "Relatório de entrega" continua na esteira ou sai? | **Continua** |
| Perguntas 08 e 06 saem hoje para o cliente? | **As duas hoje** |

## Resposta posterior, 15/09 (em texto livre, depois da reescrita das 4 perguntas)

| Pergunta | Resposta do João, literal |
|---|---|
| 3. SLA 2 (OS já aprovada no sistema do cliente): começa no **fechamento da OS no sistema do cliente** (fala do cliente no feedback 14 F) e para quando? | **"até a obraser faturada"**, ou seja, até a obra ser faturada. Não para em "Fechar OS" (o Claude havia sugerido "Fechar OS"). Coerente com a decisão 12 de 14/09: a obra sai dos alertas quando a Manfac fatura |
| 2. Motivos de remarcação com que o cadastro começa (seção B) | **"siga com as sugestoes"**, ou seja, a lista sugerida: Loja não liberou acesso · Falta de material · Equipe indisponível · Cliente pediu para mudar · Chuva/clima · Outro. O usuário pode cadastrar motivo novo (pedido do cliente no feedback 14) |
| 4. Metas dos SLAs (amarelo/vermelho) | **"Para faturamento o contador fica amarelo acima de 15 dias, vermelho acima de 30"**. Leitura: vale para o **SLA 2** (OS aprovada → faturamento). **O SLA 1 (sem OS aprovada) não foi respondido**; o mockup v02 assume 20/30, igual à obra crítica, e declara isso como suposição. Os limiares ficam editáveis |
| 1. O que faz o funcionário que vai sair | **Não precisou ser respondida:** já estava na transcrição de 31/08 (achado do conselho, conferido pelo Claude). `transcricao-reuniao-2026-08-31.md:139-143`, José Guilherme: atualiza a planilha com as obras aprovadas; faz o cronograma de obra com a operação; atualiza o status das obras; atualiza pendências com outras áreas (compras, financeiro, administrativo); envia relatórios e apresenta ao cliente; cobra o fechamento da OS no sistema do cliente; acompanha o faturamento. `:527`: "a gente vai demitir ele [...] O sistema passa a fazer" |

## Terceira rodada — 15/09, noite, depois da revisão independente

| Pergunta | Resposta do João |
|---|---|
| A contagem de dias começa no dia em que a obra entra no sistema, mesmo antes de qualquer liberação ou aprovação? | **Sim, conta da entrada.** A âncora é a data mais antiga entre entrada, liberação e aprovação, e a entrada é candidata sempre. O contador passa a significar "há quanto tempo a obra está em aberto" |

**Consequências que foram apresentadas junto e valem registrar:**

- A régua que o cliente descreveu (feedback 14 E) nomeia só aprovação e liberação. Com a entrada
  sempre candidata, ela decide na maioria das obras, porque a obra chega do Field antes de ser
  liberada.
- As obras da primeira carga nascem todas com a mesma data de entrada, a data da carga. No
  primeiro mês, o contador mede a carga, não a obra.
- Em 21 dias, toda obra carregada e não liberada entra em atenção. É o efeito pretendido: obra
  parada sem ninguém assumir é exatamente o que o indicador deve mostrar.
- A alternativa mais correta — guardar **quando** a autorização foi preenchida e usar a entrada
  só até isso existir — depende do histórico de alterações ligado, e não caberia até 18/09. Fica
  como opção futura: o histórico da Parte 1 já grava esse dado.

## Consequências

- "Pronto em 21/09" passa a significar **operação real**: obras do Field no banco e as telas que
  substituem o trabalho do funcionário. Uma demonstração não basta.
- Ainda aberto para a v02 do mockup: os prazos-alvo dos dois SLAs (F). O fim do SLA 2 e os
  motivos de remarcação foram respondidos acima.
