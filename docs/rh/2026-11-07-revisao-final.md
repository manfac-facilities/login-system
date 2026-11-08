# Revisão final da junção do RH (`rh-modulos`, HEAD `d3c64db`), 07/11/2026

Revisor independente, sem participação na construção. Clone descartável em `D:\rh-work\rev-final` (de
`D:\rh-work\fix-f1`, checkout `d3c64db`, `node_modules` copiado com `robocopy`). Nada foi alterado na
branch, nada foi gravado em banco real. Régua: só é bloqueio dano de dado alcançável, vazamento, falha
aberta de acesso ou quebra de produção. As revisões por frente (`2026-11-0{6,7}-revisao-*.md`) não
foram repetidas.

## Veredito

**Sem bloqueio. Pode aplicar 005 a 015 e fazer o merge, seguindo o roteiro abaixo.** O que achei vai
para o backlog: são textos e janelas operacionais, nenhum com caminho de dano de dado ou de vazamento
fora do que a spec permite.

## O que rodou

| Verificação | Resultado |
|---|---|
| `node_modules/.bin/tsc --noEmit` | sem erro (exit 0) |
| `node_modules/.bin/vitest run --maxWorkers=2 --testTimeout=60000` | 90 arquivos, 2182 testes: **2181 verdes, 1 vermelho** (`tests/hub-install/012-patrimonio.test.ts:514`), defeito do teste e não do banco (BK7) |
| Postgres real (`embedded-postgres` 18, `D:\rh-work\pg`, pasta de dados própria): 001 a 004, dados, depois 005 a 015 **um arquivo por vez**, como o SQL Editor faz | 11 de 11 sem erro, todas as verificações finais `OK` (ver tabela) |
| Mesmo banco, varredura de acesso: as 86 funções `rh_*` liberadas a `authenticated`, chamadas como `diretoria` e como admin sem papel, com dados semeados em 7 módulos (CID, motivo, CPF, salário marcados) | 307 chamadas por papel; nenhum CID, CPF inteiro, salário para admin nem histórico sensível. Um texto livre aparece (BK1) |

### Migrations em sequência, com dados

Dados antes do 005, gravados pelas funções do 004 (não por `insert` direto): 3 pessoas (CLT, PJ e uma
com vínculo encerrado), papéis `rh` e `diretoria`, competência 11/2026, um salário **enviado e criado
no Financeiro** (`criada`, número 555, chave em uso) e um FGTS por guia em `erro` com a chave em uso.

| Arquivo | Resultado | Verificações finais |
|---|---|---|
| 005 | ok | 14 OK |
| 006 | ok | 14 OK |
| 007 | ok | 9 OK |
| 008 | ok | 12 OK |
| 009 | ok | 11 OK |
| 010 | ok | 10 OK |
| 011 | ok | 16 OK |
| 012 | ok | 14 OK |
| 013 | ok | 15 OK |
| 014 | ok | 12 OK |
| 015 | ok | 19 OK |

- **Nenhum dado perdido nem reprovado.** Contagens e conteúdo de `rh_colaboradores`, `rh_pagamentos`,
  `rh_competencias`, `rh_papeis` e `rh_auditoria` idênticos antes e depois (comparação campo a campo de
  pagamentos e pessoas). Nenhuma constraint ficou `NOT VALID`: as trocas de CHECK do 015 validaram as
  linhas existentes, e são superconjuntos das do 004. O 006 só acrescenta `gestor_id`/`equipe` nulos.
- **Transação e `lock_timeout`:** os 11 arquivos abrem `begin;`, fazem `set_config('lock_timeout',
  '10s', true)` logo em seguida e fecham `commit;` antes da lista de verificação. Cada um tem
  pré-requisitos com `::regprocedure`/`limit 0`, então aplicar fora de ordem falha no começo e desfaz.
- **Fluxo antigo depois de migrado:** regravar o salário já criado devolve `gravado: false` (trava do
  004 intacta); rascunho de salário em competência nova grava; `rh_salvar_colaborador` do 004 agora é
  recusado com `RH_GUARD: isso só muda por uma alteração` (esperado, ver BK3).
- **Fim do banco:** 245 funções `rh_*`; nenhuma executável por `anon`; nenhuma `security definer` sem
  `search_path` e `row_security = off`; nenhuma tabela `rh_*` legível por logado, exceto `rh_papeis`
  (do 001, com RLS e policies, já em produção).

## Funções e gatilhos redefinidos em mais de um arquivo

Busca por `create [or replace] function|trigger` em todos os arquivos. De 005 em diante, só estes se
repetem:

| Objeto | Arquivos | Quem vence | Preserva o anterior? |
|---|---|---|---|
| `rh_salvar_rascunho(text, date, jsonb)` | 004, 015 | 015 | **Sim.** Diff de corpo: o 015 é o 004 com duas adições (alvo `seguro`/`celular` na chave e `rh_pagamento_ligar_mes` para esses dois tipos). Mesma assinatura, mesmo `revoke` de `public, anon, authenticated` e `grant` só a `service_role`. Nada do 011 está dentro desta função: a trava do total da folha é o gatilho `rh_competencia_nao_reabre` em `rh_competencias`, que lê `rh_pagamentos` com `for update` e não foi tocado por ninguém depois |
| `rh_nova_tentativa(text, uuid)` | 004, 015 | 015 | **Sim**, mesmo padrão: 004 + alvo e ligação de mês para seguro/celular. Grants iguais |
| gatilho `rh_arquivos_auditar` | 005 (`create trigger`, `rh_auditar`), 013 (`create or replace trigger`) | 013, com `rh_auditar_sem_texto_de_candidato` | **Sim.** A função do 013 grava os mesmos seis campos de `rh_auditar` (002); só tira `nome_original` quando a classe é `curriculo`. Confirmado no banco real: os dois gatilhos apontam para a função do 013 |
| gatilho `rh_etapas_auditar` | 005, 013 | 013 | **Sim.** Só tira `dados` e `motivo` de passos de `candidato`. Passos de atestado e exame continuam auditados por inteiro, mas `rh_auditoria` só é lida por `rh_obter_colaborador`, filtrada por `registro = id da pessoa`, e o id de etapa nunca é o da pessoa |
| `rh_arquivo_marcar_removido` | só 005 | 005 | Não é redefinida. Em `rh_arquivos` ficam três gatilhos: auditoria (013), `rh_pat_termo_arquivo_guarda` (012, `before update of removido_em`, recusa remover arquivo de termo assinado) e o CHECK `rh_arquivos_curriculo_so_de_candidato` (013). Não se anulam: o do 012 roda antes do `update` da função do 005 e aborta a transação inteira, inclusive o histórico |
| `rh_salvar_colaborador`, `rh_importar`, `rh_obter_colaborador`, `rh_listar_colaboradores`, `rh_salario_no_json` | 002 a 004 | já em produção | Fora do escopo: não mudam em 005 a 015 |

Outros gatilhos novos em tabela de outro arquivo, que não aparecem como redefinição: 006 em
`rh_colaboradores` e `rh_colaborador_rateios` (a regra de ouro), 011 em `rh_competencias` e
`rh_etapas`, 012 em `rh_arquivos`, 013 em `rh_movimentacoes` (admissão cancelada reabre a vaga). Todos
conferidos no banco final; nenhum se sobrepõe a outro.

**Policies:** nenhum arquivo de 005 a 015 cria, troca ou apaga policy, e nenhum faz `drop` de nada. As
tabelas novas ficam com RLS ligada, sem policy e com `revoke all` de `anon, authenticated`: só funções.

## Arquivos resolvidos na mão na junção

- **`lib/arquivos/classes.ts` x SQL.** As três listas (`TIPOS_DE_SAUDE`, `PASSOS_DE_SAUDE`,
  `TIPOS_COM_PASSO`) são as mesmas de `rh_arquivo_registrar` no 005 (teste `005-base.test.ts` compara).
  O mapa ganhou os 13 tipos das frentes; todo `registroTipo` usado em `app/` e `components/` está no
  mapa, e `candidato` → `curriculo` bate com o CHECK do 013. `exame`, `atestado` e `aso` → `saude`.
- **`lib/modulos/registro.ts` e `fontes.ts`:** 13 módulos ligados, uma linha de fonte por módulo, sem
  perda de nenhuma frente.
- **`app/vitrine/[tela]/page.tsx` e `lib/vitrine/dados/index.ts`:** sem chave repetida nem marcador de
  conflito; a vitrine só abre com `RH_VITRINE=1`, senão 404.
- **`docs/DIVIDAS.md`:** só acréscimos, sem linha perdida. Falta o backlog da F6 (BK5).
- **`tests/modulo/moldura.test.ts`: a troca é aceitável.** O laço sobre módulos desligados ficou vazio
  (todos ligados), mas o comportamento continua provado pela segunda asserção, que desliga Férias à mão
  e confere que some da lateral. `registro.test.ts` passou a exigir os 13 na ordem, o que é mais forte
  que antes.

## Acesso entre módulos

A spec 8 diz que `diretoria` **vê** salário e valores, e nunca vê CID, arquivo de saúde nem histórico
sensível; admin sem papel recebe salário nulo, CPF mascarado e não vê atestado nem arquivo. Conferi
contra essa tabela (o pedido desta revisão falava em diretoria sem salário; a spec aprovada diz o
contrário, e segui a spec).

- No SQL, a única leitura de um módulo em tabela de outro (fora da base do 005) é a de
  `rh_movimentacoes` por 009, 010, 011, 013 e 015: id, tipo, nome, vigência e situação, sem valor nem motivo.
- **Teste no banco real:** com atestado com CID, exame encerrado com motivo sensível, contrato PJ,
  segurado, férias e um encerramento concluído com itens em aberto e motivo, chamei as 86 leituras como
  `diretoria` e como admin, com todos os ids existentes. Nenhuma devolveu CID, CPF inteiro, histórico
  sensível nem (para admin) salário. O controle com `rh` recebe tudo, então a busca não passou no vazio.
  Início, busca, agenda, pendências e `abertoComPessoa` chamam essas mesmas funções com a sessão da
  pessoa; nenhuma fonte usa a chave de serviço para ler.
- As leituras que `abertoComPessoa` usa (banco de horas, segurados, celular, pedidos do VR, contratos,
  patrimônio) respondem a `diretoria` e admin sem recusar, então a ficha não mostra "Não deu para
  conferir este módulo" para eles.
- A única coisa que aparece é o **motivo de concluir o encerramento com itens em aberto** (BK1).

## Texto visível

Varri `app/` e `components/` por demiss*, demit*, dispens*, desligament*, rescis*. Só há
identificadores (`status === "desligado"`, campo `desligamento`); o texto mostrado é "Vínculo
encerrado" e "Fim do vínculo" (`lib/colaboradores/rotulos.ts:10`, `components/pessoas/ficha.tsx:119`).
Mensagens `RH_GUARD` de 005 a 015 também limpas. Nenhum texto fala em saída de alguém.

## Ordem de deploy e a pasta `rh-arquivos`

- **Código novo com banco antigo quebra** (as funções de 005 a 015 não existem). Por isso o deploy do
  RH só depois de 015 aplicado.
- **Banco migrado com o código antigo ainda no ar** (a janela entre aplicar e o Deploy): editar ou
  importar pessoa pela tela antiga recusa com `RH_GUARD` (BK3). Falha fechada, nada se grava.
- **Código novo, banco migrado, pasta ainda não criada: nada quebra.** Só subir arquivo recusa, com "A
  pasta de arquivos não está pronta. Avise quem cuida do sistema." (`lib/arquivos/actions.ts:81-85`,
  `getBucket` antes de subir). Listar não depende da pasta; abrir só existe para arquivo já subido;
  nenhuma página lê o storage ao carregar.
- **O que a pasta precisa ser** (cabeçalho do 005, linhas 17-18, e spec 8, "Onde os arquivos ficam"):
  - nome **`rh-arquivos`** (`lib/arquivos/caminho.ts:6`);
  - **privada** (`public = false`); se ficar pública, o servidor recusa toda subida;
  - **nenhuma policy em `storage.objects`** para ela: só a chave de serviço entra; links de 60 s;
  - limite **10 MB** (o servidor corta em 10 485 760 bytes) e tipos **`application/pdf`,
    `image/jpeg`, `image/png`**;
  - criada **no painel do Supabase**, não por migration (o teste de segurança proíbe escrita fora de
    `rh_*`).

## BLOQUEIO

Nenhum.

## BACKLOG

- **BK1. O motivo de concluir o encerramento com itens em aberto chega a `diretoria` e a admin sem papel.**
  `006_rh_pessoas_movimentacoes.sql:1176-1178` grava `motivo_conclusao` e `pendencias_no_fim`, e
  `rh_listar_movimentacoes`/`rh_obter_movimentacao` os devolvem a quem passa em `rh_pode_ver()`.
  Cenário: o RH conclui um encerramento com patrimônio ou seguro em aberto e escreve o porquê; admin do
  hub abre `/movimentacoes/<id>` e lê. A spec 8 não lista este texto como sensível, e os itens trazem só
  "Banco de horas com saldo de 12h", "linha final 1234", "consta na relação de segurados". Não é
  vazamento pela régua, mas é texto livre de uma situação delicada. Sugestão: devolver o motivo só a
  `rh`, como o 005 faz com `rh_etapas.motivo`, ou dizer na tela que diretoria e admin leem.
- **BK2. `pg_cron` no 006.** `006_rh_pessoas_movimentacoes.sql:1669` agenda `rh-aplicar-vigencias`
  dentro da transação. Se a extensão não estiver ligada no projeto do hub, o 006 inteiro falha e desfaz
  (seguro, mas para tudo de 006 em diante). A spec deixou isso em aberto (seção "Produção"). Conferir
  antes, no roteiro.
- **BK3. Janela entre aplicar o 006 e o Deploy.** Com o banco migrado, a tela antiga de editar e
  importar pessoa recusa (`rh_colaboradores_so_por_movimentacao`). Falha fechada; só pede que o Deploy
  venha logo depois do 015.
- **BK4. Limite da pasta no painel.** O painel pode gravar "10 MB" como 10 000 000 bytes, abaixo dos
  10 485 760 que o servidor aceita. Um arquivo entre os dois falha com "Não deu para guardar o arquivo
  agora", mensagem enganosa. Conferir o número no roteiro e aceitar qualquer valor ≥ 10 485 760.
- **BK5. O backlog da revisão da F6 não está em `docs/DIVIDAS.md`** (há F1, F3, F4, F5, F2 e F2.3).
  Copiar a seção BACKLOG de `docs/rh/2026-11-07-revisao-f6.md`.
- **BK6. `tests/modulo/moldura.test.ts:62`:** o laço sobre módulos desligados ficou vazio com tudo
  ligado. Inofensivo (a asserção seguinte prova a regra); pode sair.

- **BK7. `tests/hub-install/012-patrimonio.test.ts:514` falha entre 21h e 0h de Brasília.** O teste espera
  recusa para `current_date - 1`, mas o PGlite roda em UTC: às 21h10 de 07/11, `current_date` já é 08/11,
  `current_date - 1` é 07/11, que é o `rh_hoje()` de Brasília, e a função aceita, com razão. A regra do
  banco (`p_devolver_ate < public.rh_hoje()`) está certa; o teste deve usar `public.rh_hoje() - 1`. Rodei
  a suíte às 21h10. Fora dessa faixa de horário, o teste passa.

## Roteiro exato de aplicação em produção

Projeto **`iyytcavcgukfjnjjrerx`**, SQL Editor. Um arquivo por vez, colado inteiro, de
`supabase/hub-install/` da `rh-modulos` em `d3c64db`. **Qualquer erro ou `*** FALHOU ***`: pare.** Como
cada arquivo é uma transação, um erro desfaz o arquivo inteiro e nada fica pela metade.

**0. Antes de tudo (só leitura):**

```sql
select to_regclass('public.rh_pagamentos') as tem_004,          -- esperado: rh_pagamentos
       to_regclass('public.rh_etapas') as tem_005,              -- esperado: null
       (select count(*) from pg_extension where extname = 'pg_cron') as cron;  -- esperado: 1
select count(*) from public.rh_colaboradores;                   -- anote
select situacao_local, count(*) from public.rh_pagamentos group by 1;  -- anote
select resource, started_at, success from public.v_sync_health order by resource;  -- 4 linhas ok
```

Se `tem_005` não for nulo, alguém já aplicou: pare e confira. Se `cron = 0`, pare antes do 006 (BK2).

**1 a 11. Aplicar, nesta ordem, conferindo a lista final de cada um (todas `OK`):**

| Ordem | Arquivo | Linhas `OK` esperadas | Conferir depois, além da lista |
|---|---|---|---|
| 1 | `005_rh_modulos_base.sql` | 14 | — |
| 2 | `006_rh_pessoas_movimentacoes.sql` | 14 | `select jobname, schedule from cron.job where jobname = 'rh-aplicar-vigencias';` → 1 linha, `5 3 * * *` |
| 3 | `007_rh_agenda.sql` | 9 | — |
| 4 | `008_rh_ferias.sql` | 12 | — |
| 5 | `009_rh_exames.sql` | 11 | — |
| 6 | `010_rh_contratos_pj.sql` | 10 | — |
| 7 | `011_rh_ponto.sql` | 16 | — |
| 8 | `012_rh_patrimonio.sql` | 14 | — |
| 9 | `013_rh_recrutamento.sql` | 15 | — |
| 10 | `014_rh_comunicacao.sql` | 12 | — |
| 11 | `015_rh_beneficios_seguro_celular.sql` | 19 | — |

**12. Depois do 015 (só leitura):**

```sql
select count(*) from public.rh_colaboradores;                   -- igual ao passo 0
select situacao_local, count(*) from public.rh_pagamentos group by 1;  -- igual ao passo 0
select conrelid::regclass, conname from pg_constraint
 where connamespace = 'public'::regnamespace and not convalidated;     -- 0 linhas
select p.oid::regprocedure from pg_proc p
 where p.proname like 'rh\_%' and p.pronamespace = 'public'::regnamespace
   and has_function_privilege('anon', p.oid, 'execute');              -- 0 linhas
select resource, started_at, success from public.v_sync_health order by resource;  -- 4 linhas ok
```

**13. Criar a pasta `rh-arquivos` no painel** (Storage → New bucket): nome `rh-arquivos`; **Public
bucket desligado**; limite de tamanho 10 MB; tipos permitidos `application/pdf, image/jpeg, image/png`.
Não criar policy nenhuma. Conferir:

```sql
select id, public, file_size_limit, allowed_mime_types from storage.buckets where id = 'rh-arquivos';
-- esperado: public = false; file_size_limit >= 10485760 (BK4); os três tipos
select policyname, cmd, roles, qual, with_check from pg_policies
 where schemaname = 'storage' and tablename = 'objects';
-- esperado: nenhuma policy cita 'rh-arquivos' E nenhuma deixa de filtrar bucket_id
```

O segundo `select` importa: uma policy de outro módulo em `storage.objects` **sem** filtro de
`bucket_id` abriria a pasta nova para logados. Se aparecer alguma assim, pare e avise antes de subir
qualquer arquivo.

**14.** `npm run types` e commit de `types/supabase.ts`, como pede o README. **15.** Merge de
`rh-modulos` na `main` do RH e push. **16.** Deploy (João), logo em seguida, para fechar a janela do
BK3. **17.** Conferir o `Last-Modified` dos chunks e abrir um arquivo de teste (PDF pequeno) numa ficha
com o papel `rh`.

## O que não verifiquei

- **Produção.** Não consultei o banco do hub: o estado "001 a 004 aplicados, nenhuma pasta `rh-*`" vem
  de `docs/rh/2026-11-07-para-o-joao.md:31` (consulta de 07/11) e de `supabase/hub-install/README.md`,
  que lista só 001 a 004. Se `pg_cron` existe e se há policy genérica em `storage.objects` ficam para o
  passo 0 e o passo 13 do roteiro.
- O banco de teste é Postgres puro com a imitação mínima do Supabase (`tests/stubs/supabase-minimo.sql`):
  papéis, `auth.jwt()`, `cron.schedule` falso, `storage.buckets` sem policies. O comportamento real do
  `pg_cron` e do Storage (limite, tipos, `getBucket`) não foi exercitado.
- Dados semeados são poucos (3 pessoas, 2 pagamentos antes; 7 módulos na varredura). Volume real e
  linhas antigas fora do que as funções do 004 gravam não foram testados.
- A varredura de acesso usou argumentos simples (ids existentes, hoje, nulo); filtros e textos de busca
  específicos de cada tela não foram combinados.
- App logada, vitrine e build: fora do pedido.
