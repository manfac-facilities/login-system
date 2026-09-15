# Conselho 4 perguntas: parecer do advogado do diabo (15/09/2026)

Hipótese de partida: as 4 perguntas travam o trabalho e jogam para o João coisas que o
coordenador podia decidir. **Resultado: nenhuma das 4 deve ir ao João. Três se desfazem nos
documentos. A 3 resiste, mas a sugestão dada a ela está errada, e o erro custa caro.**

## 1. Tabela

| # | Relevante? | Bloqueia o quê, concretamente | Segue com suposição? | Quem responde | Custo se a suposição estiver errada |
|---|---|---|---|---|---|
| 1 Funcionário | **Não, como pergunta: já está respondida.** Transcrição de 31/08, 46:37–49:42: o "molequinho" pergunta ao Yuri, obra a obra, como está cada uma e atualiza a planilha todo dia (etapa, bloqueio, cronograma). José: *"a gente quer demitir ele justamente por isso. O sistema passa a fazer."* O substituto já foi desenhado e está no ar: o Diário respondido pelo Yuri, a Base e as Tarefas | Nada. O "pronto de 21/09" não depende dela, e sim de obras no banco e de gente com acesso (ver seção 2) | Sim. Declarar: "substitui a atualização diária da planilha a partir das respostas do responsável" | Ninguém agora. No máximo uma linha ao cliente, junto do Excel: "ele fazia mais alguma coisa além de atualizar a planilha?" | Baixo. O que pode escapar é algo periférico, como montar os números da reunião semanal, e isso aparece na primeira semana |
| 2 Motivos de remarcação | **Sim, mas não agora, e não é decisão.** É dado de cadastro que o próprio cliente pediu editável ("opção pra cadastrar um novo") | Nada no mockup: a lista é conteúdo de um select. Na spec, o que importa é "tabela de motivos + cadastrar novo", e isso o cliente já definiu | Sim, mas **não com a lista sugerida**. O cliente já tem vocabulário aprovado para causa de obra parada: `BLOQUEIOS` em `_lib/tipos.ts:174` (Clima · Cliente / loja · Disponibilidade de equipe · Contratação de prestador · Falta de material), dito por ele na reunião (46:37). A sugestão inventa sinônimos ("Chuva/clima", "Equipe indisponível", "Cliente pediu para mudar") e cria dois vocabulários para as mesmas causas. Aí o cruzamento bloqueio × remarcação sai quebrado. Usar os 5 + "Outro" | Ninguém antes da v02. O cliente reage à lista no feedback da v02 pelo WhatsApp | Minutos: é um seed editável. O custo real está na lista sugerida, não em faltar resposta |
| 3 Fim do SLA 2 | **Sim.** É a única que resiste. O cliente chama os SLAs de "pilar que apresentamos ao cliente semanalmente" | **Não bloqueia o mockup v02.** Bloqueia a spec e o código do indicador. E ele nem cabe em 21/09: o fim natural precisa das colunas do pedido de compra, que ainda não existem e estão no cronograma do Duda depois do cancelamento | Sim, com a suposição **corrigida**. A sugerida ("para quando Fechar OS é concluído") mede do evento até ele mesmo. O início do SLA 2 é "fechamento da OS no sistema do cliente", e fechar a OS lá é exatamente a etapa `fecharOS` (feedback 02, item 4: o responsável "anexa no sistema do cliente e encerra a OS"; o marco é `marco_fechou_os`). Ou o contador dá 0, ou, se o coordenador leu o início como outra data, passa a medir demora da **Manfac** (`fecharOS` tem dono "Responsável da obra") num indicador que vai à reunião **com o cliente**. O passo seguinte é do cliente: "liberar o faturamento" (feedback 02), que só sai com pedido de compra (pergunta 07, 4A e 5A: número e data). Suposição a declarar: **SLA 2 = do fechamento da OS até "Pedido de compra recebido em"** | O **cliente**, pela v02, com a suposição escrita no mockup. O João não sabe mais que os documentos | **Alto se a suposição sugerida for ao código.** Número errado apresentado toda semana ao cliente, e contra a Manfac |
| 4 Metas amarelo/vermelho | **Não agora.** A própria sugestão ("editável no sistema") torna a pergunta irrelevante: qualquer número serve se é editável | Nada no mockup: a cor aparece com qualquer limiar | Sim, 20/30 declarado. **Mas contesto o "editável no sistema":** é escopo novo (tela de configuração, tabela, permissão) para uma métrica que ainda nem foi validada, e sob prazo. O código já trata limiar como constante de produto (`tipos.ts:11-12`). Constante agora, tela depois, se pedirem | O cliente (José), que é quem apresenta à DPSP. Não o João | Baixo para o número. Médio se o "editável" entrar no escopo de 21/09 e atrasar o que importa |

## 2. A pergunta que falta, e ela é maior que as 4

**"O que precisa estar de pé em 21/09 para o funcionário poder sair?"** Hoje, pelos
documentos, nada do que decide isso passa pelo mockup v02:

- **0 obras no banco.** A carga espera o cliente conferir o Excel das 175 OS (7C). Esse é o
  caminho crítico, e ele é do cliente, não do João.
- **Quem substitui o funcionário não entra no sistema.** Yuri e Amanda (79 das 82 obras da
  planilha) não tinham conta no hub, e o slug `obras` não estava liberado para ninguém.
  Fonte: AGENTS.md, estado de 10/09; não verifiquei depois disso.
- Os jobs do `pg_cron` não existem (ESTADO, D3), então a sincronização diária não roda sozinha.
- A v0 já libera obra e muda etapa (`obra/[id]/_actions.ts:59,114`) e tem o Diário. A J4 v02
  melhora a edição, mas **não é pré-requisito** da operação em 21/09.

Pergunta concreta ao João: *"Posso dizer ao cliente que 21/09 = 175 OS carregadas, Yuri e Amanda
com acesso, Diário rodando; e que J4 v02 (edição, remarcação, SLAs) entra até 28/09?"* Ela
muda o plano. As 4 perguntas não mudam.

## 3. Recomendação

- **Ao João, hoje:** só a pergunta da seção 2 (escopo de 21/09 e contas do Yuri e da Amanda). Nenhuma das 4.
- **Ao cliente:** devolver o Excel das 175 OS com urgência. As perguntas 1, 3 e 4 viajam como suposições escritas na v02, e ele corrige no feedback.
- **Assumir e declarar na v02:** motivos = os 5 `BLOQUEIOS` + Outro; SLA 2 = fechamento da OS → pedido de compra recebido (não "Fechar OS concluído"); metas 20/30 como constante.
