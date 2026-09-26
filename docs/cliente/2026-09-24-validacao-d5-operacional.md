# D5 — validação operacional em produção

**Data:** 24/09/2026  
**Ambiente:** Hub de produção  
**Obra exclusiva de teste:** OS `TESTE D5`, loja `DPSP Matriz`  
**Regra de segurança:** nenhuma obra real foi salva ou alterada durante o roteiro.

## Resultado do roteiro

| # | Cenário | Resultado | Evidência / limite |
|---|---|---|---|
| 1 | OS nova entra no Hub | **Parcialmente validado** | A OS criada no Field entrou pela sincronização incremental em cerca de 2,5 minutos. O botão manual **Puxar do Field** não foi exercitado. |
| 2 | Ausência vira suspeita e depois alerta | **Não executado** | Exigiria retirar a OS do retorno do Field e aguardar duas varreduras completas com o intervalo mínimo. A obra de teste foi preservada até o encerramento do roteiro. |
| 3 | Retorno ao Field limpa suspeita e alerta | **Não executado em produção** | Depende do cenário de ausência do item 2. A regra continua coberta pelos testes automatizados da entrega dos sete ajustes. |
| 4 | Execução registra status, contagens e marca d'água | **Passou com correção pendente de deploy** | Em 26/09 a tela mostrou execuções incrementais agendadas a cada cinco minutos, todas com status **sucesso** e contagens. A consulta já trazia `marca_dagua_nova`, mas o componente não a exibia. A coluna **Marca d’água** foi acrescentada na branch, com teste de sucesso e de execução sem avanço. |
| 5 | Diário registra “andou” e “não andou”; falta gera tarefa | **Passou** | Foram salvos os dois estados. “Não andou” usou motivo **Falta de material**; “andou” foi salvo com falta de ferramenta. As faltas geraram tarefas. |
| 6 | JPEG sobe e abre; formato inválido é recusado | **Falhou parcialmente na ficha** | JPEG aceito e aberto pelo link **ver a foto do dia**. Arquivo `.txt` recusado com a mensagem **Escolha uma imagem para anexar.** Em 26/09 a ficha contou **1 de 1 dias com foto**, mas a imagem de **Evolução em fotos** apareceu quebrada; atualizar a página não resolveu. O mesmo arquivo abriu normalmente pelo Diário, isolando a falha à exibição incorporada na ficha. |
| 7 | Desfazer remove diário e tarefas abertas na mesma operação | **Passou** | O segundo registro gerou duas tarefas abertas (ferramenta e foto ausente). Um único **Desfazer** devolveu a obra à fila e removeu ambas; a tarefa já respondida permaneceu como histórico, conforme a regra. |
| 8 | Cobrança vai para o dono correto | **Passou** | Material foi para **Compras · Roberta Lima**; ferramenta e foto ausente apareceram com os destinos previstos pela regra. |
| 9 | Resposta grava e aba desatualizada não sobrescreve | **Passou** | A primeira aba gravou `Teste D5: material providenciado para validação.`. A segunda recebeu **Esta tarefa já foi respondida ou não existe. Atualize a página.** e não substituiu a resposta. |
| 10 | Tarefa resolvida sai da lista de abertas | **Passou** | Após a resposta, a tarefa deixou as abertas e apareceu em **Respondidas — a volta que fecha o ciclo**, com data, hora e texto preservados. |

## Outros pontos percorridos

- A obra foi triada e movida de **Levantamento** para **Em andamento** antes de entrar no Diário.
- A ausência de foto numa obra em campo abriu uma tarefa automática, junto com a tarefa da falta de ferramenta.
- O desfazer apagou os registros de diário criados pelo teste. Por isso, ao final, a ficha mostrou **Nenhum dia respondido ainda nesta obra**.
- A tarefa de material respondida permaneceu na ficha como histórico.

## Encerramento do dado de teste

A obra foi cancelada em 24/09/2026 às 16:43 com:

- motivo: **Cancelado pela Manfac**;
- observação: **OS de teste da D5**;
- etapa anterior registrada: **Em andamento**;
- etapa final: **Cancelada · Manfac**.

O histórico da ficha registrou o cancelamento, e o ciclo ficou congelado. Não usar **Desfazer cancelamento**: a obra deve permanecer encerrada como dado de teste.

### Complemento de 26/09/2026

O roteiro final pedido pelo João foi percorrido na mesma obra:

1. **Desfazer cancelamento** passou: a obra voltou de **Cancelada** para **Em andamento** às 17:48, com a linha **Cancelamento desfeito** no histórico.
2. Um novo diário **Andou hoje**, sem falta e com JPEG, foi salvo.
3. O arquivo abriu normalmente por **ver a foto do dia** no Diário.
4. Na ficha, **Evolução em fotos** reconheceu a data e contou **1 de 1 dias com foto**, mas a imagem apareceu quebrada. A falha persistiu depois de atualizar a página.
5. O diário foi desfeito; a ficha voltou a mostrar **Nenhum dia respondido ainda nesta obra**.
6. A obra foi cancelada novamente às 18:01 como **Cancelado pela Manfac**, observação **OS de teste da D5**, a partir de **Em andamento**.

A falha do item 4 está em `app/obras/obra/[id]/**`, área do João. Não houve alteração nesses arquivos.

## Estado ao fechar a D5

1. O teste de a OS sumir em duas varreduras completas e depois reaparecer foi adiado pelo João para depois de 28/09; não faz parte do fechamento desta rodada.
2. A correção que exibe a marca d'água precisa de revisão, merge e deploy para ser conferida em produção.
3. A imagem quebrada em **Evolução em fotos** precisa ser corrigida na frente do João e retestada. O arquivo existe e abre pelo Diário.

A validação operacional desta rodada está concluída. Ficaram um defeito reproduzido e isolado na ficha e uma correção pequena da tela de sincronização pendente de deploy.
