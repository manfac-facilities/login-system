# Deploy do Gestão de Fornecedores — roteiro

Baseado no deploy real do Compras (levantamento `2026-10-08-levantamento-compras-financeiro.md` §C). Nenhum valor de segredo aqui —
só nomes. Quem clica no EasyPanel é o João ou o cliente (`https://painel.manfac.com.br/`).

## Ordem (cada passo só depois do anterior conferido)

1. **Banco (com OK do João):** aplicar `supabase/hub-install/001…005_frn_*.sql` do repo `fornecedores` e
   `023_fin_integracao_medicoes.sql` do PR financeiro#1, em `iyytcavcgukfjnjjrerx`. Conferir as linhas OK/FALHOU.
   Tabelas novas e vazias; nada existente é alterado. Logo depois: teste de concorrência CA-5.2 no banco real, com dados de teste
   apagados em seguida.
2. **Financeiro:** merge do PR #1 na `main`; na app `financeiro` → Environment, acrescentar
   `FORNECEDORES_INTEGRACAO_SECRET` (≥ 32 caracteres, gerado na hora); Deploy **só do financeiro**.
3. **Fornecedores:** criar a app (ver abaixo), Deploy.
4. **Conferência:** `https://hub.manfac.com.br/fornecedores/api/health` responde `ok`; login cai no `/login` do hub sem sessão;
   Compras, Financeiro e hub continuam abrindo (o João teme que um deploy derrube outro — conferir os três).
5. **Hub:** merge da branch `feat/card-fornecedores` do `login-system` e Deploy do hub (só o card novo muda).

## App `fornecedores` no EasyPanel

- **Projeto:** criar um projeto próprio `fornecedores` (pedido do João: separado). Se o EasyPanel não aceitar a mesma regra de
  domínio `hub.manfac.com.br` vinda de outro projeto, criar a app no projeto `manfac` — o deploy continua isolado (cada app tem
  build e contêiner próprios).
- **Tipo:** App · **Fonte:** GitHub `manfac-facilities/fornecedores`, branch `main` · **Build:** Dockerfile (nunca .zip).
- **Domínio:** host `hub.manfac.com.br`, caminho `/fornecedores`, **HTTPS ligado**, destino **HTTP porta 80**, caminho de destino
  `/fornecedores` (não remover o prefixo). Sem HTTPS no domínio a rota cai no portal do hub (já aconteceu com o Compras).
- **Environment** (todas na aba Environment; as `NEXT_PUBLIC_*` entram no build):

| Nome | Valor |
|---|---|
| `NEXT_PUBLIC_APP_URL` | `https://hub.manfac.com.br/fornecedores` |
| `NEXT_PUBLIC_SUPABASE_URL` | o mesmo do Compras |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | o mesmo do Compras (o build falha sem ela) |
| `SUPABASE_SERVICE_ROLE_KEY` | o mesmo do Compras |
| `FRN_AMBIENTE_CATALOGO` | `producao` |
| `FINANCEIRO_URL` | `https://hub.manfac.com.br` |
| `FORNECEDORES_INTEGRACAO_SECRET` | o MESMO valor posto no financeiro no passo 2 |

- **Healthcheck:** já no Dockerfile, em `/fornecedores/api/health`.

## Confirmar que subiu
Não confiar no painel: conferir `Last-Modified` dos chunks em `https://hub.manfac.com.br/fornecedores` (mesmo método do hub em
`docs/infra/variaveis-e-deploy.md`).
