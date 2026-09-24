# Comunicado 02 — cancelamento de obra

**Status: RASCUNHO.** O Claude escreve, o João aprova antes de publicar (mesma regra do
comunicado 01, `docs/cliente/2026-09-22-audio-joao-comunicado-de-atualizacoes.md`). Nada foi
inserido no banco, nada foi enviado, nenhum código foi tocado. O banco de produção **não** foi
consultado nesta tarefa; só arquivos locais.

**Fontes:** `docs/cliente/2026-08-31-sistema-controle-de-obras/spec-cancelamento-obra-2026-09-23.md`
(conteúdo) · mockup aprovado `mockup-cancelamento-obra-2026-09-23.html` (texto de tela) · código real
lido na branch `feat/cancelamento-obra` (`_cancelar-obra.tsx`, `_cancelamento.tsx`, `_ficha.tsx`,
`base/_visao.tsx`, `base/_regras.ts`) · `docs/cliente/2026-09-23-comunicado-01-ajustes-da-ficha.md`
(formato e passo de publicação) · `feedback-filtro-comunicado.md` (regra do filtro).

**Uma revisão da spec segue em andamento** (as fotos da obra cancelada podem passar a aparecer em
só leitura, em vez de ficarem fora da ficha). Este comunicado não afirma nada sobre fotos além de
"nada é apagado" — texto que vale nos dois cenários.

---

## 1. Texto pronto para colar

```
sistema: obras

titulo:
Atualização no Controle de Obras: cancelamento de obra

corpo (linha 1):
Agora dá para cancelar uma obra que não vai ser executada: no Ciclo de vida da ficha (ou na Triagem), use o botão "Cancelar obra".

corpo (linha 2):
Só até a obra ainda não ter sido executada em campo — até "Paralisado". Depois de "Relatório de entrega", a obra segue até faturar o que foi feito e não pode mais ser cancelada.

corpo (linha 3):
Ao cancelar, escolha quem cancelou — Cliente ou Manfac — e, se quiser, escreva o que aconteceu. Nada é apagado (diário, fotos, tarefas e histórico continuam na ficha) e dá para desfazer a qualquer momento com "Desfazer cancelamento": a obra volta para a etapa exata em que estava.

corpo (linha 4):
Obra cancelada some do diário, das tarefas abertas e do Kanban. Para vê-la, use o filtro "Canceladas" na Base (todas, pelo Cliente ou pela Manfac).
```

### Como isso renderiza (automático, não é texto separado)

**Faixa** (`faixa-comunicados.tsx:36-37,61,79,87-104`) — linha 1 aparece sempre; linhas 2-4 só ao
clicar "ver o que mudou":

> 🔔 **Atualização no Controle de Obras: cancelamento de obra** `novidade`
> Agora dá para cancelar uma obra que não vai ser executada: no Ciclo de vida da ficha (ou na
> Triagem), use o botão "Cancelar obra".
> [ver o que mudou] [Entendi]
> *(expandido)* • Só até a obra ainda não ter sido executada em campo — até "Paralisado". Depois
> de "Relatório de entrega", a obra segue até faturar o que foi feito e não pode mais ser
> cancelada.
> • Ao cancelar, escolha quem cancelou — Cliente ou Manfac — e, se quiser, escreva o que
> aconteceu. Nada é apagado (diário, fotos, tarefas e histórico continuam na ficha) e dá para
> desfazer a qualquer momento com "Desfazer cancelamento": a obra volta para a etapa exata em que
> estava.
> • Obra cancelada some do diário, das tarefas abertas e do Kanban. Para vê-la, use o filtro
> "Canceladas" na Base (todas, pelo Cliente ou pela Manfac).

**E-mail** (`scripts/enviar-comunicado.mjs:53-71`) — assunto = `titulo`; corpo = as quatro linhas
como itens de lista + botão + rodapé, igual ao comunicado 01.

---

## 2. Por que cada item entra (ou não) — regra: só o que muda na tela / o que a equipe passa a
   poder fazer (`feedback-filtro-comunicado.md`)

| Item da spec | No comunicado? | Por quê |
|---|---|---|
| Botão "Cancelar obra" no Ciclo de vida e na Triagem (C1, C2) | **Entra** (linha 1) | Capacidade nova: a equipe passa a poder encerrar uma obra sem executar. |
| Corte em "obra já executada não cancela" (C3, 2B) | **Entra** (linha 2) | Evita a pergunta de suporte "por que não vejo o botão nesta obra" — quem vai usar precisa saber o limite antes de procurar o botão numa obra fechada. |
| Escolher "Cliente"/"Manfac" + observação opcional (C4) | **Entra** (linha 3) | É a ação que a equipe executa ao cancelar — não dá para descrever "cancelar" sem dizer o que a janela pede. |
| Nada apagado + "Desfazer cancelamento" (C6, C7) | **Entra** (linha 3) | É o que torna a ação seguro de usar sem medo; sem isso a equipe evitaria o botão por precaução. |
| Sumir do diário/tarefas/Kanban + filtro "Canceladas" na Base (C9, C10, C11) | **Entra** (linha 4) | Efeito direto que a equipe vai notar sozinha (a obra "some"); sem a linha, viraria dúvida — "cadê a OS que eu cancelei". |
| "Quem cancelou" no cabeçalho da ficha vira o e-mail de quem clicou, não o nome (spec §2.2) | **Fica de fora** | Detalhe de exibição, não pede nem muda o que a equipe faz. |
| Selo/pílula "Cancelada · Cliente/Manfac" na Base e no cabeçalho (C9, §7.2) | **Fica de fora como item próprio** | Consequência visual de já saber que a obra foi cancelada (linha 4 já cobre "onde achar"); repetir é ruído. |
| Estados Cancelando…/Erro/"Tentar de novo" (C5) | **Fica de fora** | Feedback de UI durante uma ação nova; a própria tela explica se acontecer. |
| Linha no Histórico de alterações ao cancelar/desfazer (C8) | **Fica de fora como item próprio** | Reforço de um recurso que já existe (Histórico); não é ação nova da equipe. |
| Dias "—" e fora de todos os indicadores da Base (C10) | **Fica de fora como item próprio** | Consequência de "some da lista" (linha 4); detalhar cada indicador é excesso — com aviso demais a equipe para de ler. |
| Regras de banco, CHECK, trigger, RPC (seção 3 da spec) | **Fica de fora** | Não é fala de tela, é implementação. |
| Mudança em `tarefas/page.tsx` (área do Duda, C11) | **Fica de fora como item próprio** | Já coberta por "some das tarefas abertas" na linha 4; o destinatário não precisa saber qual arquivo mudou. |

---

## 3. Como publicar quando o João aprovar (nada disto foi executado)

Mesmos quatro passos do comunicado 01 (`.claude/rules/sql.md`, Management API + PAT).

### Passo 1 — inserir o comunicado como rascunho (`publicado_em` nulo)

```bash
TOKEN=$(tr -d '\r\n' < /c/Users/joao-/.supabase-pat)
curl -s -X POST "https://api.supabase.com/v1/projects/iyytcavcgukfjnjjrerx/database/query" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"query":"insert into public.hub_comunicados (sistema, titulo, corpo) values ('\''obras'\'', '\''Atualização no Controle de Obras: cancelamento de obra'\'', '\''Agora dá para cancelar uma obra que não vai ser executada: no Ciclo de vida da ficha (ou na Triagem), use o botão \"Cancelar obra\".\nSó até a obra ainda não ter sido executada em campo — até \"Paralisado\". Depois de \"Relatório de entrega\", a obra segue até faturar o que foi feito e não pode mais ser cancelada.\nAo cancelar, escolha quem cancelou — Cliente ou Manfac — e, se quiser, escreva o que aconteceu. Nada é apagado (diário, fotos, tarefas e histórico continuam na ficha) e dá para desfazer a qualquer momento com \"Desfazer cancelamento\": a obra volta para a etapa exata em que estava.\nObra cancelada some do diário, das tarefas abertas e do Kanban. Para vê-la, use o filtro \"Canceladas\" na Base (todas, pelo Cliente ou pela Manfac).'\'') returning id;"}'
```

Guardar o `id` devolvido.

### Passo 2 — conferir visualmente (rascunho não aparece para ninguém)

```bash
node scripts/enviar-comunicado.mjs <id>
```

Sem `--enviar` é sempre simulação.

### Passo 3 — publicar (só depois dos pré-requisitos da seção 4)

```sql
update public.hub_comunicados set publicado_em = now() where id = '<id>';
```

### Passo 4 — enviar o e-mail

```bash
node scripts/enviar-comunicado.mjs <id> --enviar
```

---

## 4. Pré-requisitos — nenhum publicar antes destes

1. **Migration do banco — já concluída.** `sdd-sql-obras-cancelamento.sql` foi aplicada em
   produção em 23/09 (commit `795bbc1`: 11/11 na verificação, 11/11 no teste com rollback, nada
   gravado). Nenhuma obra está cancelada hoje — o botão é que ainda não existe na tela.
2. **Deploy do código do cancelamento — pendente.** O código está inteiro na branch
   `feat/cancelamento-obra` (`f7d84ee` … `9a0f32a`: faixa de cancelar, ficha da obra cancelada,
   aviso na Base), **ainda não mergeado em `master`**. Falta: code review, merge, push, e o João
   clicar em Deploy no EasyPanel. **Publicar este comunicado antes disso avisa a equipe de um
   botão que ainda não existe na tela** — o mesmo erro que o pré-requisito 2 do comunicado 01
   evitou.
3. **Chave da Resend.** Conferido agora: `C:\Users\joao-\.resend-key` **não existe** nesta
   máquina. Sem ela dá para publicar a faixa, mas não rodar o Passo 4 (mesmo bloqueio do
   comunicado 01 — ainda não resolvido).
4. **DNS/domínio de envio na Resend** (`avisos@manfac.com.br`). Não verificado nesta tarefa (não
   acessei a Resend nem o banco).
5. **Credencial do EasyPanel** segue com o cliente desde 20/09 (mesma trava do comunicado 01) —
   bloqueia o item 2.

**Ordem recomendada:** resolver 5 → merge + deploy do item 2 → só então inserir e publicar →
resolver 3 e 4 antes do Passo 4.
