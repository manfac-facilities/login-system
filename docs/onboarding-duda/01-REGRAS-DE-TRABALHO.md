# Regras de trabalho — Controle de Obras (Manfac)

> Como se trabalha neste projeto. Estas regras não são preferência de estilo: cada uma
> delas existe porque a ausência dela custou tempo ou confiança em algum momento.
>
> Leia junto: `00-CONTEXTO.md` (o produto) e `02-FRENTES-DO-DUDA.md` (o que fazer).

---

## 1. O processo, e ele não tem atalho

```
brainstorming → mockup visual aprovado → spec → plano → código → code review → deploy
```

**Mockup antes de spec ou de código, sempre.** Não se escreve implementação de tela sem
um mockup aprovado antes. Quando a mudança envolver animação, hover ou scroll, o mockup
precisa ser **interativo** — print não serve para julgar interação.

Pular etapa aqui não acelera: já aconteceu de três dias de construção baterem contra um
feedback que um mockup de uma hora teria pego.

**Mockup: quem publica é a sessão principal do Claude, nunca um subagente** — mockup
publicado por subagente aceita digitação e não salva nada. Você entrega o `.html` no
repositório; o João pede a publicação. O feedback do cliente volta pelo WhatsApp, por
seção, colado pelo João — não ponha campos de revisão dentro do mockup.

---

## 1b. A régua de escopo da fase de entrega

Desde 20/09/2026 o projeto está em **fase de entrega ao cliente, com sistema em produção**
(seção "Fase do projeto e régua de escopo" do `AGENTS.md` da raiz). A regra padrão:

> Faça a **menor mudança** que satisfaz o pedido. Não crie abstração para um único caso
> de uso. **Não adicione tratamento de erro, fallback, retry ou guarda defensiva que não
> foram pedidos**, a menos que a entrada seja genuinamente não confiável.

Borda improvável e não pedida **não para a frente**: registre em `docs/DIVIDAS.md` (com
âncora `arquivo:linha`, data, motivo e consequência) e siga. O que substitui a varredura de
borda é **verificação** — se você não prova com teste ou consulta, não está pronto.

**As exceções**, onde a borda se trata na hora mesmo sem pedido: RLS e policies;
`hub_system_access` e `hub_user_roles`; escrita que apaga ou sobrescreve dado de cliente;
autenticação e autorização; dinheiro.

**Onde estão as regras detalhadas:** o `AGENTS.md` foi reorganizado em 20/09 e ficou curto
de propósito. O detalhe de cada módulo vive em `.claude/rules/` e carrega sozinho quando o
agente abre um arquivo daquela área — para você, `.claude/rules/obras.md` (mapa do módulo e
armadilhas da sincronização) e `.claude/rules/sql.md`. O relato do que gerou cada regra
está em `docs/HISTORICO-INCIDENTES.md`.

---

## 2. Antes de escrever, verifique se já existe

Este módulo tem 13.760 linhas em 59 arquivos (sem contar teste), e a documentação de estado nem sempre
acompanhou o código. **Uma estimativa deste projeto já errou por assumir que uma frente
inteira estava pendente quando ela estava construída e testada.**

Antes de começar qualquer frente: `grep` pelo nome da coluna, da função e da rota. Leia o
arquivo. Só então planeje.

---

## 3. Migrations são manuais — código mergeado ≠ schema aplicado

Cada mudança de schema vira um arquivo `sdd-sql-*.sql` na raiz do repositório, que alguém
roda **à mão** no SQL Editor do Supabase. Não existe CLI de migration, não existe
aplicação automática no deploy.

**Consequência prática:** antes de concluir que um bug é de código, verifique se o SQL
correspondente já rodou no banco. Isso já custou uma investigação inteira neste projeto.

**Se você precisar de mudança de schema:** escreva o arquivo `.sql`, deixe-o idempotente,
envolva em `begin`/`commit`, e **avise** — quem roda é o dono do projeto. Não presuma que
rodou.

---

## 4. Duas armadilhas de PL/pgSQL que já morderam aqui

Se você escrever SQL neste projeto, confira as duas:

**a) Trigger compartilhada entre tabelas de colunas diferentes.**
`if TG_TABLE_NAME = 'equipes' and new.ativo is distinct from old.ativo` é **uma** expressão
SQL: `new.ativo` é resolvido contra o registro real quando ela executa, e o `and` **não**
protege. Numa tabela sem essa coluna, levanta `42703 record "new" has no field`. O teste
de tabela tem que ser um `if` **externo**, com o campo aninhado dentro.

Esse bug passou por dois code reviews e uma revisão de segurança sem ser visto, e só
apareceu na primeira escrita real. **SQL só é verificado de verdade rodando.**

**b) Guarda de autorização que falha ABERTO com NULL.**
`if not minha_funcao() then raise` **não dispara** se a função devolver `NULL`
(`NULL in (...)` é `NULL`, não `false`). RLS não expõe isso porque policy trata NULL como
negado. Toda função de autorização aqui tem que devolver `true`/`false` — `exists(...)` já
garante; `in (lista)` precisa de `coalesce(..., false)`.

---

## 5. Convenções de código

| | |
|---|---|
| Server Actions | `_actions.ts` ao lado da página |
| Formulários | `_form.tsx` |
| Tabelas | `_table.tsx` |
| Prefixo `_` | não vira rota |
| Testes | `__tests__/` ao lado do código que testam |
| Route groups | `(auth)`, `(dashboard)`, `(operacoes)` |

**Tema:** fundo `#0a1628`, navy `#0d2050`, laranja `#f05a28`, texto secundário `#94a3b8`,
bordas `#1e3a5f`. Tailwind v4.

**Node 20** (`.nvmrc`).

```bash
npm run dev      # desenvolvimento
npm run build    # build de produção
npm test         # jest
npm run lint     # eslint
```

⚠️ **O `.nvmrc` diz 20, mas em Node 20 o `npx jest` não sobe.** O `jest.config.ts` é
TypeScript, e o Jest 30 só lê isso com o *type stripping* nativo do Node, que existe a
partir do **22.6** — em Node 20 ele cai no `ts-node`, que não estava declarado. Quem
desenvolveu em Node 24 nunca viu o erro; quem seguiu o `.nvmrc` bateu nele de cara.
Descoberto em 11/09/2026 por quem estava entrando no projeto — o comando oficial do
`README` não funcionava na versão de Node que o próprio projeto manda usar.

**Corrigido na frente D1 (commit `1c23dd3`, mergeado em 14/09/2026):** `ts-node` agora é
`devDependency`, o que faz os dois caminhos funcionarem sem mexer no Node do build de
produção. Se você estiver num checkout anterior a esse commit, a saída continua sendo
rodar em **Node 22 ou mais novo**, onde o type stripping é nativo e o `ts-node` nem é
consultado.

**O verde esperado (23/09/2026):** `npx jest app/obras` tem que dar **716 passando + 1 `todo`,
34 suites**. O número cresce a cada frente — confira o do `master` antes de começar. Se você rodar
`npx jest` sem filtro, sete suites de `manfac-site/` vão falhar por dependência não
instalada — isso é conhecido, esperado, **e está fora do seu escopo**.

---

## 6. Escrever código que parece com o código que já está lá

Este módulo tem uma voz própria: comentários que explicam **por que**, não o quê, muitas
vezes citando a decisão ou a linha do mockup que originou aquilo. Exemplo real, do topo de
`diario/_foto.tsx`:

> *"ORDEM QUE NÃO SE INVERTE: a foto sobe para o bucket ANTES de o diário ser gravado. Se
> o upload falhar, o registro não nasce apontando para um arquivo que não existe."*

Siga essa densidade e esse tom. Comentário que só repete a linha de baixo é ruído; o que
guarda a razão de uma escolha é o que faz o próximo leitor não desfazer o trabalho.

---

## 7. Material que vem de fora vira arquivo antes de virar decisão

Lista de ajustes, feedback do cliente, áudio transcrito, requisito escrito, relatório:
**salvar literal em `docs/cliente/` e commitar antes de agir sobre o conteúdo.** Sem
resumir, sem "extrair o que importa".

**Por quê:** o resumo vira spec depois; o arquivo é a fonte, e é o que permite conferir se
a tradução foi fiel. Chat não é armazenamento — quando a sessão acaba, o texto original
some, e aí não há como verificar se a decisão traduziu o pedido direito.

Isso vale para `.docx`, PDF e planilha também, não só para texto colado. Um `.docx` de
feedback ficou solto na raiz do repositório por três dias neste projeto, e dentro dele
havia uma pergunta do cliente que ninguém tinha visto.

---

## 8. Segredos

**Nunca** cole service role key, senha, chave de API ou token em chat, em issue, ou em
arquivo versionado. Sem exceção, nem "só para testar".

A chave da API do Field Control existe e é do dono do projeto. **Você não precisa dela**
para as suas frentes: o código é testável com mock, e a validação em produção (D5) usa as
telas do hub, que já rodam com a chave configurada no servidor.

---

## 9. Git

- Trabalhe em branch, nunca direto no `master`.
- Um commit por unidade lógica, com mensagem que explica **por que**, não só o quê. Olhe
  o histórico do repositório: as mensagens daqui são longas de propósito.
- Não faça `git push --force` em branch compartilhada. Não pule hooks com `--no-verify`.
- Antes de abrir PR: `npm run lint`, `npx tsc --noEmit`, `npx jest app/obras` e
  `npm run build`, os quatro limpos.

---

## 10. Definição de pronto

Uma frente está pronta quando **todas** valem:

- [ ] Os testes existentes continuam passando (716 + 1 `todo` em 23/09), mais os novos que a frente pediu
- [ ] `tsc`, `eslint` e `npm run build` limpos
- [ ] Se mexeu em tela: mockup foi aprovado antes do código
- [ ] Se mexeu em schema: o `.sql` está escrito, idempotente, em `begin`/`commit`, e você
      avisou que precisa ser rodado à mão
- [ ] Nenhuma assinatura pública existente quebrou
- [ ] Code review por alguém que não escreveu o código

**Quem executa e quem confere nunca são a mesma pessoa** — nem o mesmo agente.

**A revisão tem régua:** uma rodada, lista fechada. Só bloqueia o merge o que for **dano de
dado alcançável**; o resto vai para `docs/DIVIDAS.md` e não volta para quem desenvolveu.

---

## 11. Quando perguntar, e quando decidir sozinho

**Pergunte** quando a resposta muda o que será construído: regra de negócio ambígua,
comportamento que o cliente precisa validar, escolha que muda o modelo de dados.

**Decida sozinho** o que é detalhe de implementação: nome de variável, estrutura interna
de função, como organizar um teste. Para esses, siga o código que já está lá em vez de
inventar.

**Nunca** presuma requisito de negócio. Se não está escrito em `00-CONTEXTO.md`, no
`AGENTS.md` da raiz do repositório ou nos documentos de `docs/cliente/`, pergunte. Uma
pergunta custa minutos; trabalho construído contra suposição custa a frente inteira.
