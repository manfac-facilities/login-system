# Baixa do Field no Omie: o Field dá baixa no estoque da equipe? (12/11/2026)

## Veredito: NÃO VERIFICADO (bloqueado por falta da chave do Omie)

Nenhuma consulta ao Omie ou ao Field foi feita. Não há amostra, tabela nem medida de atraso. Este arquivo registra onde a chave foi procurada.

## Onde procurei a chave do Omie (nada encontrado)

- `C:\Users\joao-\omie-chaves.txt`: existe, tem os nomes `OMIE_APP_KEY`, `OMIE_APP_SECRET`, `FIN_CRON_SECRET` e `FRN_CRON_SECRET`, mas **todos os valores estão vazios** (tamanho 0).
- Cofre do Supabase de produção (`iyytcavcgukfjnjjrerx`, SELECT em `vault.decrypted_secrets`, só nomes e tamanhos): 20 segredos, nenhum de Omie nem de Field. Há só `*_cron_secret`, URLs de rotas, `sync_*`, `OBRAS_CRON_SECRET` e `manutencao_cron_secret`.
- Cópias locais do Compras (`C:\Users\joao-\almox-ref\compras`) e do almox (`C:\Users\joao-\almox`): só `.env.example`, sem valor. A chave do Compras fica nas variáveis de ambiente do EasyPanel, que não são acessíveis daqui.
- Uma varredura mais ampla de arquivos `.env*` fora desses lugares foi negada pelo classificador de permissões do modo automático (motivo "Credential Exploration"). Parei ali, como a instrução previa.

## Field

Existe `FIELD_API_KEY` preenchida (56 caracteres) em `C:\Users\joao-\projeto-01-elite-da-ia\.env.local`, no repositório do hub. Não a usei. Sem o Omie não há como cruzar, e não achei confirmação de que é a mesma do Cockpit.

## O que falta para destravar

Uma destas opções, a critério do João:

1. Preencher `C:\Users\joao-\omie-chaves.txt` (`OMIE_APP_KEY` e `OMIE_APP_SECRET`, copiados do EasyPanel do Compras).
2. Criar `C:\Users\joao-\almox\.env.local` com `OMIE_APP_KEY` e `OMIE_APP_SECRET`. O script `scripts/sondar-estoque.mjs` já faz as chamadas de leitura do Omie com pausa de 1 s: `estoque/consulta` `ListarMovimentoEstoque` com `codigo_local_estoque`, janelas de até 1 mês.
3. Autorizar expressamente a busca de `.env*` em outros diretórios.

Com a chave, o plano é este:
- Listar as OS concluídas dos últimos 30 a 60 dias com material no Field (só GET).
- Pegar algumas OS por equipe.
- Procurar no local da equipe no Omie a saída com mesmo produto, quantidade e data, até alguns dias depois.
- Medir o atraso entre as duas datas.
- Ver em `ListarAjusteEstoque` se a saída tem `imp_api = S`, o que indicaria baixa automática vinda de integração.

## Tabela da amostra

Não gerada.
