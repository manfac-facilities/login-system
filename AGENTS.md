# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your
training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code.
Heed deprecation notices.

---

# Hub Manfac — regras do projeto

**Regra zero:** tudo aqui é fato verificado. Não pergunte ao João nada que esteja neste arquivo.
Se um fato daqui estiver desatualizado, **corrija no mesmo commit em que descobrir**.

**Idioma:** responder sempre em português do Brasil.

---

## Fase do projeto e régua de escopo

**Fase declarada em 20/09/2026: entrega ao cliente, com sistema em produção.** Quatro sistemas no
ar com gente usando, e o Controle de Obras com prazo de 28/09.

### A regra padrão

> Faça a **menor mudança** que satisfaz o pedido. Não crie abstração para um único caso de uso —
> inline primeiro; abstraia quando houver 3 ou mais chamadas reais. **Não adicione tratamento de
> erro, fallback, retry ou guarda defensiva que não foram pedidos**, a menos que a entrada seja
> genuinamente não confiável.

Se durante uma etapa você encontrar uma possibilidade de falha que é **improvável e não pedida**,
não pare para tratá-la: **registre em `docs/DIVIDAS.md`** e siga. Perseguir toda borda trava a
etapa, e etapa travada custa prazo.

**O que substitui a varredura de borda é verificação, não descuido.** Se você não consegue provar
que funciona com um teste ou uma consulta, não considere pronto.

### As exceções — aqui se trata a borda mesmo sem pedido

Nestes cinco territórios, falha silenciosa é o erro, e a defesa não é excesso:

1. **RLS e policies** de qualquer tabela
2. **`hub_system_access` e `hub_user_roles`** — controle de acesso
3. **Qualquer escrita que apague ou sobrescreva dado de cliente**
4. **Autenticação e autorização**
5. **Dinheiro** — tudo do módulo Financeiro

O projeto já se machucou exatamente aí: uma guarda de autorização que falhava **aberto** com
`NULL`, e a RLS de `hub_system_access` que ficou aberta até 10/08/2026, permitindo que qualquer
usuário logado se concedesse acesso pelo navegador.

### Quando parar e perguntar

Pare e pergunte ao João quando: a mudança passar de ~20 linhas além do pedido; você precisar
alterar schema; ou o pedido colidir com algo escrito aqui.

---

## Onde está cada regra detalhada

Este arquivo é curto de propósito — ele entra no contexto de **toda** sessão. O detalhe de cada
módulo vive em `.claude/rules/`, que **carrega sozinho** quando um agente abre um arquivo daquela
área. Não copie conteúdo de lá para cá.

| Arquivo | Carrega quando você toca em |
|---|---|
| `.claude/rules/obras.md` | `app/obras/**`, `app/api/obras/**` |
| `.claude/rules/sofia.md` | `app/(operacoes)/sofia/**`, `lib/sofia/**` |
| `.claude/rules/acesso-e-admin.md` | `app/admin/**`, `app/crm/**`, `lib/auth/**`, `lib/supabase/**`, `middleware.ts` |
| `.claude/rules/sql.md` | qualquer `*.sql` |

Outros documentos, para abrir sob demanda:

| Documento | O que tem |
|---|---|
| `docs/infra/variaveis-e-deploy.md` | EasyPanel, variáveis, a armadilha do Environment, como confirmar build |
| `docs/infra/dns-manfac.md` | Registrador, zona, e por que nunca trocar nameserver |
| `docs/DIVIDAS.md` | O que foi deixado passar de propósito, com data e motivo |
| `docs/onboarding-duda/inventario-hub-2026-09-20.md` | Mapa medido do repositório: árvore, exports, arquivos grandes |

---

## Os sistemas do hub

**Nem todos são rotas deste projeto.** Cockpit e Financeiro são apps Next separadas, servidas pelo
proxy no mesmo domínio: no painel usam `<a>` normal em vez de `<Link>`, e **não entram no
`matcher` do `middleware.ts`** — pôr lá quebra o acesso, porque a autorização delas é própria.

| Sistema | Rota | Nome na UI | Slug |
|---|---|---|---|
| Sofia | `/sofia` | **Gestão de Frotas** | `sofia` |
| Conversor de OS | `/conversor-os` | Conversor OS | `conversor-os` |
| Admin | `/admin/acessos` | Admin | — |
| Controle de Obras | `/obras` | **Controle de Obras** | `obras` |
| CRM | `/crm` | CRM | `crm` |
| Cockpit Manutenção Predial | `/cockpit-manutencao` | Cockpit | `dashboard-manutencao` — **app separada** |
| Financeiro | `/financeiro` | **Financeiro** | **sem slug, de propósito** — app separada |

**Financeiro sem slug é decisão, não esquecimento:** qualquer pessoa logada pode pedir um
pagamento, e o porteiro do módulo só exige sessão. Por isso o card fica fora de `hasSystemAccess`
e o sistema não entra em `lib/sistemas.ts`. Usa o mesmo banco, com tabelas `fin_*`.

### Apelidos que já causaram confusão

- **"login-system" = o hub inteiro.** É o nome do repositório e do app no EasyPanel, herdado de
  quando o projeto era só a tela de login.
- **"sistema/módulo de login" na fala do João = `/admin/acessos`**, não a tela de entrada.
- **`manfac-site` é outro app**, com deploy próprio. Em 09/08/2026 foi confundido com o hub ao
  conferir data de deploy, levando à conclusão errada de que o hub não tinha subido.
- **Sofia = Gestão de Frotas.** O código diz um, o cliente diz outro.
- Diretórios da raiz que **não** são o hub: `manfac-site/`, `sistema-os/`, `material manfac/`.

---

## Infra — o mínimo, o resto em `docs/infra/variaveis-e-deploy.md`

- O hub roda no **EasyPanel**, app `manfac-login-system` no projeto `manfac`. Produção:
  `https://hub.manfac.com.br`.
- **Push é livre desta máquina** desde 10/09/2026 — o Claude pusha sozinho. O que ainda barra é o
  auto mode, com `[Sensitive-Source Provenance]` e `[Production Deploy]`: **é trava de permissão
  pedindo autorização do João, não falha de credencial.** Não saia investigando token.
- **Não há webhook de auto-deploy.** Push não sobe nada; alguém precisa clicar em Deploy.
- **Nunca confie no painel para saber se subiu** — confira o `Last-Modified` dos chunks.
- Colaboradores: `Josemanfac` (admin), `Mainsis` (admin), `daduu27` (write — é o Duda).

## Banco de dados — o mínimo, o resto em `.claude/rules/sql.md`

- **Projeto de produção: `iyytcavcgukfjnjjrerx`.** Confirme o ref antes de qualquer escrita.
- **Migrations são manuais.** Não existe CLI. Código mergeado **≠** schema aplicado.
- Escrita em produção passa pelo PAT em `C:\Users\joao-\.supabase-pat`, gravado pelo João.

---

## Convenções de código

- Route groups: `(auth)`, `(dashboard)`, `(operacoes)`.
- Server Actions em `_actions.ts` ao lado da página; formulários em `_form.tsx`; tabelas em
  `_table.tsx`. Prefixo `_` = não vira rota.
- Testes em `__tests__/` ao lado do código que testam.
- Tema: fundo `#0a1628`, navy `#0d2050`, laranja `#f05a28`, texto secundário `#94a3b8`, bordas
  `#1e3a5f`. Tailwind v4.

## Comandos

```bash
npm run dev      # desenvolvimento
npm run build    # build de produção
npm test         # jest
npm run lint     # eslint
```

Node 20 (`.nvmrc`).

> ⚠️ `npm test` na raiz varre também `manfac-site/`, que tem `node_modules` próprio: **7 suites
> falham por resolução de módulo e não são do hub.** O número que importa são as outras 82.

---

## Processo de trabalho com o João

**Nunca pular etapas:** brainstorming → mockup visual aprovado → spec → plano → código → code
review → deploy. **Mockup antes de spec ou código, sempre.**

### Material que o João manda vira arquivo ANTES de ser usado

Lista de ajustes, relatório do cliente, auditoria, feedback, requisito escrito, áudio transcrito —
**salvar literal em `docs/cliente/AAAA-MM-DD-<assunto>.md` e commitar antes de agir sobre o
conteúdo.** Sem resumir, sem "extrair o que importa".

**Por quê:** o chat não é armazenamento. Spec e memória guardam *decisões*; o texto original que as
gerou some quando a sessão acaba, e aí não há como conferir se a decisão traduziu o pedido direito.
Em 21/08 o João foi explícito: perder o material que ele manda custa a confiança dele no sistema
inteiro.

**Vale para `.docx`, PDF, planilha e áudio, não só texto colado.** Em 03/09/2026 um `.docx` de
feedback estava solto na raiz desde 31/08 — e dentro dele havia **uma pergunta do cliente que ficou
três dias sem resposta**. Arquivo que não vira texto versionado é arquivo que ninguém relê.

### Mockups

- **Sempre interativo** quando o pedido envolver animação ou interação. Print não serve para julgar
  hover, scroll ou pulso.
- **Quem publica é a sessão principal, NUNCA um subagente.** Mockup publicado por subagente aceita
  digitação e **não salva nada** — a assinatura de documento vivo só existe para a sessão
  interativa. Subagente desenha; a sessão principal publica.
- **Feedback do cliente vem pelo WhatsApp**, por seção, colado no chat pelo João. É o único canal
  que nunca falhou.
- **Nunca mencionar demissão ou saída de alguém** em mockup, manual ou página de cliente, nem
  indiretamente.

### Outras regras de conduta

- Bug reportado → `superpowers:systematic-debugging` (causa raiz antes do fix).
- Feature nova → `superpowers:brainstorming` antes de planejar.
- **Atue como coordenador de subagentes**, não como executor solitário. Frentes independentes em
  paralelo; o critério de paralelismo é sobreposição de arquivo. Escolha o modelo do subagente
  explicitamente. Quem executa e quem confere nunca são o mesmo agente.
- **Não dispare subagente antes de a decisão que molda o trabalho estar tomada.**
- Perguntas ao João: só quando a resposta muda o que será feito, e nunca sobre fatos deste arquivo.
- **Nunca colar segredos** (service role key, PAT, senhas) no chat ou em arquivo versionado.
