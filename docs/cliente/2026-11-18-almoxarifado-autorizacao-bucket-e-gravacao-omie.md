# Almoxarifado — autorização do João: bucket e gravação no Omie (18/11/2026)

Resposta do João no chat, em 18/11/2026, texto literal:

> 1 e 2 autorizados

Perguntas a que responde, como foram feitas:

1. **Criar o espaço de arquivos `almox-arquivos`** no banco (onde a assinatura da retirada fica
   guardada). Sem ele a tela de Retirada não funciona.
2. **Ligar a gravação no Omie quando o piloto começar.** Recomendação dada: ligar, porque com ela
   desligada a equipe retira e o saldo no Omie não baixa — o piloto não testaria a parte de maior
   risco. O valor da TRF já foi medido em 17/11; a tela de Falhas existe para mostrar na hora
   qualquer lançamento que não entrar.

Contexto: piloto com 1 equipe quando as telas restantes (Retirada com assinatura e Falhas no Omie)
estiverem no ar (`2026-11-18-almoxarifado-autorizacao-cadastro-manfac-23.md`).

## Execução

- **Item 1 aplicado** em 18/11/2026 (madrugada), banco `iyytcavcgukfjnjjrerx`: SQL
  `024_alx_bucket_arquivos.sql` da branch `retirada` do almox (commit `befe57b`). Conferência:
  1 linha em `storage.buckets` (`almox-arquivos`, `public = false`, 10 MB, png/jpeg/webp/pdf) e
  **0 policies** da pasta em `storage` — só o servidor do almox, com a chave de serviço, lê e grava.
- Item 2 ainda não executado: `GRAVACAO_OMIE_VALIDADA` segue `false` até o piloto começar.
