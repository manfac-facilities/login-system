# Almoxarifado — "Fluxo_Almox.pdf" (transcrição literal)

> Recebido do João em 11/11/2026, junto com o pacote
> `2026-11-11-almoxarifado-pacote-para-o-joao.md`. Original ao lado:
> `2026-11-11-almoxarifado-fluxo-almox.pdf`. É um quadro de uma página, com sete caixas.
> Texto copiado como está no quadro, sem correção nem resumo.

## Solicitação de Material → Aprovar a solicitação → Entregar

### Solicitação de Material

- O técnico (equipe) ou o pcm/supervisor solicitam o material
- Se o técnico solicita, supervisor ou pcm aprovam
- A solicitação deve estar vinculada ao contrato de manutenção > cada contrato tem seu estoque no Omie
- Se a solicitação for para Spot/Obras, deve ser colocado o numero da OS na solicitação (isso deve ficar vinculado como custo da obra no sistema de obras)
- O almox recebe a solicitação e separa o material
- A retirada do material só pode ocorrer após aprovação, e deve ser agendada (agendar ao solicitar), para ter tempo habil o agendamento só pode ocorrer para o dia seguinte, desde que a aprovação seja realizada até as 16h, se for depois fica para d+2
- As retiradas de material só podem ocorrer de segunda a sexta até as 10h
- Podem ocorrer retiradas após esse horário, mas serão tratadas como emergencial e ficaram como alertas no sistema
- no caso de retiradas que não envolvam centro de custo da manutençao, a retirada deve ser vinculada à OS, o aprovador que é responsável por informar o número da OS na aprovação, podendo ser mais de 1, nesse caso tem que vincular qual material vai em cada OS ou entao dividir a solicitação
- Só aparecem os produtos selecionados no Omie, e o solicitante só ver os produtos que tem saldo em estoque, se nao houver saldo aparece "cinza" como se fosse "desativado/sem saldo"
- Deve prever integração com Omie/Field

### Aprovar a solicitação

- A solicitação pode ser aprovada total ou parcialmente
- pode também ser alterada e incluída outros produtos pelo aprovador
- o aprovador é o pcm/supervisor

### Entregar

- deve ser gerado um documento de requisição de material
- essa requisição de material deveria ser assinada pelo técnico (hoje é feito manualmente)
- A movimentação de entrega é a transferência do estoque que saiu o material > para o estoque da equipe
- nesse momento deve atualizar o estoque do Field também, permitindo que os produtos estejam disponiveis para o tecnico aplicar nas OS do Field

## "Carga" do colaborador / Controle de Equipamentos

- Lista de itens que estão com o colaborador responsável
- equipamentos, ferramentas, EPI, uniformes
- Deve prever integração com RH, na demissão o Almox precisa confirmar ao RH que recebeu de volta todos os itens da empresa em posse do colaborador, caso contrario esse valor pode ser descontado na rescisão
- Deve permitir devolução ao estoque central: principalmente equipamentos, ex: equipe pega martelete pra usar em uma obra, ao finalizar devolve para o estoque (é frequente essa movimentação)
- Deve permitir colocar equipamentos em estoque "Conserto" quando for para manutenção/assistencia tecnica

## Controle de Posição de Estoque

- Visão em tempo real de todo estoque disponível em cada local, inclusive das equipes
- Consultas ao estoque
- Prever possibilidade de movimentação de estoque pelo sistema, e movimenta no Omie por API
- Alertas de estoque minimo no caso da manutenção (Profarma e DPSP)
- a visão do estoque da equipe precisa ser quase que em tempo real, então precisa prever como isso fica na visão do field após as aplicações de material nas OS
- No caso de obras o material não é aplicado na OS do field, então nesse caso ele deve dar baixa no momento da saída do estoque principal, no caso da manutenção ele deve dar baixa no momento da aplicação do material no field, caso não seja aplicado ele fica no estoque da equipe como disponível
- deve prever alertas de diferença entre o que a equipe tem em estoque x o que ela está solicitando (buscar divergencias caso uma equipe nao tenha aplicado material no field, na verdade consta como disponível mas fisicamente nao está)
- prever integração e informações do omie inclusive custos (CMC) etc
- O painel de estoque das equipes precisa ser "replicado" para o cockpit, criando uma nova aba "Operação" algo assim onde mostre o material das equipes em tempo real, e também mostre o custo do material aplicado por loja (pode ser a principio uma lista com valor, mas depois vamos usar esses dados para saber qual custo estamos tendo em cada loja, qual ranking, qual loja temos mais recorrências de aplicações de materiais etc) e cruzar isso com nossa receita por loja

## Inventário de Estoque

- Prever rotina de inventário do estoque, a principio pode ser trimestral, ideal que seja mensal, mas nunca teve então é um processo a ser implementado
- Inventário também é realizado nos estoques de equipes e ferramental/equipamentos das equipes
- prever movimentações de baixas, perdas, reposições de ferramenta/equipamentos quebrados etc e alertar isso inclusive as diferenças encontradas no fisico x sistema

## Configuração/Parâmetros/Painel

- Prever configuração de Estoque minimo por produto
- Prever painel com alertas de estoque minimo, divergências de saldos etc
- Prever integração do compras/estoque almox dando alertas e informações necessárias (avaliar o que faz sentido)
- Ter um painel pro almoxarife acompanhar os pedidos de material realizados por compras e ele informar o que já foi recebido ou não (existe isso em compras, mas acho que não está sendo feito por lá atualmente)
