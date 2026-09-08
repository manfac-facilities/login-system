# Estado da frente — Sistema de Controle de Obras (COP)

Atualizado em 08/09/2026. O bloco abaixo é o mais recente; o resto do arquivo é o
histórico de 05/09 em diante, mantido como estava.

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
