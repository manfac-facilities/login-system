# Estado da frente — Sistema de Controle de Obras (COP)

Atualizado em 11/09/2026, de manhã. O bloco abaixo é o mais recente; o resto do arquivo é o
histórico de 05/09 em diante, mantido como estava.

## 14/09/2026 — D1 e D2 no ar, D3 decidida, J3 provada

| | |
|---|---|
| Deploy | ✅ build de **14/09 16:53:22 GMT**, 10 chunks no mesmo timestamp. Contém D1 e D2 (último commit de código: merge `b1ef5e9`) |
| Migrations | `obras-fonte` (D1) e `obras-field-reconciliacao` (D2) aplicadas e verificadas em 14/09 |
| Banco | **0 obras**, de propósito |
| `FIELD_API_KEY` | posta no Environment do EasyPanel pelo João antes do deploy. **Não verificado que chegou ao processo** — a tela `/obras/sincronizar` só acusa a falta ao clicar, e clicar grava as 167 OS |
| J3 | provada com a chave local — `j3-verificacao-api-2026-09-14.md`. Aberto: se OS arquivada segue listada e se `GET /orders/:id` traz `archived` |
| D2.1 | ✅ **mergeada** (`03e2a83`, código `3edba98`), 337/337 aqui. Forma simplificada pelo conselho (`conselho-revisao-d21-2026-09-14.md`); conferência de lista fechada sem bloqueador. **Deployada**: build de 14/09 19:36:54 GMT, 10 chunks no mesmo timestamp. Sem migration nova |
| D3 | ✅ **mergeada** (`06aefd9`, código `972945b`), 344/344 aqui; conferência de lista fechada sem bloqueador (`conferencia-d3-2026-09-14.md`). **Não deployada.** Migration `sdd-sql-obras-sync-execucao.sql` aplicada **só até a função da trava** — os dois `cron.schedule` **não foram criados de propósito**: a primeira incremental é a primeira carga das 167 OS e espera a pergunta 06. Segredo gerado em `C:\Users\joao-\.obras-cron-secret` (fora do repo); falta pôr no EasyPanel e, depois da liberação do cliente, no Vault |
| Backlog | `backlog-integracao-field.md` — o que ficou fora pela régua de revisão |

⚠️ **Não apertar "Puxar do Field" em produção**: com a chave no ar, grava as 167 OS. A primeira carga espera o pente fino do cliente e a D2.1.

## 11/09/2026, manhã — a divisão de trabalho foi refeita

**A divisão de 10/09 durou 24 horas.** Duas das frentes que ela atribuía já estavam
entregues quando o dia começou: a F1 (cliente da API do Field) foi executada na própria
noite de 10/09, e a 1c (sincronização) na madrugada de 11/09. O Duda não chegou a começar
— não há branch, PR nem commit do `daduu27`.

**O que redesenhou a divisão** não foi isso, e sim um fato da integração: **a API do Field
traz três campos** (`os`, `loja`, `descricao`). As outras ~30 colunas de `obras_obra`
chegam vazias. Com a planilha fora, a base nasce inteira do Field e nasce incompleta por
construção — o que promove a tela de completar a obra a única porta de entrada de dado
real, e mantém de pé o risco central: sem `aprovacao`, **nenhuma obra vira crítica**.

A divisão nova, com o porquê de cada escolha, está em `divisao-trabalho-joao-duda.md`:
**João** fica com a chave da API (J1), o deploy (J2), provar as incógnitas da API (J3) e
completar a obra (J4, que absorveu a antiga F3); **Duda** vira dono do ciclo de vida da OS
— marcar a origem (D1), a OS que sumiu do Field (D2), a sincronização recorrente (D3) e o
smoke test contra o banco real (D4). As frentes do Duda vivem inteiras em
`app/obras/sincronizar/` e `app/obras/_lib/field/`, sem cruzar com o J4.

**Decisão ainda pendente do João:** o mecanismo da sincronização recorrente (D3). A frente
não começa antes dela.

**Pendência de processo:** o link do artifact está fixado na versão antiga. Republicar não
basta — o pin de compartilhamento precisa ser movido, ou o Duda abre o link e vê a divisão
velha.

## 11/09/2026, madrugada — fechamento da sessão

**O sistema saiu do papel: está no ar, vazio, esperando a primeira OS.** O que a sessão da
noite de 10/09 entregou, tudo verificado por medição:

| | |
|---|---|
| Migration | ✅ aplicada e verificada em produção |
| Push | ✅ 82 commits — e a `Mainsis` virou admin, então **o push deixou de depender do João** |
| Deploy | ✅ build de 10/09 23h38, 10 chunks no mesmo timestamp |
| `/obras` | ✅ responde (307 → login), card 🏗️ no dashboard |
| Obras no banco | **0** — por decisão, não por falha |
| Frente F1 (cliente da API do Field) | ✅ construída, revisada e pushada |
| Frente 1c (sincronização → banco) | ✅ construída e revisada; **falta a chave para provar** |

**Guia publicado para a equipe**, explicando por que a tela vazia não é defeito e o que
cada pendência custa: https://claude.ai/code/artifact/09355e86-fc26-4f4c-873a-e40aadcf98fc

### O que trava a manhã de 11/09, em ordem

1. **A chave da API do Field — validada localmente em 14/09, ainda fora da produção.** A J3
   rodou com ela e passou (`j3-verificacao-api-2026-09-14.md`: autentica, `q`, `sort=id` e
   timestamp completo; 167 OS "Atividade Spot" no Field). Ela ainda precisa ir
   para o `.env.local` da raiz como `FIELD_API_KEY=valor` (para testar — ignorado pelo git;
   é de onde `scripts/verificar-field.mjs` lê. Em 14/09 já havia ali um valor de 56
   caracteres, gravado em 11/09, ainda não validado contra o Field) **e** para o EasyPanel como
   `FIELD_API_KEY=valor` numa linha só (para produção). Sem ela a sincronização não roda
   nem é testada — e três incógnitas da API seguem abertas: se o servidor aceita a
   codificação do `q`, se `sort=id` é campo válido, e se `updated_at>=` aceita timestamp
   completo ou só data. **Qualquer uma delas custa meia hora no pior momento: durante o
   cadastro.**
2. **Deploy da sincronização.** O código está no `master`; a tela `/obras/sincronizar` só
   existe em produção depois de um novo Deploy no EasyPanel.
3. **A tela de completar a obra (1a) não existe** — e o cliente respondeu o que faltava
   para construí-la (feedback 12). Enquanto ela não existir, toda OS sincronizada entra
   sem `aprovacao` e **nunca vira crítica**.

### Dívida de processo assumida nesta sessão

A tela `/obras/sincronizar` foi construída **sem mockup aprovado antes**, por causa do
prazo do cliente. Ela segue o padrão da `/obras/importar`, que já estava aprovada e no ar.
**Foi decisão do Claude, comunicada ao João, e não deve virar precedente** — a regra do
projeto continua sendo mockup antes de código.

---

## 10/09/2026, fim da noite — três decisões do João que mudam o caminho

**1. A planilha NÃO será importada.** Decisão do João, seguindo o cliente: *"o cliente vai
fazer pelo field control [...] ele vai ver o que tem no field e o que tem na planilha para
atualizar o field e puxarmos de lá"*. O **passo 4 do runbook sai do caminho crítico** — a
base do sistema nasce do Field, depois do pente fino de 11/09. A planilha volta a ser o
que sempre foi: o retrato de onde a operação está hoje, insumo do saneamento que o cliente
faz, não carga do sistema.

> **Consequência que vale antecipar:** o parser de importação (`_lib/importacao.ts`, 
> `/obras/importar`) continua construído, testado e no ar, mas **deixa de ter uso
> previsto**. Antes de considerá-lo morto, lembrar que ele é o único caminho de carga em
> massa que existe — se a integração com o Field atrasar, ele é o plano B.

**2. Contas de AMANDA e YURI ficam para depois.** Com a base vindo do Field, não há o que
elas vejam hoje. Os **passos 5 e 6 do runbook saem da fila desta noite** — voltam quando
houver obra no sistema.

**3. O acesso do Duda ao GitHub foi concedido.** Usuário: **`daduu27`**, papel `Write`,
convite criado em 10/09 às 22:59 UTC. ⚠️ **O convite estava PENDENTE de aceite** na
verificação — enquanto ele não aceitar pelo e-mail do GitHub, o push dele falha com 403.
Colaboradores do repositório hoje: `Josemanfac` (admin), `Mainsis` (admin), `daduu27`
(write, pendente).

**Estado do caminho crítico depois disso:** ir ao ar está **concluído** no que dependia de
infraestrutura — migration, push, deploy e módulo no hub. O que resta do runbook (passos
4, 5 e 6) foi adiado por decisão, não por bloqueio. **A frente ativa passa a ser a
integração com o Field.**

---

## 10/09/2026, noite — a migration ENTROU em produção

**O módulo tocou um Supabase real pela primeira vez.** A frase "nada foi testado contra
Supabase real", que abria este arquivo desde 05/09, deixou de valer para o schema.

**O que mudou de fato:**

| | Antes | Agora |
|---|---|---|
| Migration `sdd-sql-obras-v0.sql` | não aplicada em banco nenhum | ✅ **aplicada e verificada** em `iyytcavcgukfjnjjrerx` |
| Bucket `obras-fotos` + policies de storage | não existiam | ✅ criados pela própria migration, **sem** o erro de ownership previsto |
| Acesso do Claude ao banco | nenhum | ✅ Management API com PAT em `C:\Users\joao-\.supabase-pat` (fora do repo) |
| Produção (`/obras`) | 404 | 404 — **inalterado**, o deploy não subiu |
| `master` vs `origin` | 80 commits à frente | 81 commits à frente, **push ainda negado** |

Verificado no banco: 5 tabelas `obras_*` com RLS ligado, 5 policies `obras access`, 3
policies de storage, e `obras_has_access()` = `obras_is_admin()` **ou** linha em
`hub_system_access`. As duas funções usam `exists(...)` — devolvem `true`/`false`, não
NULL. Administrador do hub entra em `/obras` sem linha de acesso nenhuma.

**A decisão de esperar o cliente foi revista pelo João nesta noite:** ele mandou pôr no ar
e liberar o acesso da equipe. A resposta do cliente veio **por áudio** e ele vai enviar a
transcrição — que entra literal em `docs/cliente/` antes de virar decisão, como sempre.

**Dois bloqueios reais, os dois fora do alcance do Claude:**

1. **O push.** `Mainsis` segue com `{"push": false}`. A correção é dar `Admin`/`Write` a
   essa conta em https://github.com/manfac-facilities/login-system/settings/access — a
   mesma tela onde o Duda recebe `Write`. Esse mesmo bloqueio já custou o deploy de 07/09,
   08/09 e 10/09; enquanto ele existir, todo deploy depende do João estar disponível.
2. **Faltam contas no hub.** Cruzando o dump da planilha com `auth.users`: **AMANDA (64
   obras) e YURI (15 obras) não têm login**. São 79 das 82 obras. Liberar o acesso da
   equipe sem convidá-las não tem efeito. `ROBERTA`, que o runbook mandava amarrar, **não
   existe na planilha**; quem existe e faltava na lista é `GABRIEL` e `EDUARDO` (1 obra
   cada). O `RUNBOOK-ir-ao-ar.md` foi corrigido no mesmo commit.

**O auto mode barra escrita em produção e push**, pedindo autorização do João a cada
ação — `[Production Deploy]` e `[Sensitive-Source Provenance]`. Não confundir com falha de
token ou de rede.

---

## 10/09/2026 — entra o Duda, e a espera é pela resposta do cliente

**Decisão do João no fim do dia: o sistema NÃO vai ao ar antes de o cliente responder
as duas perguntas.** Ele retoma o trabalho em 11/09.

> ⚠️ **Nota técnica para quem retomar:** as duas perguntas bloqueiam *liberar o acesso à
> equipe* (passo 5 do runbook), não os passos 1–4. Nesta versão as obras vêm da planilha,
> **e a planilha traz `tipo`, `valor` e `aprovacao`** — o buraco dos campos nulos só
> aparece quando a obra vier do Field. Rodar a migration e deployar sem liberar o slug
> `obras` seria seguro e resolveria o maior risco desconhecido do projeto (nada jamais
> tocou um Supabase real). Ficou como recomendação registrada, não como pendência.

**Estado verificado hoje, por medição e não por memória:**

| | |
|---|---|
| Testes de `app/obras` | **204/204 passando** |
| Build, `tsc`, `eslint` | limpos |
| Migration | **não aplicada em banco nenhum** |
| Produção | build de **26/08**; `/obras` devolve **404** |
| Git | `master` local **80 commits** à frente do `origin` |
| Push | segue negado — `gh api` devolve `{"push": false}` para `Mainsis` |

**Entra um colaborador: o Duda**, fornecedor do João (não da Mainsis, neste projeto).
**Escopo dele: apenas o Controle de Obras**, como teste da parceria. A divisão está em
[`divisao-trabalho-joao-duda.md`](divisao-trabalho-joao-duda.md) e o pacote que a
inteligência dele carrega, em `docs/onboarding-duda/`.

**Dois achados de código que mudam a v1**, os dois verificados por leitura e `grep`:

1. **Quatro colunas nunca são escritas por lugar nenhum** — `os_aprovada`,
   `marco_exec_fim`, `marco_relatorio`, `marco_os_aprov` só existem como campo de tipo em
   `_lib/tipos.ts:222,238-240`. A esteira de etapas lê `marco_exec_fim` para decidir se
   "Execução em campo" está feita: fica congelada para sempre.
2. **A Triagem desaparece quando a obra sai de `definir`** (`page.tsx:103`) — é mais grave
   do que o bloco de 08/09 registrou. Não é só que o bloco "O que veio do Field" é somente
   leitura: é que **depois da triagem não existe tela nenhuma** onde digitar os cinco
   campos que o Field não traz. Nunca mais.

**Uma estimativa deste arquivo estava errada e foi corrigida:** a decisão L ("foto de
evolução por dia na linha do tempo — **tela na v1**") foi lida como pendência, mas **a
foto diária está construída na v0**: `diario/_foto.tsx` com redução antes do upload,
`foto_path`, signed URL de 60 s (`diario/_actions.ts:257`), bloco "Evolução em fotos"
(`_ficha.tsx:627`) e o aviso de dia sem foto (`_ficha.tsx:702`), mais bucket e policies na
migration. **Antes de construir qualquer coisa desta frente, confirme por `grep` que ela
não existe.**

**Duas páginas publicadas hoje:**

- **Perguntas ao cliente** — https://claude.ai/code/artifact/3c47f0d5-586f-4a72-8b21-b3d4a9929825
  Enviada ao cliente em 10/09. Junta a pergunta nova (onde preencher os campos) com a
  **pergunta 03**, feita em 31/08 e nunca respondida. É a resposta destas duas que o
  projeto está esperando.
- **Frentes João × Duda** — https://claude.ai/code/artifact/03377e53-2156-4ae1-8257-4e844e28fc54
  Com os três `.md` de onboarding embutidos para copiar.

**Acessos definidos (ainda não executados):** Supabase — José `Owner`, João
`Administrator`, Duda `Developer` (o único papel que roda SQL e escreve sem poder apagar
projeto). GitHub — José `Owner` da organização, `Mainsis` `Admin` no repositório, Duda
`Write`. Verificado na documentação: "Developer" e "Administrator" **não existem** no
GitHub; os papéis são `Read`/`Triage`/`Write`/`Maintain`/`Admin`, e `Owner` é da
organização, não do repositório.

---

## 08/09/2026 — a obra vem sempre do Field, e a API existe

**Mudança de escopo, vinda do cliente hoje** (literal em
`feedback-07-obra-vem-sempre-do-field.md`):

> O que o sistema vai puxar do Field: Numero da OS, Localização da Loja, Descrição do
> chamado, Todo o restante das informações vamos ter que preencher manualmente

Mais: só as OS com **tipo "Atividade Spot"**, e **o João já tem a chave da API do Field
e a documentação** (https://developers.fieldcontrol.com.br/).

**O "cadastro manual de obra" sai do escopo — nunca foi requisito.** O que houve foi um
mal-entendido de uma palavra, e vale registrar para não voltar: **"manual" no que o
cliente disse é o PREENCHIMENTO DOS CAMPOS, não a CRIAÇÃO da obra.** A obra sempre nasce
no Field; o que é feito à mão é completar os campos que o Field não traz.
`decisoes-para-ir-ao-ar.md` chegou a registrar o oposto ("o cadastro manual é o modo
degradado permanente, e precisa ser tão bom quanto o automático") — está revogado.

**Consequência de código, e é a que importa:** o Field entrega só **três** campos (OS,
loja, descrição). Todo o resto — `tipo`, `valor`, `analista_cliente`, `origem` e,
criticamente, **`aprovacao`** — passa a ser preenchido à mão. Só que hoje **a Triagem
mostra exatamente esse bloco como SOMENTE LEITURA** (`_triagem.tsx:160-180`), porque
assumia que esses dados vinham da planilha. Sem tela onde digitá-los, eles ficam nulos
para sempre — e `aprovacao` nula significa que a obra **nunca vira crítica** e afunda
para o fim da base, que é justamente o mecanismo que originou o projeto (a obra parada
123 dias). **A v1 precisa tornar esse bloco editável na Triagem.** O levantamento que
prova isso está em `inventario-campos-obra.md`.

Duas decisões que isso reabre e que são do cliente, não nossas: a **decisão N** (a base
vem da planilha porque não havia credencial da API) perdeu a premissa; e é preciso
definir o que acontece com as 187 obras que já vieram da planilha quando a sincronização
com o Field entrar.

---

## 08/09/2026 — manhã do treinamento

**O passo a passo de ir ao ar virou documento executável:
[`RUNBOOK-ir-ao-ar.md`](RUNBOOK-ir-ao-ar.md)**, com o SQL de verificação de cada passo
pronto para colar. Ele substitui a lista solta do bloco de 07/09.

**Um bloqueador do treinamento foi encontrado e corrigido hoje:** o slug `obras` não
estava em `lib/sistemas.ts`, a fonte única que alimenta a tela `/admin/acessos` e o
diálogo de convite. O dashboard, o `middleware.ts` e a migration já conheciam `obras`;
só a lista da tela de administração ficou para trás. **Consequência, se ninguém tivesse
visto:** a coluna "Controle de Obras" não apareceria em `/admin/acessos` e não haveria
como liberar o acesso da equipe pela tela — no dia do treinamento. Corrigido; **a
correção só vale depois do deploy**, e é por isso que o passo 5 do runbook vem depois do
passo 3.

**Correção de fato do bloco de 07/09:** criar o bucket `obras-fotos` **não** é passo
manual — a própria migration o cria, com as policies de storage, na seção 4 de
`sdd-sql-obras-v0.sql` (linhas 269-381). A lista de 07/09 abaixo dizia o contrário.

Higiene do repositório no mesmo dia: o `.docx` de feedback que estava solto na raiz desde
31/08 era cópia idêntica (mesmo md5) da que já está em `originais/` e foi removido;
`sistema-os/` foi para o `.gitignore`; o `.mcp.json` foi versionado.

## 07/09/2026 — véspera do treinamento

**Feito neste dia, tudo commitado no `master` local:**

- O branch `copy-aprovada-cliente` virou `master` por fast-forward (69 commits). **O push
  falhou:** a conta do GitHub configurada nesta máquina (`Mainsis`) tem só permissão de
  leitura em `manfac-facilities/login-system` (`gh api` confirma
  `{"push": false}`). Nada saiu daqui — o push é do João.
- **Dois defeitos corrigidos** (commit `3bfc6b3`), os dois só apareceriam no uso real:
  1. `nao_andou_seguidos` e `bloqueada_dias` eram lidos em seis lugares e **nunca
     escritos** — nasciam 0 e ficavam parados. O alerta de "3 dias sem andar", que é o
     mecanismo da decisão C/F, nunca dispararia. Agora são recalculados do histórico do
     diário a cada resposta e a cada desfazer, e o `bloqueio` da obra passa a vir do
     motivo do último registro.
  2. Reimportar a planilha **apagava o que foi digitado no app** (a aba Pipeline manda
     `null` em pcm, equipe, bloqueio e pendência, e o update era cru; status em branco
     ainda devolvia a obra para `definir`). Era o achado deixado em aberto no review de
     05/09. `camposParaAtualizar` resolve: `null` nunca sobrescreve, `etapa` e `mau_uso`
     não se reescrevem.
- **Manual de uso escrito e publicado** — frente E da spec, pedido explícito do cliente no
  feedback 06. Fonte em `manual-uso-v0.md`, página em `manual-uso-v0.html`, artifact em
  https://claude.ai/code/artifact/6ac2cb5a-055e-4812-931a-afad7b3dc8e4 (tem folha de
  impressão embutida: Ctrl+P no navegador gera o PDF).
- 204 testes passando, `tsc`, `eslint` e `npm run build` limpos.

**Uma lacuna encontrada ao escrever o manual, contra a spec §1:**

> A outra lacuna listada aqui em 07/09 era "cadastro manual de obra não existe".
> **Ela deixou de ser lacuna em 08/09: nunca foi requisito.** Ver o bloco de 08/09 no
> topo deste arquivo e `feedback-07-obra-vem-sempre-do-field.md`.

- A ficha diz que "Relatório de entrega" é deduzido do Field automaticamente
  (`_ficha.tsx:213-220`), o que não existe na v0. O manual avisa que essa etapa é movida
  à mão. O texto da tela continua prometendo o que não entrega — corrigir na v1.

**O caminho crítico continua sendo manual e é do João:** rodar
`sdd-sql-obras-v0.sql`, criar o bucket `obras-fotos`, dar push, deployar, importar a
planilha, cadastrar os e-mails em `obras_pessoa` e liberar o slug `obras` em
`/admin/acessos`. Nada disso o Claude consegue fazer sozinho — o MCP do Supabase pede
autorização OAuth e o GitHub recusa o push.

---

Atualizado em 05/09/2026, fim do dia.

## O QUE JÁ ESTÁ CONSTRUÍDO

**A v0 de treinamento está codificada e commitada** no branch `copy-aprovada-cliente`,
nos commits `9405c18` a `adf562e`. Build de produção compila; 189 testes de `app/obras`
passando; `tsc` e `eslint` limpos no módulo.

| Rota | O que é | Frente |
|---|---|---|
| `/obras/base` | Base de obras: tabela + Kanban por fase, 4 filtros, ordenação | B |
| `/obras/obra/[id]` | Ficha da obra + Triagem (quando `etapa = definir`) | B |
| `/obras/diario` | Diário do dia, forma cartões | C |
| `/obras/tarefas` | Tarefas que as faltas geraram | C |
| `/obras/importar` | Carga da planilha, com relatório do descartado | D + sessão principal |

**Nada foi testado contra Supabase real** — a migration não rodou em banco nenhum. Toda a
cobertura é de unidade com mock. O primeiro contato com o banco de verdade vai revelar
coisa; é por isso que rodar o SQL cedo importa.

### Três lacunas que o código encontrou e que a spec não previa

1. **Autoria da troca de etapa** — não havia onde gravar quem mudou a etapa e quando.
   `etapa_por` e `etapa_em` entraram na migration (`812109b`).
2. **Nada ligava a conta do hub à pessoa da planilha.** `obras_obra.pcm` é texto (YURI) e
   quem entra no hub entra por e-mail. Sem isso, cada analista veria o diário VAZIO no
   treinamento. `obras_pessoa` ganhou coluna `email` e `resolverChave` consulta o cadastro
   antes de adivinhar pelo e-mail (`45325d8`). **Os e-mails reais ainda precisam ser
   cadastrados.**
3. **A frente D caiu por limite de gasto da conta**, não por erro. Deixou o parser pronto;
   a tela de importação foi escrita na sessão principal.

## Onde estamos


**MOCKUP v03 APROVADO PELO CLIENTE em 05/09/2026.** O João comunicou a aprovação; o
cliente pontuou algumas coisas "para termos atenção", enviadas por **áudio**. O João
está transcrevendo e vai mandar o texto.

**Aguardando o texto dos áudios** — ele vira `feedback-06-audios-aprovacao.md` nesta
pasta, literal, antes de qualquer interpretação. Só depois disso a spec começa: os
pontos de atenção podem mexer no escopo da v1, e spec escrita antes deles nasce contra
suposição.

O retorno **não veio pelos campos da página nem por comentário no artifact** (conferido
em 05/09: nenhuma thread). Veio por áudio, fora da ferramenta — mais uma evidência de
que o canal confiável é o cliente falando com o João, não a página.

**Artifact da v03 (link novo, para o cliente):**
https://claude.ai/code/artifact/63b26e3e-5e69-45db-b242-c00955e0d202

Publicado como artifact **novo**, de propósito: republicar sobre o link da v02 faria o
cliente continuar vendo a versão antiga até alguém mover a versão compartilhada à mão.
Link novo abre direto na v03.

> ⚠️ **O canal de retorno da página não foi confirmado por teste completo.** Os campos
> aparecem (sinal de que a capability `artifact` foi concedida), e cliques funcionam,
> mas a extensão do Chrome não consegue digitar dentro do iframe do artifact — o teste
> de "digitar, recarregar, conferir" ficou pela metade. Confirmar com uma digitação
> humana antes de confiar nele. O canal que nunca falhou continua sendo o cliente colar
> o retorno no chat.

> ⚠️ **Quem publica o artifact é a sessão principal, nunca um subagente.** Artifact
> publicado por subagente aceita digitação e não salva nada — o canal de retorno só
> existe para a sessão interativa.

> ⚠️ O link compartilhado fica **fixado** na versão compartilhada. Republicar não
> atualiza o que o cliente vê — é preciso mover a versão compartilhada no menu da
> própria página. Isso já causou confusão uma vez.

Artifact da v02: https://claude.ai/code/artifact/258d0a1e-a44a-4d6f-9463-6990f85923be

## Mockup reenviado ao cliente em 05/09

O João mandou o mockup ao cliente de novo em 05/09, depois da aprovação. Provável
motivo: dar à equipe que será treinada na terça a chance de ver a tela antes.

**Consequência de escopo, e é a que importa:** feedback que chegar agora concorre com
uma construção de três dias. O mockup já foi aprovado (feedback 06) — retorno novo entra
como backlog da v1, NÃO como escopo da v0, salvo se apontar algo que impeça o
treinamento de acontecer. Quem decide isso é o João, mas o default é esse.

## Processo — onde estamos na régua

```
brainstorming → mockup v02 ✅ → mockup v03 APROVADO ✅ → pontos de atenção do cliente ⬅ AQUI → spec → plano → código → review → deploy
```

## O que entrou na v03 (feedback 05, recebido em 03/09)

| Decisão | O que é |
|---|---|
| **I** | "Liberado por" + data de liberação, separados da aprovação da OS. Nasce o estado **sem cobertura** — obra executando sem OS e sem ninguém que tenha liberado |
| **J** | Mau uso vira **classificação**, sai de dentro do status e volta para o funil normal |
| **K** | Relatório **deduzido** do Field; "Cobrar aprovação da OS" vira **Pendente fechamento** |
| **L** | Foto de evolução por dia na linha do tempo. **Tela na v1, agente de WhatsApp depois** |

## Decisões do cliente — situação

| # | Assunto | Situação |
|---|---|---|
| 01 | Quem preenche o diário | Opção D — tela como fonte da verdade |
| A | Tabela ou Kanban | as duas |
| B | Formato do diário | as duas |
| C | Travar no 3º "não andou" | sem trava; motivo obrigatório |
| D | Quem define a obra que chega | o Yuri, e ele direciona |
| E | O que perguntar às 9h | dissolvida — ciclo às 18h |
| F | Falta repetida | o aviso não escala, só atualiza |
| G | Quem marca "faturado" | **fechada** — financeiro |
| H | Porte da obra | descartada |
| I | Liberado por + data | fechada — na v03 |
| J | Mau uso como etiqueta | fechada — na v03 |
| K | Relatório derivado | fechada — na v03 |
| L | Foto diária | fechada — tela na v1, agente depois |

## Perguntas em aberto COM O CLIENTE

- **Pergunta 03 — "como calcula esse avanço %?"** Ele perguntou no `.docx` de 31/08 e
  **nunca foi respondida**. Ver `pergunta-03-como-calcula-o-avanco.md`. Hoje o avanço é
  digitado à mão sem regra — a planilha tem `0.9` numa linha e `95` em outra querendo
  dizer a mesma coisa. Proposta: declarado no diário em passos de 10%, com a foto do dia
  como evidência.

## Pendências

- [x] Revisão independente da v03 e publicação do artifact (feita da sessão principal)
- [x] ~~Confirmar se os campos de retorno da página salvam~~ — dispensado na prática: o
      cliente respondeu por áudio ao João. O canal da página nunca foi usado por ele
- [x] **Receber e versionar a transcrição dos áudios de aprovação** (`feedback-06`)
- [x] Manual de uso (frente E) — escrito, publicado e versionado em 07/09
- [ ] Responder a pergunta 03 ao cliente — o texto pronto está em
      `pergunta-03-como-calcula-o-avanco.md`, no fim. Falta só o João mandar
- [ ] **Cadastro de telefone das equipes / prestadores** — trabalho de operação do João.
      Trava o agente de WhatsApp, não trava a v1
- [ ] Campo de liberação na tela de Triagem — citado nas decisões, não estava no brief
- [ ] Link da planilha viva, que o José ficou de mandar por e-mail
- [ ] Só então: spec → plano → código

## Ordem de construção definida pelo cliente na reunião

1. Base de obras (entrada via Field) ⬅ camada 1
2. Dia a dia das obras / diário ⬅ camada 2, é o coração
3. Agente de IA cobrador ⬅ camada 3
4. Dashboard e apresentação para reunião ⬅ camada 4

Zeev fica em **standby**, decisão dele (minuto 38 da reunião).

## Arquivos desta pasta

| Arquivo | O que é |
|---|---|
| `originais/` | Os arquivos como o cliente mandou, incluindo o `.docx` de feedback e suas imagens |
| `transcricao-reuniao-2026-08-31.md` | Transcrição literal da reunião |
| `planilha-dpsp-rev02-dump.txt` | A planilha inteira, célula a célula |
| `feedback-01-docx-cliente-literal.md` | O `.docx` do cliente em texto — fonte da v02 |
| `feedback-01` … `feedback-05` | Os retornos, literais e traduzidos |
| `decisoes-para-ir-ao-ar.md` | As decisões A–H |
| `feedback-05-leitura-e-decisoes.md` | As decisões I–L |
| `pergunta-03-como-calcula-o-avanco.md` | Pergunta do cliente ainda sem resposta |
| `brief-mockup-v03.md` | A especificação da v03 |
| `mockup-obras.html` | **A v03** |
| `mockup-v02-BACKUP-antes-do-feedback-05.html` | A v02 aprovada — baseline |
| `mockup-01-v05-BACKUP-aprovado.html` | Backup anterior |
| `mockup-01-v01-publicada.html` | A v01, recuperada do artifact |
