# Omie — a listagem de ajustes tem janela padrão de data?

## 19/11/2026 — medição só de leitura

Só `ListarAjusteEstoque` (`https://app.omie.com.br/api/v1/estoque/ajuste/`), 14 chamadas, 2 s de pausa,
chave de produção (não impressa). Nada gravado no Omie nem no banco. Os campos de filtro de data foram
lidos do WSDL: **`data_movimento_de`** e **`data_movimento_ate`** (formato `dd/mm/aaaa`); também existe
`ordenar_por`. O teto de `registros_por_pagina` é **100** (pedir 500 devolveu 100).

| # | Pedido (`param`) | Resposta |
|---|---|---|
| 1 | `{pagina:1, registros_por_pagina:50}` | 200; `total_de_registros` 6988, `total_de_paginas` 140; 1º item `06/03/2026` (INV, ENT); último da pág. 1 `22/03/2026` |
| 2 | `{pagina:140, registros_por_pagina:50}` | 200; 38 itens de `17/11/2026` a `18/11/2026` |
| 3 | `{pagina:139, ...}` | 200; itens de `13/11` a `17/11/2026`; os 4 com `cod_int_ajuste` preenchido (`HUBALXT-TRF-teste-17nov-a`, `-desfaz`, `HUBALXT-V2-1711A`, `HUBALXT-V2-1711B`) estão aqui |
| 4 | `{... apenas_importado_api:"S"}` | 200; 1043 registros, 21 pgs; de `17/08/2026` em diante; nenhum com `cod_int_ajuste` |
| 5 | `{... data_movimento_de:"01/01/2020", data_movimento_ate:"05/03/2026"}` | **500 / 5113** "Não existem registros" — não há nada antes de 06/03/2026 |
| 6 | `{... data_movimento_de:"01/01/2020"}` | 200; mesmos 6988 registros e mesmo 1º item (`06/03/2026`) do pedido 1 |
| 7 | `{... data_movimento_de:"01/11/2026", data_movimento_ate:"30/11/2026", apenas_importado_api:"S"}` | 200; 119 registros (o filtro de data funciona) |
| 8-10 | `apenas_importado_api:"S"`, `registros_por_pagina:100`, págs. 1 a 3 | 200; 300 dos 1043 itens, de `17/08` a `22/09/2026`; 0 com `cod_int_ajuste` |
| 11 | `{cod_int_ajuste:"HUBALXT-V2-1711A", data_movimento_de:"01/01/2020"}` | 200; achou 1 (`17/11/2026`) |
| 12 | `{cod_int_ajuste:"HUBALXT-V2-1711A", data_movimento_de:"18/11/2026"}` | **500 / 5113** — o filtro de data compõe com o de código |



## Conclusão

- **Sem filtro de data, a listagem NÃO usa mês corrente nem janela curta.** O pedido 1 devolve
  ajustes de março a novembro/2026 (8,5 meses) numa só listagem, com o mesmo total (6988) de quando se
  passa `data_movimento_de: 01/01/2020`. O pedido 5 mostra que não existe nada anterior a 06/03/2026 na
  empresa: não há registro "escondido" por janela.
- **Limite da prova:** o único `cod_int_ajuste` preenchido no Omie é dos testes de 17/11 (as demais
  integrações gravam sem código). Não existe ajuste antigo com código para consultar, então o passo 2
  (achar um código de meses atrás) **não pôde ser feito**. Uma janela de 12 meses ou mais não é
  distinguível de "sem janela" com os dados que existem hoje, porque o histórico inteiro tem 8,5 meses.
- **Se houver janela, ela é de pelo menos 8,5 meses.** Para a fila isso é folga grande: a fila só repete
  um código por horas ou dias, nunca meses.

## Correção recomendada no `montarConsultaPorCodigo` (barata, elimina a dúvida)

Mandar o intervalo explícito junto do código, que foi medido e funciona (pedido 11):

```
{ pagina: 1, registros_por_pagina: 50, cod_int_ajuste: codigo,
  data_movimento_de: "01/01/2020" }
```

Nomes exatos: `data_movimento_de` (e `data_movimento_ate`, opcional), formato `dd/mm/aaaa`. Não usar
`data_inicial`/`data_final`. Cuidado: `data_movimento_ate` fixo no passado esconderia o ajuste (pedido 12
mostra que o filtro de data se aplica); então só `de`, sem `ate`. Não é bloqueante: sem a correção, o
comportamento de hoje já cobre pelo menos 8,5 meses.
