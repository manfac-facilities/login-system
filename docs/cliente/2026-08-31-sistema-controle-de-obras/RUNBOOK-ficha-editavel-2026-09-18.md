# Runbook — pôr a ficha editável no ar

Escrito em 18/09/2026. Alvo: **segunda, 21/09**. Quem executa os passos 1, 2 e 5 é o João;
o Claude faz o 3 e o 4 e confirma o 6.

> **A ordem não é preferência.** Deploy sem as migrations quebra a gravação da ficha;
> migration sem deploy não quebra nada (a ficha continua só leitura, como está hoje).
> Na dúvida, aplique as migrations e adie o deploy — nunca o contrário.

## Passo 1 — chave da Supabase (só o João)

A chave em `C:\Users\joao-\.supabase-pat` **expirou em 18/09** (401; funcionava em 17/09).

1. Dashboard do Supabase → foto do perfil → **Account** → **Access Tokens** → gerar uma nova.
2. Gravar no MESMO arquivo, por um PowerShell seu:
   `Set-Content -NoNewline C:\Users\joao-\.supabase-pat 'sbp_...'`
3. **Nunca pelo `!` do chat** — o `!` traz o comando inteiro, com o valor, para o contexto.

Teste de que voltou (o Claude roda, sem ver o valor): `GET /v1/projects` tem que devolver 200
e listar `iyytcavcgukfjnjjrerx`.

## Passo 2 — aplicar as DUAS migrations, nesta ordem

Nenhuma das duas está em produção.

| Ordem | Arquivo | O que cria |
|---|---|---|
| 1º | `sdd-sql-obras-historico.sql` | `obras_historico` e a RPC `obras_aplicar_alteracao` — **pré-requisito duro** |
| 2º | `sdd-sql-obras-motivos-remarcacao.sql` | `obras_motivo_remarcacao` (6 motivos), `detalhe`/`registrado_por` em `obras_remarcacao`, e a RPC `obras_remarcar_inicio` |

A segunda tem uma **seção 0** que aborta a transação inteira se a primeira não tiver rodado —
ela não deixa nada pela metade. As duas rodam dentro de `begin`/`commit`.

**Verificação, e é objetiva:** a consulta do fim do segundo arquivo devolve **18 linhas, todas
com `OK`**. Qualquer `*** FALHOU ***` é motivo para parar e não deployar.

## Passo 3 — conferir no banco antes do deploy

- As 5 tabelas `obras_*` de sempre, mais `obras_historico` e `obras_motivo_remarcacao`.
- `select count(*) from obras_motivo_remarcacao where criado_por is null` → **6**.
- As 64 obras intactas: `select count(*) from obras_obra` → **64**.

## Passo 4 — deploy (só o João clica)

EasyPanel → projeto `manfac` → app **`manfac-login-system`** → **Deploy**.
Não é o `manfac-site`, que é o site institucional e vive no mesmo projeto.

Este deploy leva junto **dois commits seus de 16/09** que nunca subiram (o card do Financeiro
no painel).

**Confirmação de que subiu** (o Claude faz; não confie no painel nem em "já cliquei"): os
`/_next/static/chunks/*.js` de `https://hub.manfac.com.br/login` têm que ter **todos o mesmo
`Last-Modified`**, posterior ao push. Timestamps misturados = cache velho junto com build novo.

## Passo 5 — teste de fumaça na tela, com obra de verdade (5 minutos)

Nenhum teste automatizado cobre isto. **Antes de avisar a equipe**, em `/obras`:

1. Abrir uma obra em **Aguardando definição** → o quadro "Dados da obra" salva sozinho, sem
   liberar.
2. Abrir uma obra **já liberada** → editar Autorização, salvar, recarregar a página e conferir
   que ficou.
3. **Mudar a data de início** → a janela de remarcação tem que abrir com os 6 motivos. Se ela
   abrir **sem nenhum motivo**, a migration não foi aplicada: pare e volte ao passo 2.
4. Escolher "Outro" → o campo de descrição aparece e é obrigatório.
5. Salvar com a internet cortada → o erro aparece dentro do quadro e **o que foi digitado
   continua lá**.

> ⚠️ Aba aberta antes do deploy dá `Server Reference ID did not match`. Recarregar com
> **Ctrl+Shift+R** resolve. Avise a equipe.

## Passo 6 — liberar para a equipe

Os 4 e-mails já com o slug `obras`: gabriel.lima, gabriel.vidal, luana.silva, yuri.moreira.
Quem mais precisar entra por `/admin/acessos`. Administrador não precisa de liberação.

## O que NÃO entra nesta subida (decidido em 18/09)

- A **tela** do histórico de alterações. O mecanismo grava; a tela fica para depois.
- Os dois contadores de prazo (seção F do desenho) — dependem dos marcos, que ainda não são
  escritos.
- `liberarObraAction` ainda grava pelo caminho antigo, então **a liberação não aparece no
  histórico**. Sem efeito visível hoje, porque a tela do histórico não está no ar. Meia hora de
  trabalho quando a tela entrar.

## Se der errado

- **Erro ao salvar qualquer bloco, logo depois do deploy:** quase certamente migration não
  aplicada. Confira a consulta de verificação do passo 2.
- **Reverter é seguro:** as migrations só acrescentam objetos; o código anterior não os usa.
  Voltar o deploy devolve a ficha a só leitura, sem perder nada do que foi digitado.
