# Comunicado 01 — ajustes da ficha (rascunho, 23/09/2026)

**Status: RASCUNHO.** O Claude escreve, o João aprova antes de publicar (decisão de 22/09,
`docs/cliente/2026-09-22-audio-joao-comunicado-de-atualizacoes.md`). Nada foi inserido no banco,
nada foi enviado, nenhum código foi tocado.

**Fontes:** `docs/cliente/2026-09-22-audio-joao-comunicado-de-atualizacoes.md` (canal e aprovação
do mockup) · `docs/cliente/2026-09-22-feedback-esteira-e-equipes.md` (pedido do texto livre) ·
`docs/superpowers/specs/2026-09-22-comunicado-atualizacoes-design.md` (spec+plano da faixa/e-mail,
commits `df0a464` e `e892b10`) · `sdd-sql-hub-comunicados.sql` (schema, aplicado em produção em
22/09) · `scripts/enviar-comunicado.mjs` (envio) ·
`docs/cliente/2026-08-31-sistema-controle-de-obras/spec-ajustes-ficha-2026-09-23.md` (conteúdo:
os três ajustes) · `C:\Users\joao-\.claude\...\feedback-filtro-comunicado.md` (regra do filtro).

---

## 1. Texto pronto para colar

Uma linha em `hub_comunicados`. `sistema` decide quem recebe (RLS por
`hub_tem_acesso_sistema`); `titulo` é o assunto do e-mail e o título da faixa; `corpo` é texto
puro, **uma linha por item** (`\n` separa), sem HTML nem markdown — o componente renderiza como
texto literal (`app/obras/_ui/faixa-comunicados.tsx:20-22`, nunca `dangerouslySetInnerHTML`) e o
script escapa tudo (`scripts/enviar-comunicado.mjs:44-51`).

```
sistema: obras

titulo:
Atualização no Controle de Obras: equipe/prestador e data de fechamento da OS

corpo (linha 1):
Equipe/prestador agora aceita texto livre. Revise as obras marcadas "Prestador a contratar" e preencha quem vai executar — no cadastro da obra e no Cronograma.

corpo (linha 2):
Ao concluir "Fechar OS", informe a data real de fechamento da OS (vem preenchida com hoje; dá para corrigir depois). Para obras que já passaram por "Fechar OS" com a data errada, use "corrigir data" no mesmo passo da ficha.
```

### Como isso renderiza (automático, não é texto separado)

**Faixa** (`faixa-comunicados.tsx:36-37,61,79,87-104`) — linha 1 aparece sempre; linha 2 só ao
clicar "ver o que mudou":

> 🔔 **Atualização no Controle de Obras: equipe/prestador e data de fechamento da OS** `novidade`
> Equipe/prestador agora aceita texto livre. Revise as obras marcadas "Prestador a contratar" e
> preencha quem vai executar — no cadastro da obra e no Cronograma.
> [ver o que mudou] [Entendi]
> *(expandido)* • Ao concluir "Fechar OS", informe a data real de fechamento da OS (vem
> preenchida com hoje; dá para corrigir depois). Para obras que já passaram por "Fechar OS" com a
> data errada, use "corrigir data" no mesmo passo da ficha.

**E-mail** (`scripts/enviar-comunicado.mjs:53-71`) — assunto = `titulo`; corpo = **as duas linhas
como itens de lista** (a 1 também vira `<li>`, o script não separa curto/detalhe como a faixa) +
botão + rodapé:

> De: Controle de Obras \<avisos@manfac.com.br>
> Assunto: Atualização no Controle de Obras: equipe/prestador e data de fechamento da OS
>
> • Equipe/prestador agora aceita texto livre. Revise as obras marcadas "Prestador a contratar" e
>   preencha quem vai executar — no cadastro da obra e no Cronograma.
> • Ao concluir "Fechar OS", informe a data real de fechamento da OS (vem preenchida com hoje; dá
>   para corrigir depois). Para obras que já passaram por "Fechar OS" com a data errada, use
>   "corrigir data" no mesmo passo da ficha.
>
> [Abrir o Controle de Obras]
> Você recebeu este e-mail porque tem acesso ao Controle de Obras no Hub Manfac.

Sem limite de tamanho no schema (`sdd-sql-hub-comunicados.sql:132-134`, só `not empty`); os dois
textos acima cabem folgados no `max-w-[70ch]` da faixa e no `max-width:560px` do e-mail.

---

## 2. Por que cada item entra (ou não) — regra: só o que a equipe precisa saber **para
   registrar dado que antes o sistema não deixava** (`feedback-filtro-comunicado.md`)

Os três ajustes da spec (`spec-ajustes-ficha-2026-09-23.md`, seção 2.1):

| Item da spec | No comunicado? | Por quê |
|---|---|---|
| **A7 — equipe/prestador em texto livre** | **Entra** (linha 1) | Antes só dava para escolher de uma lista fechada; quem não estava na lista virava "Prestador a contratar" para sempre. Agora dá para digitar — a equipe **precisa agir**: revisar as obras já marcadas assim e preencher. |
| **A3/A4/A5 — data de fechamento da OS informável e corrigível** | **Entra** (linha 2) | Antes não existia campo: o sistema gravava "hoje" sem chance de mudar, mesmo quando a OS foi fechada no cliente em outro dia, e não havia como corrigir depois. Agora existe os dois — a equipe **precisa agir**: informar a data real ao mudar a etapa, e usar "corrigir data" nas obras que já passaram com data errada. |
| **A1 — renomear a etapa "Pendente fechamento" → "Executado - pendente aprovação OS"** | **Fica de fora** | É rótulo/clareza de tela (corrige a leitura errada de que "Fechar OS" é pulado), mas não é um dado que a equipe passa a poder registrar nem pede ação nenhuma. Mesmo padrão do mockup aprovado em 22/09 (`mockup-comunicado-atualizacoes-2026-09-22.html`), que já ilustrava este exato comunicado com só os dois itens acima. |
| **A2 — selo "sempre existe" e texto do caminho direto** | **Fica de fora** | Mesma razão do A1: reforça leitura da tela, não é ação nem dado novo. |
| **A6 — estados Salvando/Salvo/Erro do seletor** | **Fica de fora** | Feedback de UI durante uma ação que já existe; não é capacidade nova. |
| **Mensagens de validação (data futura, anterior ao relatório/aprovação)** | **Fica de fora como item próprio** | Detalhe de como o campo da linha 2 se comporta, não uma novidade separada — quem tentar uma data inválida vê o erro na hora, não precisa ser avisado antes. |
| **"Tentar de novo" (recuperação de falha parcial, dívida A13)** | **Fica de fora** | Mitigação técnica interna; sem efeito no que a equipe faz, a menos que uma falha realmente aconteça — e aí a própria tela explica. |
| Testes, arquivos tocados, divergências mockup×código (spec seções 7, 9, 10) | **Fica de fora** | Não é fala de tela, é registro de implementação. |

---

## 3. Como publicar quando o João aprovar (nada disto foi executado)

### Passo 1 — inserir o comunicado como rascunho (`publicado_em` nulo)

Via Management API com o PAT, no padrão de `.claude/rules/sql.md` (não existe tela de
administração — spec, linha 11: "Nada de tela de administração"). Colunas em
`sdd-sql-hub-comunicados.sql:130-137`.

```bash
TOKEN=$(tr -d '\r\n' < /c/Users/joao-/.supabase-pat)
curl -s -X POST "https://api.supabase.com/v1/projects/iyytcavcgukfjnjjrerx/database/query" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"query":"insert into public.hub_comunicados (sistema, titulo, corpo) values ('\''obras'\'', '\''Atualização no Controle de Obras: equipe/prestador e data de fechamento da OS'\'', '\''Equipe/prestador agora aceita texto livre. Revise as obras marcadas \"Prestador a contratar\" e preencha quem vai executar — no cadastro da obra e no Cronograma.\nAo concluir \"Fechar OS\", informe a data real de fechamento da OS (vem preenchida com hoje; dá para corrigir depois). Para obras que já passaram por \"Fechar OS\" com a data errada, use \"corrigir data\" no mesmo passo da ficha.'\'') returning id;"}'
```

Guardar o `id` devolvido.

### Passo 2 — conferir visualmente (rascunho não aparece para ninguém: `publicado_em is null`
falha a policy de leitura, `sdd-sql-hub-comunicados.sql:154-160`)

Simular o e-mail sem enviar (spec, `scripts/enviar-comunicado.mjs:1-17,143-148`):

```bash
node scripts/enviar-comunicado.mjs <id>
```

Sem `--enviar` é sempre simulação — imprime destinatários e o e-mail renderizado, não envia nada.

### Passo 3 — publicar (só depois dos pré-requisitos da seção 4)

```sql
update public.hub_comunicados set publicado_em = now() where id = '<id>';
```

Pela mesma Management API. A partir daqui a faixa aparece para quem tem acesso a `obras`
(`hub_tem_acesso_sistema`, `sdd-sql-hub-comunicados.sql:100-119`).

### Passo 4 — enviar o e-mail

```bash
node scripts/enviar-comunicado.mjs <id> --enviar
```

Um e-mail por destinatário (`hub_system_access` do slug `obras` + administradores de
`hub_user_roles`), remetente `avisos@manfac.com.br`. Requer a chave da Resend (pré-requisito 3).

---

## 4. Pré-requisitos — nenhum publicar antes destes

1. **Deploy do código do comunicado (22/09).** `df0a464` e `e892b10` já estão no `master`
   (faixa, actions, script), mas o build de produção **ainda não os tem**: medido agora,
   `https://hub.manfac.com.br/login` devolve chunks com `Last-Modified: Mon, 21 Sep 2026 21:26:51
   GMT` — anterior aos dois commits (22/09, madrugada UTC). Falta o João clicar em Deploy no
   EasyPanel.
2. **Deploy dos ajustes da ficha em si — o CONTEÚDO do comunicado.** Conferido agora por grep:
   `app/obras/_lib/tipos.ts:165` ainda diz `'Pendente fechamento'`, e nenhum arquivo da spec
   (`spec-ajustes-ficha-2026-09-23.md`) foi escrito — só existem spec e plano. Falta: escrever o
   código, revisar, mergear, o João decidir o push, e depois o Deploy. **Publicar este comunicado
   antes disso avisa a equipe de um recurso que ainda não existe na tela** — exatamente o problema
   que o comunicado deveria evitar, ao contrário.
3. **Chave da Resend.** `C:\Users\joao-\.resend-key` não existe nesta máquina (conferido agora).
   Sem ela dá para publicar a faixa (não depende de e-mail), mas não rodar o Passo 4.
4. **DNS/domínio de envio na Resend** (`avisos@manfac.com.br`, zona na Locaweb — `AGENTS.md`).
   Não verificado nesta tarefa (não acessei a Resend). Sem o domínio validado lá, o envio falha ou
   cai em spam.
5. **Credencial do EasyPanel está com o cliente desde 20/09** — bloqueia os itens 1 e 2.

**Ordem recomendada:** resolver 5 → deployar 1 e 2 → só então inserir e publicar → resolver 3 e 4
antes do Passo 4 (a faixa pode subir antes do e-mail funcionar, o e-mail não pode sair antes da
faixa — `erroDePublicacao`, `scripts/enviar-comunicado.mjs:74-79`, já trava isso no script).
