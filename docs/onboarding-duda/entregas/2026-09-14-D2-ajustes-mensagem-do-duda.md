# D2 — ajustes da revisão, mensagem do Duda

**Recebido em 14/09/2026**, colado no chat pelo João. Resposta à primeira versão da
mensagem de revisão (I1 e I3 antes do merge, I2 fora). Texto literal, sem edição.

> João, fiz os dois ajustes pedidos na D2 e publiquei na branch `duda/field-api-client`,
> commit `2c9a0cf`.
>
> Entraram:
>
> - paginação encerrando somente por página incompleta, sem confiar no `totalCount`;
> - página de `/orders` sem `items` agora interrompe a leitura com erro;
> - disjuntor: retorno de 0 OS ou ausência acima de 20% não marca suspeita/alerta e gera
>   aviso no relatório;
> - etiqueta, filtro e bordas agora exigem presença real de `field_ausente_em`; `undefined`
>   não produz alerta;
> - M1: confirmação somente depois de pelo menos 24 horas, conforme resposta 4A do cliente;
> - M3: `varreduraCompleta` agora é derivada da mesma opção `desde`, sem flag independente;
> - critério de ausência atualizado.
>
> Acrescentei testes para `totalCount` defasado, ausência de `items`, retorno zero,
> disjuntor acima de 20%, intervalo de 24 horas e coluna `undefined`.
>
> Validação em Node 20: 315/315 testes de Obras, TypeScript sem erro, lint sem erro e build
> concluído.
>
> O I2 não foi alterado, conforme você pediu para deixá-lo fora deste merge. Também não
> iniciei a D3; fico aguardando o merge da D2 e a aplicação da migration.
