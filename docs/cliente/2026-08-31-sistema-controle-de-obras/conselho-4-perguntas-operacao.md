# Conselho: as 4 perguntas — lente operação do cliente

**Membro:** lente do gestor de manutenção da Manfac — dispensa um funcionário em 21/09,
depende do sistema em 22/09. Só leitura, nada editado além deste arquivo.

## Achado antes da tabela: a pergunta 1 já tem resposta verificada

`transcricao-reuniao-2026-08-31.md:139-143` (José Guilherme, cliente, [13:06], descrevendo o
que o funcionário faz hoje, sem que ninguém pergunte "quem vai ser demitido" — é a descrição
geral do cargo):

> "Então, o que que o cara que tá lá faz hoje? Ele atualiza a planilha com as obras aprovadas.
> Ele faz, junto com a operação lá, um cronograma de obra. Ele atualiza o status das obras. Ele
> atualiza pendências com outras áreas... E aí, ele faz os envios de relatório... Apresenta
> essas informações também pro cliente. E ele cobra o fechamento da ordem de serviço no sistema
> do cliente. E ele acompanha o faturamento."

E confirmado de novo, já mirando o funcionário específico, em `:525-527` ([49:38]-[49:42]):

> joao victor: "Então, no caso, não vai ser mais o rapazinho que vai preencher essa planilha."
> José Guilherme: "Vai ser o Yuri preenchendo o sistema. Não, a gente vai demitir ele, porra.
> A gente quer demitir ele justamente por isso. O sistema passa a fazer."

O "rapazinho" atualiza status e motivo de bloqueio diário (clima, falta de equipe, falta de
material — linhas 495-523) a partir do que Yuri reporta. **Isso já tem substituto construído:**
o módulo `app/obras/diario/` existe, com motivo por tipo de falta
(`feedback-03-tarefas-por-falta.md`).

**Mas três das sete tarefas da fala de 13:06 não têm substituto construído hoje:** montar o
cronograma da obra, cobrar ativamente o fechamento da OS no sistema do cliente (a transcrição
chama isso de agente cobrador, camada 3, ainda não construída — `feedback-09...md`), e
apresentar os indicadores ao cliente na reunião semanal (painel de SLA da seção F, que P3 e P4
travam). **Esse é o risco real de 22/09 — e não está em nenhuma das 4 perguntas.**

## Tabela

| # | Pergunta | Relevante? | Bloqueia o quê, concretamente | Suposição serve? | Quem responde | Custo se a suposição estiver errada |
|---|---|---|---|---|---|---|
| 1 | O que o funcionário faz hoje | **Já respondida** | Escopo do "pronto 21/09" | Não é suposição — é fato verificado na transcrição | Ninguém precisa responder de novo | Alto se **ignorado**: planejar sem mapear as 7 tarefas deixa cronograma, cobrança de OS e apresentação semanal sem dono a partir de 22/09 |
| 2 | Motivos de remarcação | Sim, mas não agora | Só o campo de motivo ao mudar o início de uma obra já liberada (caso pontual) | Sim — lista sugerida + "Outro" com texto livre | João decide agora, sem esperar o cliente | Baixo — é um enum; trocar item depois é edição de 1 linha, sem obra em risco |
| 3 | Até quando conta o SLA 2 | Sim | Spec da seção F — o painel que substitui a "apresenta pro cliente" da tarefa 1 | Sim — o fluxo já aprovado responde sozinho: `fecharOS` é etapa própria e "Concluir esta etapa" (decisão 10, `j4-decisoes-2026-09-14.md`) grava a data; fim do SLA2 = conclusão de "Fechar OS" | João fecha sozinho, sem perguntar ao cliente | Médio — número errado no painel que vai pra reunião semanal pesa na credibilidade, mas é 1 campo a corrigir depois, não dado perdido |
| 4 | Metas dos SLAs (20/30) | Sim, mas não agora | Só a cor do card (amarelo/vermelho) no mesmo painel F | Sim — mesmos números da obra crítica, editável no sistema | João decide agora | Baixo — config; muda depois sem migração nem obra em risco |

## Pergunta que falta (mais importante que as 4)

**Das 7 tarefas que o cliente descreveu em 13:06, três não têm frente rodando agora**
(cronograma, cobrança ativa de fechamento de OS, apresentação semanal ao cliente — o briefing
só lista seção E, D e o Excel como paralelas). **Quem cobre essas três manualmente entre 22/09
e as frentes ficarem prontas?** Se a resposta for "ninguém", o sistema estar no ar em 21/09 não
evita o buraco operacional que motivou a pergunta 1 — só o disfarça.

## Recomendação (3 linhas)

Perguntar ao João hoje: quem cobre cronograma, cobrança de fechamento de OS e apresentação
semanal ao cliente entre 22/09 e essas três frentes ficarem prontas — não é pergunta para o
cliente. Perguntar ao cliente: nenhuma das 4 — P1 já está respondida na própria transcrição de
31/08, e P3/P4 o João fecha sozinho com decisões já tomadas (fluxo de `fecharOS` e regra da obra
crítica). Assumir e declarar: motivos de remarcação com a lista sugerida + "Outro", fim do SLA2
= conclusão de "Fechar OS", metas 20/30 iguais à obra crítica — as três seguem no mockup v02 sem
travar em resposta de ninguém.
