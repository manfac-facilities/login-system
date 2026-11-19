# Almoxarifado — João autoriza criar os 4 endereços no cofre (19/11/2026)

Texto literal do João no chat:

> cria os 4

Junto, colado por ele, o trecho do arquivo de instruções com os nomes e valores:

```
   Name:   almox_producao_copia_estoque_url
   Secret: https://hub.manfac.com.br/almox/api/tarefas/copia-estoque

   Name:   almox_producao_movimentos_url
   Secret: https://hub.manfac.com.br/almox/api/tarefas/movimentos

   Name:   almox_producao_catalogo_url
   Secret: https://hub.manfac.com.br/almox/api/tarefas/catalogo

   Name:   almox_producao_omie_url
   Secret: https://hub.manfac.com.br/almox/api/tarefas/omie
```

Não autoriza aplicar o SQL 004 nem o 025 (pedem autorização própria). O segredo
`almox_producao_cron_secret` é criado pelo João.
