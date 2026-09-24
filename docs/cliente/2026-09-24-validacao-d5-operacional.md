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
| 4 | Execução registra status, contagens e marca d'água | **Parcialmente validado** | A entrada incremental comprova a execução do ciclo, mas a tela de execuções e a evolução da marca d'água não foram conferidas neste roteiro. |
| 5 | Diário registra “andou” e “não andou”; falta gera tarefa | **Passou** | Foram salvos os dois estados. “Não andou” usou motivo **Falta de material**; “andou” foi salvo com falta de ferramenta. As faltas geraram tarefas. |
| 6 | JPEG sobe e abre; formato inválido é recusado | **Parcialmente validado** | JPEG aceito e aberto pelo link **ver a foto do dia**. Arquivo `.txt` recusado com a mensagem **Escolha uma imagem para anexar.** A exibição dentro da ficha em **Evolução em fotos** não foi conferida antes do desfazer. |
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

## Pendências para fechar a D5

1. Percorrer em produção os itens 2 e 3 com uma OS preparada para desaparecer e reaparecer no Field, sem afetar obra real.
2. Conferir a tela `/obras/sincronizar` para o item 4: status final, contagens e marca d'água.
3. Num futuro registro de teste que não seja desfeito antes da inspeção, confirmar a foto também dentro da ficha, em **Evolução em fotos**.

Nenhuma falha funcional foi encontrada nos caminhos efetivamente executados.
