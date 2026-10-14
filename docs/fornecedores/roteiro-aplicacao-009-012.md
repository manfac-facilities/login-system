# Roteiro de aplicação — Fornecedores 009–012 em produção

**Preparado em 13/10/2026** por um subagente, **sem acesso ao banco de produção** (nem leitura) e sem o PAT.
**Quem executa:** a sessão principal (coordenador), com autorização explícita do João para escrita em produção.
**Fontes:** plano `plano-melhorias-2026-10.md` §4–§6, `revisao-frente-a.md` (rerrevisão, M1 e M5), `.claude/rules/sql.md`,
`deploy-easypanel.md`, `docs/infra/variaveis-e-deploy.md` e os arquivos do repo `manfac-facilities/fornecedores`, branch
`feat/melhorias` em **`72cd044`** (clone em `D:\fornecedores-work\roteiro-banco`).

**Como os SQLs abaixo foram conferidos:** pré e pós-checagens rodaram no PGlite 0.3.16 sobre a imitação do Supabase
(`tests/sql/stubs/supabase-minimo.sql`): instalação 001→008, depois um contrato igual ao CT-0001 (global/manutenção,
`OBRA_MEDICAO_MENSAL`, enviado, condições aprovadas pelo José, contratação pendente), e então 009→012. Resultado: 28/28
linhas de verificação `OK`, foto antes = depois, pós-checagens 21/21 `OK`. A única diferença é a linha "006: carga inicial",
porque o stub tem 2 fornecedores e não 1.226. **Isso foi conferido no PGlite, não no banco real.** No banco real, o texto de
`pg_policies.qual` pode vir formatado de outro jeito. Se só a formatação mudar, compare o sentido.

---

## 0. Antes de tudo: o que será aplicado

| Ordem | Arquivo (no repo `fornecedores`) | Blob git em `72cd044` | Transação |
|---|---|---|---|
| 1 | `supabase/hub-install/009_frn_condicoes_versoes.sql` | `02f67404` | `begin;` … `commit;` (seção 0 de pré-requisitos dentro), verificação **depois** do commit: 12 linhas |
| 2 | `supabase/hub-install/010_frn_fluxo_em_ordem.sql` | `3f79e643` | idem, 6 linhas |
| 3 | `supabase/hub-install/011_frn_modelo_contrato.sql` | `35a9473c` | idem, 6 linhas |
| 4 | `supabase/hub-install/012_frn_avisos.sql` | `9c338e33` | idem, 4 linhas |
| — | `supabase/rollback/009-012-ROLLBACK.sql` (só se for preciso, §4) | `1acfe55f` | idem, 7 linhas |

**Não aplicar o `007_frn_cron_pagamentos.sql`.** Ele continua desligado, à espera das chaves do Omie. Rodá-lo não agenda
nada, mas também não faz parte desta entrega.

**Fixar o commit.** A rodada `feat/melhorias-ajustes` (I-1) ainda vai entrar em `feat/melhorias`. Antes de aplicar, compare
o blob de cada arquivo no commit final:

```bash
REPO=/d/fornecedores-work/roteiro-banco
git -C $REPO fetch -q origin && git -C $REPO checkout -q origin/feat/melhorias   # ou o merge final aprovado
for f in hub-install/009_frn_condicoes_versoes.sql hub-install/010_frn_fluxo_em_ordem.sql \
         hub-install/011_frn_modelo_contrato.sql hub-install/012_frn_avisos.sql rollback/009-012-ROLLBACK.sql; do
  echo "$(git -C $REPO rev-parse HEAD:supabase/$f | cut -c1-8) $f"; done
```

Se algum blob for diferente da tabela, os resultados esperados abaixo **deixam de valer**. Nesse caso, rode de novo a
conferência no PGlite (`npx vitest run tests/sql --no-file-parallelism` ou o CI) e reveja este roteiro antes de aplicar.

### ⚠️ Aplicar a partir do blob do git (LF), nunca do arquivo do working tree

Esta máquina usa `core.autocrlf=true`, então os `.sql` do clone ficam com **CRLF** (o 011 tem 184 `\r`). O texto do modelo v1
da 011 está entre `$modelo$…$modelo$`. Aplicado do working tree, ele seria gravado **com `\r\n`**, diferente do que o CI
testou. Nenhuma linha de verificação da 011 pega isso. Conferido no PGlite: com o arquivo do working tree, o modelo fica
com CR; com `git show`, fica sem. O modelo é imutável, então o erro não se corrige depois com `update`. **Sempre gere o SQL
com `git show <commit>:<caminho>`**, como no comando da §2.

### Como mandar SQL (padrão do `sql.md`; estado de shell não persiste entre chamadas, defina tudo em cada uma)

```bash
TOKEN=$(tr -d '\r\n' < /c/Users/joao-/.supabase-pat)
S="C:/Users/joao-/AppData/Local/Temp/claude/<pasta da sessão>/scratchpad"     # scratchpad da sessão que executa
# $1 = arquivo .sql (LF), $2 = onde gravar a resposta
node -e 'const fs=require("fs");fs.writeFileSync(process.argv[2],JSON.stringify({query:fs.readFileSync(process.argv[1],"utf8")}))' "$1" "$S/q.json"
curl -s -X POST "https://api.supabase.com/v1/projects/iyytcavcgukfjnjjrerx/database/query" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" --data-binary @"$S/q.json" > "$2"
node -e 'console.log(JSON.stringify(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")),null,1))' "$2"
```

A Management API devolve o resultado do **último** comando do texto. Em cada migration o último comando é o `select` de
verificação, e cada SQL de checagem abaixo é um comando só. Em caso de erro, a resposta traz a mensagem do Postgres. Isso
roda como `postgres`, **acima da RLS**.

---

## 1. Pré-checagens (só leitura)

Salve a saída literal de cada uma. A da Pré 5 vai para `docs/fornecedores/revisao-banco-melhorias-antes.json` (§5).

### Pré 1 — o ref é o de produção

```bash
TOKEN=$(tr -d '\r\n' < /c/Users/joao-/.supabase-pat)
curl -s https://api.supabase.com/v1/projects/iyytcavcgukfjnjjrerx -H "Authorization: Bearer $TOKEN" \
  | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const p=JSON.parse(d);console.log(p.id,"|",p.name,"|",p.region,"|",p.status,"|",p.database&&p.database.version)})'
```

**Esperado:** `iyytcavcgukfjnjjrerx | jose.guilherme@manfac.com.br's Project | us-east-1 | ACTIVE_HEALTHY | 17.x`.
Qualquer outro id ou nome: **parar**. `401` significa PAT vencido; o João gera outro.

### Pré 2 — 001–008 aplicadas e pré-requisitos das 009–012

```sql
-- PRÉ 2 — 001–008 aplicadas e pré-requisitos das 009–012 (só leitura)
select checagem, valor, esperado,
       case when valor = esperado then 'OK' else '*** PARAR ***' end as resultado
from (values
  ('001–004: as 10 tabelas frn_ existem',
   (select count(*) from unnest(array['frn_papeis','frn_condicoes','frn_fornecedores','frn_contratos',
     'frn_tabela_precos','frn_aditivos','frn_medicoes','frn_atendimentos','frn_anexos','frn_eventos']) t
     where to_regclass('public.' || t) is not null)::text, '10'),
  ('002: 12 condições no catálogo (pré-requisito da 009)',
   (select count(*) from public.frn_condicoes)::text, '12'),
  ('004: bucket fornecedores-anexos privado',
   (select count(*) from storage.buckets where id = 'fornecedores-anexos' and not public)::text, '1'),
  ('005: frn_dias_pagamento(text,int) existe (a 009 troca pela de 3 argumentos)',
   (to_regprocedure('public.frn_dias_pagamento(text, int)') is not null)::text, 'true'),
  ('006: carga inicial do Omie presente',
   (select count(*) from public.frn_fornecedores where origem = 'carga_inicial')::text, '1226'),
  ('008: frn_enviar_contrato sem "Anexe a proposta comercial" e com "anexe as certidões" (pré-requisito da 009)',
   (pg_get_functiondef('public.frn_enviar_contrato(text, uuid)'::regprocedure) !~ 'Anexe a proposta comercial'
    and pg_get_functiondef('public.frn_enviar_contrato(text, uuid)'::regprocedure) ~ 'anexe as certidões')::text,
   'true'),
  ('auth.users.raw_user_meta_data existe (pré-requisito da 010)',
   (select count(*) from information_schema.columns where table_schema = 'auth' and table_name = 'users'
      and column_name = 'raw_user_meta_data')::text, '1')
) as x(checagem, valor, esperado);
```

**Esperado:** 7 linhas, todas `OK`. A 006 marca a origem `carga_inicial` e não roda de novo, então o número tem de ser
exatamente 1226. A 007 não aparece porque não cria nada.

### Pré 3 — nada das 009–012 existe ainda

```sql
-- PRÉ 3 — nada das 009–012 existe ainda (só leitura)
select checagem, valor, esperado,
       case when valor = esperado then 'OK' else '*** PARAR ***' end as resultado
from (values
  ('tabelas novas: frn_condicoes_versoes, frn_modelos_contrato, frn_avisos',
   (select count(*) from unnest(array['frn_condicoes_versoes','frn_modelos_contrato','frn_avisos']) t
     where to_regclass('public.' || t) is not null)::text, '0'),
  ('colunas novas (8)',
   (select count(*) from information_schema.columns where table_schema = 'public'
      and (table_name, column_name) in (('frn_condicoes','versao'), ('frn_condicoes','atualizado_por'),
           ('frn_condicoes','atualizado_em'), ('frn_contratos','condicao_versao'),
           ('frn_contratos','parcelas_ajustadas'), ('frn_contratos','modelo_versao'),
           ('frn_medicoes','condicao_versao'), ('frn_aditivos','condicao_para_versao')))::text, '0'),
  ('funções novas (10 nomes) + frn_dias_pagamento de 3 argumentos',
   ((select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname in ('frn__imutavel','frn_pode_configurar','frn_salvar_condicao',
        'frn_definir_condicao_ativa','frn__nome','frn_etapa','frn__desc_condicao',
        'frn_alterar_e_aprovar_condicoes','frn_salvar_modelo','frn_registrar_aviso'))
    + (to_regprocedure('public.frn_dias_pagamento(text, int, int)') is not null)::int)::text, '0'),
  ('constraints novas (9 da 009, frn_ct_ordem da 010, 2 da 011)',
   (select count(*) from pg_constraint where connamespace = 'public'::regnamespace and conname in (
      'frn_cv_condicao_fk','frn_condicoes_versao_fk','frn_ct_condicao_versao_fk','frn_ct_condicao_versao',
      'frn_ct_parcelas_ajustadas','frn_md_condicao_versao_fk','frn_md_condicao_versao',
      'frn_ad_condicao_para_versao_fk','frn_ad_condicao_para_versao','frn_ct_ordem',
      'frn_ct_modelo_versao_fk','frn_ct_modelo_gerado'))::text, '0'),
  ('papel configurador ainda não aceito em frn_papeis',
   (pg_get_constraintdef((select oid from pg_constraint where conname = 'frn_papeis_papel_valido'
      and conrelid = 'public.frn_papeis'::regclass)) ~ 'configurador')::text, 'false'),
  ('gatilhos do rollback (frn_*_rb_versao) ausentes',
   (select count(*) from pg_trigger where not tgisinternal and tgname like 'frn\_%rb\_versao')::text, '0')
) as x(checagem, valor, esperado);
```

**Esperado:** 6 linhas, todas `OK`. Se tabela, coluna ou função nova já existir, alguém aplicou parte antes: **parar** e
descobrir o que rodou. As migrations são idempotentes, mas os resultados esperados abaixo partem do zero.

### Pré 4 — estado do CT-0001 (para comparar depois)

```sql
-- PRÉ 4 — estado legível de todos os contratos (esperado: uma linha só, o CT-0001)
select c.numero, c.status, c.tipo, c.classificacao, c.condicao_codigo, c.excecao_dias,
       c.enviado_em, c.contratacao_aprovada_por, c.contratacao_aprovada_em,
       c.condicoes_aprovadas_por, c.condicoes_aprovadas_em, c.aprovado_em, c.devolvido_em,
       c.documento_gerado_em, c.atualizado_em, f.homologado as fornecedor_homologado,
       (select count(*) from public.frn_eventos e where e.contrato_id = c.id) as eventos,
       (select count(*) from public.frn_anexos a where a.contrato_id = c.id) as anexos
  from public.frn_contratos c join public.frn_fornecedores f on f.id = c.fornecedor_id
 order by c.seq;
```

**Esperado (medido em 13/10):** **uma linha só**, `CT-0001`, `aguardando`, `global`, `manutencao`, `OBRA_MEDICAO_MENSAL`,
`excecao_dias` nulo, `enviado_em` preenchido, `contratacao_aprovada_por/_em` **nulos**, `condicoes_aprovadas_por` = e-mail
do José, `condicoes_aprovadas_em` em 11/10, `aprovado_em`, `devolvido_em` e `documento_gerado_em` nulos,
`fornecedor_homologado = true`, `eventos = 3`, `anexos = 1`.

**Parar e falar com o João** (plano §5.3) se houver qualquer um destes:
- outro contrato além do CT-0001;
- CT-0001 em outro status (por exemplo, o Eduardo aprovou nesse meio-tempo e ele ficou `aprovado`);
- aditivo ou medição (as contagens da Pré 5 não podem ser zero).

A migration funcionaria do mesmo jeito, mas os resultados esperados abaixo mudariam.

### Pré 5 — foto antes (hash de cada tabela que as 009–012 alteram)

```sql
-- FOTO — rodar igual ANTES e DEPOIS; as 10 linhas têm de sair idênticas.
-- Hash de cada tabela que as 009–012 alteram, linha inteira, SEM as colunas que elas criam.
select tabela, linhas, hash from (
  select 1 o, 'frn_contratos' tabela, count(*) linhas, md5(coalesce(string_agg(j, '|' order by j), '')) hash
    from (select (to_jsonb(t) - array['condicao_versao','parcelas_ajustadas','modelo_versao'])::text j
            from public.frn_contratos t) s
  union all
  select 2, 'frn_condicoes', count(*), md5(coalesce(string_agg(j, '|' order by j), ''))
    from (select (to_jsonb(t) - array['versao','atualizado_por','atualizado_em'])::text j
            from public.frn_condicoes t) s
  union all
  select 3, 'frn_medicoes', count(*), md5(coalesce(string_agg(j, '|' order by j), ''))
    from (select (to_jsonb(t) - array['condicao_versao'])::text j from public.frn_medicoes t) s
  union all
  select 4, 'frn_aditivos', count(*), md5(coalesce(string_agg(j, '|' order by j), ''))
    from (select (to_jsonb(t) - array['condicao_para_versao'])::text j from public.frn_aditivos t) s
  union all
  select 5, 'frn_eventos', count(*), md5(coalesce(string_agg(j, '|' order by j), ''))
    from (select to_jsonb(t)::text j from public.frn_eventos t) s
  union all
  select 6, 'frn_anexos', count(*), md5(coalesce(string_agg(j, '|' order by j), ''))
    from (select to_jsonb(t)::text j from public.frn_anexos t) s
  union all
  select 7, 'frn_papeis', count(*), md5(coalesce(string_agg(j, '|' order by j), ''))
    from (select to_jsonb(t)::text j from public.frn_papeis t) s
  union all
  select 8, 'frn_atendimentos', count(*), md5(coalesce(string_agg(j, '|' order by j), ''))
    from (select to_jsonb(t)::text j from public.frn_atendimentos t) s
  union all
  select 9, 'frn_tabela_precos', count(*), md5(coalesce(string_agg(j, '|' order by j), ''))
    from (select to_jsonb(t)::text j from public.frn_tabela_precos t) s
  union all
  select 10, 'frn_parcelas_mo(CT-0001)', count(*), md5(coalesce(string_agg(j, '|' order by j), ''))
    from (select to_jsonb(x)::text j
            from public.frn_parcelas_mo((select id from public.frn_contratos where numero = 'CT-0001')) x) s
) f order by o;
```

**Esperado:** 10 linhas. `frn_contratos` 1, `frn_condicoes` 12, `frn_medicoes` 0, `frn_aditivos` 0, `frn_eventos` 3,
`frn_anexos` 1, `frn_atendimentos` 0, `frn_tabela_precos` 0, `frn_parcelas_mo(CT-0001)` 0 (contrato global não tem parcela
de M.O.). `frn_papeis` traz o número de papéis concedidos. Para tabela vazia, o hash é
`d41d8cd98f00b204e9800998ecf8427e`.

Esta foto cobre a linha **inteira** de cada tabela, menos as colunas que as 009–012 criam. É um superconjunto do `hash_ct`
do plano §5.3, que lista 23 colunas, e do teste `fluxo-em-ordem.test.ts` ("CT-0001 de produção").

**Aplique logo depois da foto, num horário sem uso** (à noite). Se alguém usar o app entre a foto e a pós-checagem,
`frn_contratos` e `frn_eventos` mudam por uso legítimo, e a comparação deixa de provar alguma coisa.

---

## 2. Aplicação — ordem e comando

Um arquivo por chamada, nesta ordem, **cada um só depois de ler todas as linhas de verificação do anterior**:

```bash
TOKEN=$(tr -d '\r\n' < /c/Users/joao-/.supabase-pat)
S="C:/Users/joao-/AppData/Local/Temp/claude/<pasta da sessão>/scratchpad"
REPO=/d/fornecedores-work/roteiro-banco
N=009; F=supabase/hub-install/009_frn_condicoes_versoes.sql      # depois 010, 011, 012
git -C $REPO show HEAD:$F > "$S/$N.sql"                             # blob LF (ver §0)
node -e 'const fs=require("fs");fs.writeFileSync(process.argv[2],JSON.stringify({query:fs.readFileSync(process.argv[1],"utf8")}))' "$S/$N.sql" "$S/q.json"
curl -s -X POST "https://api.supabase.com/v1/projects/iyytcavcgukfjnjjrerx/database/query" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" --data-binary @"$S/q.json" > "$S/$N-resp.json"
node -e 'const r=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));if(!Array.isArray(r)){console.log("ERRO:",JSON.stringify(r));process.exit(1)}for(const l of r)console.log(l.resultado,"|",l.invariante);console.log(r.length,"linhas;",r.filter(l=>l.resultado!=="OK").length,"não OK")' "$S/$N-resp.json"
```

| Arquivo | Linhas esperadas | O que a seção 0 confere (aborta a transação se faltar) |
|---|---|---|
| 009 | **12/12 OK** | 008 aplicada (envio sem "Anexe a proposta comercial") e ≥ 12 condições |
| 010 | **6/6 OK** | 009 aplicada; `auth.users.raw_user_meta_data` existe |
| 011 | **6/6 OK** | 010 aplicada (`frn_alterar_e_aprovar_condicoes`, `frn__imutavel`) |
| 012 | **4/4 OK** | 011 aplicada (`frn_modelos_contrato`) |

Total: **28 linhas OK**, o mesmo número que `fluxo-em-ordem.test.ts` exige.

Cada arquivo é **uma transação** (`begin;` … `commit;`). Se a resposta vier com erro, a transação daquele arquivo foi
desfeita inteira, e os arquivos anteriores continuam aplicados. A verificação roda **fora** da transação, depois do commit:
um `*** FALHOU ***` quer dizer que o arquivo **já está gravado**.

---

## 3. Pós-checagens (só leitura)

### Pós 1 — foto depois, idêntica à da Pré 5

Rode exatamente o SQL da Pré 5. **Esperado: as 10 linhas iguais à foto antes**, com mesmo `linhas` e mesmo `hash`. Isso
prova que nenhuma coluna existente de nenhuma linha mudou em `frn_contratos` (inclusive `atualizado_em` do CT-0001),
`frn_condicoes`, `frn_medicoes`, `frn_aditivos`, `frn_eventos`, `frn_anexos`, `frn_papeis`, `frn_atendimentos` e
`frn_tabela_precos`, e que `frn_parcelas_mo` do CT-0001 não mudou. Salvar em
`docs/fornecedores/revisao-banco-melhorias-depois.json`.

### Pós 2 — cada objeto criado ou alterado

```sql
-- PÓS 2 — cada objeto criado/alterado pelas 009–012 (só leitura)
select checagem, valor, esperado,
       case when valor = esperado then 'OK' else '*** PARAR ***' end as resultado
from (values
  -- tabelas
  ('tabelas novas existem (3)',
   (select count(*) from unnest(array['frn_condicoes_versoes','frn_modelos_contrato','frn_avisos']) t
     where to_regclass('public.' || t) is not null)::text, '3'),
  ('RLS ligada nas 3 tabelas novas',
   (select count(*) from pg_class where relrowsecurity and oid in ('public.frn_condicoes_versoes'::regclass,
      'public.frn_modelos_contrato'::regclass, 'public.frn_avisos'::regclass))::text, '3'),
  ('policies das tabelas novas (nome:comando:papel:using)',
   (select string_agg(policyname || ':' || cmd || ':' || array_to_string(roles, ',') || ':' || qual, ' | '
                      order by policyname)
      from pg_policies where schemaname = 'public'
       and tablename in ('frn_condicoes_versoes','frn_modelos_contrato','frn_avisos')),
   'frn_avisos_nada:SELECT:authenticated:false | '
   || 'frn_condicoes_versoes_select:SELECT:authenticated:(( SELECT frn_email() AS frn_email) IS NOT NULL) | '
   || 'frn_modelos_contrato_select:SELECT:authenticated:(( SELECT frn_email() AS frn_email) IS NOT NULL)'),
  ('grants de tabela para anon/authenticated nas novas (tabela:papel:privilégio)',
   (select string_agg(table_name || ':' || grantee || ':' || privilege_type, ' | ' order by table_name, grantee)
      from information_schema.role_table_grants
     where table_schema = 'public' and grantee in ('anon','authenticated')
       and table_name in ('frn_condicoes_versoes','frn_modelos_contrato','frn_avisos')),
   'frn_condicoes_versoes:authenticated:SELECT | frn_modelos_contrato:authenticated:SELECT'),
  ('gatilhos de imutabilidade (2 por tabela de versão)',
   (select count(*) from pg_trigger where not tgisinternal and tgname in ('frn_condicoes_versoes_imutavel',
      'frn_condicoes_versoes_imutavel_truncate','frn_modelos_contrato_imutavel',
      'frn_modelos_contrato_imutavel_truncate'))::text, '4'),
  ('gatilhos do rollback ausentes',
   (select count(*) from pg_trigger where not tgisinternal and tgname like 'frn\_%rb\_versao')::text, '0'),
  -- colunas
  ('colunas novas com o tipo certo (tabela.coluna:tipo:nulável)',
   (select string_agg(table_name || '.' || column_name || ':' || data_type || ':' || is_nullable, ' | '
                      order by table_name, column_name)
      from information_schema.columns where table_schema = 'public'
       and (table_name, column_name) in (('frn_condicoes','versao'), ('frn_condicoes','atualizado_por'),
            ('frn_condicoes','atualizado_em'), ('frn_contratos','condicao_versao'),
            ('frn_contratos','parcelas_ajustadas'), ('frn_contratos','modelo_versao'),
            ('frn_medicoes','condicao_versao'), ('frn_aditivos','condicao_para_versao'))),
   'frn_aditivos.condicao_para_versao:integer:YES | frn_condicoes.atualizado_em:timestamp with time zone:YES | '
   || 'frn_condicoes.atualizado_por:text:YES | frn_condicoes.versao:integer:NO | '
   || 'frn_contratos.condicao_versao:integer:YES | frn_contratos.modelo_versao:integer:YES | '
   || 'frn_contratos.parcelas_ajustadas:jsonb:YES | frn_medicoes.condicao_versao:integer:YES'),
  -- constraints
  ('constraints novas validadas (9 da 009 + 2 da 011)',
   (select count(*) from pg_constraint where convalidated and connamespace = 'public'::regnamespace
       and conname in ('frn_cv_condicao_fk','frn_condicoes_versao_fk','frn_ct_condicao_versao_fk',
         'frn_ct_condicao_versao','frn_ct_parcelas_ajustadas','frn_md_condicao_versao_fk','frn_md_condicao_versao',
         'frn_ad_condicao_para_versao_fk','frn_ad_condicao_para_versao','frn_ct_modelo_versao_fk',
         'frn_ct_modelo_gerado'))::text, '11'),
  ('frn_ct_ordem existe e está NOT VALID (D1: CT-0001 intocado)',
   (select count(*) from pg_constraint where conname = 'frn_ct_ordem' and not convalidated
       and conrelid = 'public.frn_contratos'::regclass)::text, '1'),
  ('frn_papeis aceita configurador; frn_eventos aceita condicoes_alteradas',
   ((select pg_get_constraintdef(oid) from pg_constraint where conname = 'frn_papeis_papel_valido'
       and conrelid = 'public.frn_papeis'::regclass) ~ 'configurador'
    and (select pg_get_constraintdef(oid) from pg_constraint where conname = 'frn_eventos_tipo_check'
       and conrelid = 'public.frn_eventos'::regclass) ~ 'condicoes_alteradas')::text, 'true'),
  -- funções
  ('frn_dias_pagamento: só a de 3 argumentos',
   ((to_regprocedure('public.frn_dias_pagamento(text, int)') is null)
    and (to_regprocedure('public.frn_dias_pagamento(text, int, int)') is not null))::text, 'true'),
  ('24 funções novas/alteradas existem',
   (select count(*) from unnest(array[
      'public.frn_tem_algum_papel(text)', 'public.frn_pode_configurar(text)',
      'public.frn_dias_pagamento(text, int, int)', 'public.frn_parcelas_mo(uuid)',
      'public.frn_salvar_contrato(text, uuid, jsonb)',
      'public.frn_criar_aditivo(text, uuid, text, text, numeric, text, text, text, text, int)',
      'public.frn_aprovar_aditivo(text, uuid, text)', 'public.frn_devolver_aditivo(text, uuid, text, text)',
      'public.frn_registrar_atendimento(text, uuid, date, text, numeric)', 'public.frn_solicitar_medicao(text, jsonb)',
      'public.frn_registrar_solicitacao_fin(uuid, text, date, text, uuid, int)',
      'public.frn_salvar_condicao(text, text, int, jsonb)', 'public.frn_definir_condicao_ativa(text, text, int, boolean)',
      'public.frn__nome(text)', 'public.frn_etapa(public.frn_contratos)',
      'public.frn__desc_condicao(text, int, jsonb, int)', 'public.frn_alterar_e_aprovar_condicoes(text, uuid, jsonb)',
      'public.frn_enviar_contrato(text, uuid)', 'public.frn_aprovar_contrato(text, uuid, text)',
      'public.frn_devolver_contrato(text, uuid, text, text)', 'public.frn_salvar_modelo(text, int, text)',
      'public.frn_registrar_documento(text, uuid)',
      'public.frn_registrar_aviso(uuid, uuid, text, text, text, text, text, text)', 'public.frn__imutavel()']) f
     where to_regprocedure(f) is not null)::text, '24'),
  ('nenhuma das 24 executável por anon ou authenticated',
   (select count(*) from unnest(array[
      'public.frn_tem_algum_papel(text)', 'public.frn_pode_configurar(text)',
      'public.frn_dias_pagamento(text, int, int)', 'public.frn_parcelas_mo(uuid)',
      'public.frn_salvar_contrato(text, uuid, jsonb)',
      'public.frn_criar_aditivo(text, uuid, text, text, numeric, text, text, text, text, int)',
      'public.frn_aprovar_aditivo(text, uuid, text)', 'public.frn_devolver_aditivo(text, uuid, text, text)',
      'public.frn_registrar_atendimento(text, uuid, date, text, numeric)', 'public.frn_solicitar_medicao(text, jsonb)',
      'public.frn_registrar_solicitacao_fin(uuid, text, date, text, uuid, int)',
      'public.frn_salvar_condicao(text, text, int, jsonb)', 'public.frn_definir_condicao_ativa(text, text, int, boolean)',
      'public.frn__nome(text)', 'public.frn_etapa(public.frn_contratos)',
      'public.frn__desc_condicao(text, int, jsonb, int)', 'public.frn_alterar_e_aprovar_condicoes(text, uuid, jsonb)',
      'public.frn_enviar_contrato(text, uuid)', 'public.frn_aprovar_contrato(text, uuid, text)',
      'public.frn_devolver_contrato(text, uuid, text, text)', 'public.frn_salvar_modelo(text, int, text)',
      'public.frn_registrar_documento(text, uuid)',
      'public.frn_registrar_aviso(uuid, uuid, text, text, text, text, text, text)', 'public.frn__imutavel()']) f
     where has_function_privilege('anon', f::regprocedure, 'EXECUTE')
        or has_function_privilege('authenticated', f::regprocedure, 'EXECUTE'))::text, '0'),
  ('as 23 chamáveis (todas menos frn__imutavel) executáveis por service_role',
   (select count(*) from unnest(array[
      'public.frn_tem_algum_papel(text)', 'public.frn_pode_configurar(text)',
      'public.frn_dias_pagamento(text, int, int)', 'public.frn_parcelas_mo(uuid)',
      'public.frn_salvar_contrato(text, uuid, jsonb)',
      'public.frn_criar_aditivo(text, uuid, text, text, numeric, text, text, text, text, int)',
      'public.frn_aprovar_aditivo(text, uuid, text)', 'public.frn_devolver_aditivo(text, uuid, text, text)',
      'public.frn_registrar_atendimento(text, uuid, date, text, numeric)', 'public.frn_solicitar_medicao(text, jsonb)',
      'public.frn_registrar_solicitacao_fin(uuid, text, date, text, uuid, int)',
      'public.frn_salvar_condicao(text, text, int, jsonb)', 'public.frn_definir_condicao_ativa(text, text, int, boolean)',
      'public.frn__nome(text)', 'public.frn_etapa(public.frn_contratos)',
      'public.frn__desc_condicao(text, int, jsonb, int)', 'public.frn_alterar_e_aprovar_condicoes(text, uuid, jsonb)',
      'public.frn_enviar_contrato(text, uuid)', 'public.frn_aprovar_contrato(text, uuid, text)',
      'public.frn_devolver_contrato(text, uuid, text, text)', 'public.frn_salvar_modelo(text, int, text)',
      'public.frn_registrar_documento(text, uuid)',
      'public.frn_registrar_aviso(uuid, uuid, text, text, text, text, text, text)']) f
     where has_function_privilege('service_role', f::regprocedure, 'EXECUTE'))::text, '23'),
  ('security definer sem search_path fixo entre as frn_* (deve ser nenhuma)',
   (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname like 'frn\_%' and p.prosecdef
       and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%'))::text, '0'),
  ('frn_pode_configurar(NULL) e frn_tem_algum_papel(NULL) são false (nunca NULL)',
   (public.frn_pode_configurar(null) is false and public.frn_tem_algum_papel(null) is false)::text, 'true'),
  -- dados semeados
  ('frn_condicoes_versoes: 12 linhas, todas versão 1, acao seed, criado_por "seed 009"',
   (select count(*) || '/' || count(*) filter (where versao = 1 and acao = 'seed' and criado_por = 'seed 009')
      from public.frn_condicoes_versoes), '12/12'),
  ('frn_condicoes: todas na versão 1, sem atualizado_por/atualizado_em',
   (select count(*) filter (where versao = 1 and atualizado_por is null and atualizado_em is null)
      from public.frn_condicoes)::text, '12'),
  ('frn_modelos_contrato: 1 linha (versão 1, seed 011)',
   (select count(*) || ':' || min(versao) || ':' || min(criado_por) from public.frn_modelos_contrato), '1:1:seed 011'),
  ('modelo v1 sem CR (o arquivo foi aplicado com LF, como no CI)',
   (select count(*) from public.frn_modelos_contrato where position(chr(13) in texto) > 0)::text, '0'),
  ('frn_avisos vazia', (select count(*) from public.frn_avisos)::text, '0')
) as x(checagem, valor, esperado);
```

**Esperado:** 21 linhas, todas `OK`. Elas cobrem:
- **tabelas:** 3 novas, com RLS ligada;
- **policies:** só SELECT para `authenticated`. Em `frn_avisos` a policy é `using (false)` e não há grant;
- **grants de tabela:** `authenticated` só com SELECT, e só nas duas tabelas de versão. `anon` sem nada;
- **gatilhos:** 4 de imutabilidade, nenhum do rollback;
- **colunas:** 8 colunas novas com tipo e nulidade certos;
- **constraints:** 11 validadas, mais `frn_ct_ordem` **NOT VALID** (decisão D1: o CT-0001 tem as condições aprovadas antes
  da contratação). Os checks de papel e de evento foram ampliados;
- **funções:** a `frn_dias_pagamento` de 2 argumentos saiu. As 24 funções novas ou alteradas existem, nenhuma pode ser
  executada por `anon`/`authenticated`, e as 23 chamáveis podem ser executadas por `service_role`. Nenhuma
  `security definer` `frn_*` está sem `search_path`, e as guardas de papel com `NULL` dão `false`;
- **dados semeados:** 12 versões v1 `seed 009`, 1 modelo `seed 011` **sem CR** e `frn_avisos` vazia.

### Pós 3 — CT-0001: só as colunas novas

```sql
-- PÓS 3 — CT-0001: só as colunas novas, com o valor esperado (só leitura)
select c.numero, c.status, c.condicao_codigo, c.condicao_versao, c.parcelas_ajustadas, c.modelo_versao,
       public.frn_etapa(c) as etapa
  from public.frn_contratos c
 order by c.seq;
```

**Esperado:** uma linha, `CT-0001 | aguardando | OBRA_MEDICAO_MENSAL | condicao_versao = 1 | parcelas_ajustadas = null |
modelo_versao = null | etapa = eduardo`. A Pós 1 mostra que o resto da linha não mudou, e esta mostra o que foi
acrescentado: **só `condicao_versao = 1`**.

---

## 4. Critério de parada e rollback

**Parar, não aplicar o próximo arquivo, não mergear para `main`, não deployar e avisar o João** quando acontecer qualquer
um destes:
1. alguma Pré com `*** PARAR ***` ou fora do esperado (inclusive o estado do CT-0001 na Pré 4);
2. resposta da API com erro ao aplicar um arquivo;
3. qualquer `*** FALHOU ***` na verificação de um arquivo, ou número de linhas diferente de 12/6/6/4;
4. foto depois ≠ foto antes, ou Pós 2/Pós 3 fora do esperado.

**O que fazer em cada caso:**

| Situação | Estado do banco | Ação |
|---|---|---|
| Erro na **009** | nada gravado (transação desfeita) | Conferir com a Pré 3, que tem de seguir 6/6 OK. Investigar a mensagem. Não há rollback a fazer. |
| Erro na 010, 011 ou 012 | as anteriores **gravadas**, a que falhou não | **Não rodar o rollback** (ver o defeito abaixo). Banco "só 009" ou "009+010" funciona com o app velho: as funções que o app de `main` chama mantêm a assinatura, e a `frn_dias_pagamento(text,int)` removida só era chamada dentro do SQL, pela `frn_registrar_solicitacao_fin`, que a 009 recria. Corrigir e reaplicar o arquivo que falhou; as migrations são idempotentes. |
| `FALHOU` depois de 009–012 todas aplicadas, **app novo ainda não deployado** | tudo gravado | Rollback: `supabase/rollback/009-012-ROLLBACK.sql` (blob LF, mesmo comando da §2), só com o João avisado. Esperado: **7/7 OK**. Ele recria as funções de 001/005/008, dropa as 10 funções novas e a `frn_ct_ordem`, e liga 3 gatilhos de versão. **Não apaga tabela, coluna nem dado.** |
| App novo **já deployado** | — | O rollback do banco **sozinho** quebra o app novo, que chama funções que ele dropa. Primeiro volte o app (redeploy de um `main` revertido), depois o banco. |
| Rollback responde `O app novo já foi usado (condição editada, % ajustados pelo José ou modelo novo)…` | nada mudou (aborta na seção 0) | É a **trava M1**. Ela dispara se existir `frn_condicoes_versoes.versao > 1`, `frn_contratos.parcelas_ajustadas` não nulo ou mais de 1 linha em `frn_modelos_contrato`. Rodar o rollback nesse estado mudaria parcela e prazo de contrato aprovado. **Não contornar: corrigir para frente**, com o João. Uma condição só **desativada** (v2) já basta para travar, e isso é de propósito. |

### ⚠️ Defeito do rollback encontrado nesta preparação (conferido no PGlite)

A seção 0 do rollback lê `public.frn_modelos_contrato`. Essa tabela só existe depois da 011. Com só a 009, ou só 009+010,
aplicadas, o rollback **aborta com `relation "public.frn_modelos_contrato" does not exist`**. Isso acontece no PL/pgSQL
porque a expressão inteira do `if` é preparada antes de rodar, então o `or` não protege. Medido:

| Aplicado até | Rollback |
|---|---|
| 009 | ERRO `relation "public.frn_modelos_contrato" does not exist` |
| 010 | o mesmo ERRO |
| 011 | roda; 6/7 OK. "nada apagado" sai `FALHOU` só porque `frn_avisos` (012) não existe; isso é esperado |
| 012 | roda, 7/7 OK |

Não há dano: o rollback aborta antes de mexer em qualquer coisa. Mas o caminho "009 aplicada, 010 falhou → reverter" não
existe hoje. **Recomendação:** antes de aplicar, corrigir no `feat/melhorias-ajustes`, com teste no `rollback.test.ts`
(rollback depois de 009 e depois de 010). A correção é ler `frn_modelos_contrato` só quando a tabela existir, por
`execute` dinâmico dentro de um `if to_regclass('public.frn_modelos_contrato') is not null`. Se não corrigir, vale a linha
"Erro na 010, 011 ou 012" da tabela acima: o estado parcial funciona com o app velho, e o caminho é reaplicar para frente.

---

## 5. Registro da aplicação (`sql.md`: "atualize esta tabela no mesmo commit em que aplicar")

Num **único commit** na cópia `D:\fornecedores-work\hub-docs` (repo `login-system`):

1. `docs/fornecedores/revisao-banco-melhorias-antes.json` com as respostas literais da Pré 1 a Pré 5.
2. `docs/fornecedores/revisao-banco-melhorias-depois.json` com as respostas literais das verificações 009–012 (28 linhas)
   e das Pós 1 a Pós 3.
3. `.claude/rules/sql.md`, tabela "Estado das migrations em produção": nova linha depois da do `008`. Preencha data, commit
   e contagens reais:

   ```markdown
   | Fornecedores `009`–`012` (repo `fornecedores`, `supabase/hub-install/`, branch `feat/melhorias` `<commit>`) | **aplicado em AAAA-MM-DD** (autorizado pelo João; revisão independente da Frente A aprovada, com rerrevisão). Condições versionadas (`frn_condicoes_versoes`, 12 v1 `seed 009`), papel `configurador`, aprovação em ordem Eduardo → José (`frn_ct_ordem` **NOT VALID** de propósito, D1), modelo de contrato versionado (`frn_modelos_contrato`, v1 `seed 011`) e registro de e-mails (`frn_avisos`, sem grant, policy `using (false)`). Aplicado do blob LF (`git show`). Verificação 009 12/12, 010 6/6, 011 6/6, 012 4/4 `OK`; foto antes = depois (10 tabelas): no CT-0001 só `condicao_versao = 1`. Rollback: `supabase/rollback/009-012-ROLLBACK.sql` (não apaga dado; **trava M1** aborta se o app novo já foi usado). **Nunca reaplicar 001–008 sem 009–012 logo em seguida:** a `005` recria `frn_dias_pagamento(text,int)` e os corpos que leem o catálogo atual, desfazendo a leitura pela versão pinada |
   ```

   A última frase é a linha que o **M5** da revisão da Frente A pediu.
4. `docs/fornecedores/O-QUE-FALTA.md`: no "PONTO DE RETOMADA ATUAL", banco 009–012 aplicado (data, 28/28 OK) e o próximo
   passo, que é o merge para `main`.

---

## 6. Depois do banco: merge, variáveis e deploy

**Ordem (O-QUE-FALTA, "Ordem final"; plano §4.6 e §6):**
ajustes (I-1) aprovados → merge em `feat/melhorias` → **banco 009–012 (este roteiro)** → merge `feat/melhorias` → `main` →
variáveis → Deploy → conferência.

**Por que o banco vem antes do merge:** não há auto-deploy, mas qualquer Deploy do `fornecedores` constrói a `main`. Se a
`main` já tiver o código novo sem o banco, as telas novas chamam funções e tabelas que não existem (`frn_salvar_condicao`,
`frn_registrar_aviso`, `frn_condicoes_versoes`…). O inverso, banco novo com app velho, funciona: as assinaturas são as
mesmas, e ninguém edita condição sem o app novo (observação O2 da revisão). Mesmo assim, deixe essa janela curta, porque o
app velho mostra botões que agora respondem pela regra nova. Exemplo: o José aprovando antes do Eduardo recebe "O Eduardo
aprova a contratação primeiro."

1. **Merge** do PR `feat/melhorias` → `main` com CI verde. Conferir o CI **no commit do merge**.
2. **Variáveis (o João, no Environment do app `fornecedores`, projeto `manfac` em `https://painel.manfac.com.br/`):**
   - copiar do app **Compras** as cinco variáveis `SMTP_HOST`, `SMTP_PORTA`, `SMTP_USUARIO`, `SMTP_SENHA` e
     `SMTP_REMETENTE` (decisão D5). `SMTP_REMETENTE` tem de ser o endereço da própria caixa: remetente diferente dá
     `EENVELOPE 453`. Os valores nunca vão para o chat nem para arquivo;
   - `NEXT_PUBLIC_APP_URL=https://hub.manfac.com.br/fornecedores`. Ela já está na tabela do deploy de 10/10, e o
     `Dockerfile` usa esse mesmo valor como padrão do `ARG`, então é só **conferir** que existe e está certa. É
     `NEXT_PUBLIC_*`, entra **no build**, e o código novo a usa no link dos e-mails (`lib/avisos/avisar.ts`). Mudar exige
     novo Deploy;
   - **armadilha do campo Environment:** `NOME=valor` **na mesma linha**. Senão o contêiner sobe sem nenhuma variável, em
     silêncio. Não mexer nas outras (`SUPABASE_*`, `FINANCEIRO_URL`, `FORNECEDORES_INTEGRACAO_SECRET`,
     `FRN_AMBIENTE_CATALOGO`, `FRN_CRON_SECRET`);
   - sem as `SMTP_*`, o app funciona e cada aviso fica `sem_configuracao`. Mesmo assim, ponha antes do Deploy: o primeiro
     e-mail real será o da aprovação do Eduardo no CT-0001.
3. **Deploy só do app `fornecedores`.** Fonte `manfac-facilities/fornecedores`, branch `main`, campo do arquivo de build =
   `Dockerfile` (maiúsculo). O deploy dele não pode atualizar outro sistema. Se der erro, cole no chat **só as linhas do
   erro, nunca a linha `--build-arg`**: ela imprime os segredos, como aconteceu em 10/10.
4. **Confirmar que subiu**, sem confiar no painel:
   ```bash
   curl -s https://hub.manfac.com.br/fornecedores/api/health          # ok
   html=$(curl -s https://hub.manfac.com.br/fornecedores/sem-acesso)  # única página sem sessão (porteiro libera /sem-acesso)
   echo "$html" | grep -o '/fornecedores/_next/static/chunks/[a-zA-Z0-9._-]*\.js' | sort -u | head -10 | \
     while read c; do curl -sI "https://hub.manfac.com.br$c" | grep -i '^last-modified'; done
   ```
   Todos com o **mesmo** timestamp, posterior ao clique em Deploy. Pelo log do app, nenhum erro de variável.
5. **Nada caiu:** hub, Compras, Financeiro, Cockpit, Obras e Sofia abrindo (CA-M4).
6. **Na tela, sem escrever nada:**
   - lista com "Aguardando Eduardo" no CT-0001;
   - busca "davi";
   - ficha com a etapa e o item "agora";
   - Configurações visível para o José e em leitura para o admin;
   - prévia do modelo com o CT-0001.
7. **CA-D5, depois da aprovação do Eduardo no CT-0001** (leitura autorizada pelo João):
   `select evento, para, copia, situacao, erro, criado_em from frn_avisos order by criado_em desc limit 5`.
   `falhou` com `EENVELOPE 453` = remetente diferente da caixa. `EMESSAGE 451` = recusa temporária, depois de novas
   tentativas. `sem_configuracao` = as `SMTP_*` não chegaram ao processo.
8. Atualizar o manual e escrever o comunicado curto ao cliente (só o que muda na tela; o João aprova antes de enviar).
