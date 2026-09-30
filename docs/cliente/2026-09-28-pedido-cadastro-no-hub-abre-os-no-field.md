# Pedido do cliente — cadastro começa no hub e abre a OS no Field (28/09/2026)

Mensagem do João no chat, 28/09/2026, literal:

> O cliente pediu para o início do cadastro ser no sistema e via api abrir a os no field, é possível fazer isso com toda nossa estrutura? Assim evita o colaborador preencher 2 plataformas

## Resposta do João à análise de viabilidade (28/09/2026), literal

> Pode criar a os no field, como a teste d5
>
> Pra entender os campos preenchidos reveja as últimas os criadas
>
> A ideia é rodar em paralelo ao dash

## Feedback do cliente sobre o mockup "Nova obra" (30/09/2026), repassado pelo João, literal

> Sobre essa questão da obra obra criada no sistema me tira uma dúvida que tem como a gente fazer ou criar obra direto pelo pelo controle de obras e aí ela cria do field ou se eu tiver obra criada no field  ela vai criar no controle de obras dá pra ser os dois ao mesmo tempo ou é um ou outro
>
> Porque mano eu lembrei de uma coisa que é importante tem casos onde a OS já vai estar no field entendeu tipo  a OS já tava no field porque era uma OS de manutenção e aí a gente botou um orçamento e esse orçamento foi aprovado e virou obra entendeu então nesse caso a OS já vai tá lá então se a gente for abrir num sistema  o field não vai deixar abrir porque vai dar duplicidade entendeu lembrei disso agora aqui

## Decisão do João sobre os dois sentidos (30/09/2026), literal

> Ve isso ai, talvez a melhor opção seja:
> sistema puxa do field as obras
> - ⁠mas tbm da a possibilidade de criar direto pelo sistema;
> - ⁠nesse caso, ao criar a obra e colocar o numero da os ele valida se esse numero ja existe, se existe entao nao deixa criar, se nao existe ai sim ele cria no field.
>
> Importante manter esse fluxo do field para o sistema, e tbm dar a possibilidade de fazer do sistema para o field, caso a obra ajnda nao exista no field (aqui o sistema valida se aquelr numero de os existe no field)
