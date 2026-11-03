# Revisão independente — `sdd-sql-sofia-multa-avaria.sql` (§3.8) e `-teste.sql` (§3.9)

**Data:** 03/11/2026. **Revisor:** agente independente (não escreveu a spec nem o SQL).
**Fonte revisada:** `docs/superpowers/specs/2026-11-03-frotas-multa-fotos-checklist-design.md` §3.8, §3.9 e a seção
"AJUSTE OBRIGATÓRIO pós-spec". **Base:** `AGENTS.md`, `.claude/rules/sql.md`, `sdd-sql-sofia-gestor-frotas.sql`
(corpo de `sofia_bloquear_autorizacao_nao_admin`), e o banco de produção `iyytcavcgukfjnjjrerx` **só leitura** via
Management API (nenhum DDL/DML executado).

## Veredito

**NÃO APLICAR como está.** Um bloqueante de autorização/dinheiro (B1) e o ajuste pós-spec (B2), que hoje torna a
exclusão de checklist/sinistro impossível até para o admin e deixa sinistro excluível pelo gestor. Com as correções
literais abaixo, o resto do SQL está correto no que importa: **o gestor de frotas não chega a `autorizado` por nenhum
caminho** (RPC, UPDATE de `etapa`, UPDATE de `status`/`autorizacao_status`, INSERT já autorizado, pulo
`solicitado → descontada`), as guardas usam `is not true`, a trigger nova convive com `trg_bloquear_autorizacao_multas`
sem travar o admin, o backfill não reescreve dado gravado, e a correção de storage não quebra o app.

## Medido no banco (03/11/2026, leitura)

- Triggers: `multas` só `trg_bloquear_autorizacao_multas`; `sinistros` só `trg_bloquear_autorizacao_sinistros`
  (DELETE exige `sofia_pode_gerir()` → **gestor exclui sinistro hoje**); **`checklist`, `checklist_fotos`,
  `sinistro_fotos` sem trigger** (qualquer usuário do Sofia exclui checklist pelo PostgREST; a action só confere
  `podeGerirFrotas`).
- `sofia_bloquear_autorizacao_nao_admin` contém `sofia_pode_gerir() is not true` (seção 0 passa).
- FKs: `checklist_fotos.checklist_id` e `sinistro_fotos.sinistro_id` `ON DELETE CASCADE`;
  `veiculo_responsabilidade_historico.origem_checklist_id → checklist` e `motorista_documentos.sinistro_id → sinistros`
  **sem ação** (NO ACTION).
- `audit_log`: `id, tabela, registro_id, acao, dados jsonb, usuario_email, created_at, operacao, descricao, usuario_id
  (FK auth.users)`; sem CHECK; policy `sofia access` ALL; authenticated sem UPDATE/DELETE.
- `checklist_fotos` **sem CHECK em `posicao`** (posições `Extra n`/`Avaria n` entram). `checklist` só tem NOT NULL sem
  default em `tipo`, `veiculo_id` (fixtures do teste batem).
- Storage: buckets privados; as 4 policies do Sofia são só `bucket_id = ...`; nenhuma UPDATE/DELETE/ALL nos dois
  buckets; `storage.objects` tem `protect_objects_delete`. Prefixos: `sofia-anexos/sinistros/*` e
  `checklist-fotos/<checklist_id>/*` — nada fora do Sofia. `authenticated` tem EXECUTE em `sofia_has_access()`.
- Multas: 33 `pendente/sem_solicitacao`, 3 `validada/solicitado`, 2 `pendente/autorizado`, 1 `validada/autorizado`.
  **As 3 autorizadas foram solicitadas hoje (03/11, 14:18–14:19 UTC)**, já com o Igor gestor (desde 30/10); não há
  registro de quem autorizou (ver N1).

---

## BLOQUEANTES

### B1 — Depois de pedido/autorizado o desconto, `valor` e `motorista_id` continuam editáveis (contorna o admin)

Trecho (`sofia_multas_etapa_guarda`, ramo "UPDATE sem mudar a etapa"): só congela `status`/`autorizacao_status` e o
trio do desconto; `valor` não é guardado por **nenhuma** trigger, e `motorista_id`/`motorista_condutor_id` só exigem
`v_gerir`.

Caminho alcançável (PostgREST direto, sem o app): gestor solicita a multa de R$ 100 → admin autoriza → gestor faz
`PATCH /multas?id=eq.X {"valor": 5000, "motorista_id": "<outro>"}` (passa nas duas triggers) → RPC `descontada` com
`valor_descontado = 5000` (passa: `≤ new.valor`). O admin autorizou "R$ 100 do motorista A"; o RH desconta R$ 5000 do
motorista B. Usuário comum também altera `valor` (a trigger antiga não guarda `valor`). É exatamente a regra nova
("só admin autoriza") ficando oca no dinheiro.

**Correção literal** — em `sofia_multas_etapa_guarda`, logo depois do bloco `if TG_OP = 'INSERT' then ... end if;` e
antes de `-- ---------- UPDATE sem mudar a etapa ----------`, inserir:

```sql
  -- O que o admin autoriza (quanto, de quem, qual multa) congela a partir do pedido de desconto,
  -- para qualquer role. Para corrigir: admin revoga → gestor cancela a solicitação → corrige → pede de novo.
  if old.etapa in ('solicitado','autorizado','descontada')
     and (new.valor, new.motorista_id, new.motorista_condutor_id, new.veiculo_id, new.data)
         is distinct from
         (old.valor, old.motorista_id, old.motorista_condutor_id, old.veiculo_id, old.data) then
    raise exception 'Multa com desconto pedido ou autorizado: valor, motorista, veículo e data não mudam (cancele a solicitação antes)';
  end if;
```

E no teste, depois de (g17) — m1 está `descontada`; use m3, que ficou `solicitado` em (a2) — acrescentar:

```sql
  -- (g20) G muda o valor de multa com desconto pedido (contornaria o valor que o admin autoriza)
  n_total := n_total + 1;
  begin
    update public.multas set valor = 5000 where id = m3;
    r := r || '(g20) G muda valor de multa solicitada: *** FALHOU *** (passou)'::text;
  exception when others then
    if sqlstate = 'P0001' then n_ok := n_ok + 1; r := r || '(g20) G muda valor de multa solicitada: OK (barrado)'::text;
    else r := r || ('(g20) *** FALHOU *** ' || sqlerrm)::text; end if;
  end;

  -- (g21) G troca o motorista de multa com desconto pedido
  n_total := n_total + 1;
  begin
    update public.multas set motorista_id = mo1 where id = m3;
    r := r || '(g21) G troca motorista de multa solicitada: *** FALHOU *** (passou)'::text;
  exception when others then
    if sqlstate = 'P0001' then n_ok := n_ok + 1; r := r || '(g21) G troca motorista de multa solicitada: OK (barrado)'::text;
    else r := r || ('(g21) *** FALHOU *** ' || sqlerrm)::text; end if;
  end;
```

(m3 nasceu sem `motorista_id`, então `mo1` é mudança real.) Na verificação, acrescentar:

```sql
  ('v21 trigger congela valor/motorista a partir do pedido',
   (select case when prosrc like '%old.etapa in (''solicitado'',''autorizado'',''descontada'')%'
                 and prosrc like '%new.valor, new.motorista_id%' then 'OK' else '*** FALHOU ***' end
      from pg_proc where oid = to_regprocedure('public.sofia_multas_etapa_guarda()'))),
```

### B2 — Ajuste pós-spec não implementado (exclusão de checklist/sinistro)

Hoje, com o §3.8: (a) `sofia_fotos_imutaveis` recusa **sempre**, inclusive a cascata → **admin não consegue excluir
checklist nem sinistro com foto** (todos os 30 checklists têm foto); (b) `checklist_avarias.checklist_id` sem cascade +
guarda que recusa DELETE sempre → admin não exclui checklist com avaria; (c) nada restringe a exclusão a admin:
`sinistros` continua com DELETE para gestor (trigger antiga) e `checklist` para **qualquer** usuário do Sofia (só RLS);
(d) nada grava `audit_log`. Mudanças literais em "Mudanças exigidas pelo ajuste", abaixo.

---

## Mudanças exigidas pelo ajuste pós-spec (literal)

### A1. Seção 6 — FK da avaria em cascata e guarda de DELETE só para a cascata

Trocar a linha:

```sql
  checklist_id uuid not null references public.checklist(id),
```
por:
```sql
  checklist_id uuid not null references public.checklist(id) on delete cascade,
```

Em `sofia_checklist_avarias_guarda`, trocar:

```sql
  if TG_OP = 'DELETE' then
    raise exception 'Avaria registrada não pode ser apagada';
  end if;
```
por:
```sql
  if TG_OP = 'DELETE' then
    -- só sai na cascata de excluir o checklist inteiro (trg_excluir_so_admin já exigiu admin):
    -- nesse momento o checklist pai não existe mais. Delete direto (pai existe) = recusado, qualquer role.
    if exists (select 1 from public.checklist c where c.id = old.checklist_id) then
      raise exception 'Avaria registrada não pode ser apagada';
    end if;
    return old;
  end if;
```

### A2. Seção 7 — FK da foto para a avaria em cascata

Trocar:
```sql
  add column if not exists avaria_id uuid references public.checklist_avarias(id),
```
por:
```sql
  add column if not exists avaria_id uuid references public.checklist_avarias(id) on delete cascade,
```
(Tira a dependência da ordem em que o Postgres dispara as duas cascatas a partir de `checklist`.)

### A3. Seção 8 — `sofia_fotos_imutaveis`: foto avulsa nunca; cascata do pai sim

Substituir a função inteira por:

```sql
create or replace function public.sofia_fotos_imutaveis()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if TG_OP = 'UPDATE' then
    raise exception 'Foto salva é prova e não pode ser alterada nem apagada';
  end if;

  if TG_OP = 'DELETE' then
    -- Foto avulsa: recusada para QUALQUER role (inclusive admin, postgres, service_role).
    -- Única saída: a cascata de excluir o checklist/sinistro inteiro, que trg_excluir_so_admin
    -- já restringiu a admin e registrou no audit_log; nesse momento o pai não existe mais.
    -- IF externo por tabela (regra do sql.md: old.<campo> não pode ser resolvido na tabela errada).
    if TG_TABLE_NAME = 'checklist_fotos' then
      if exists (select 1 from public.checklist c where c.id = old.checklist_id) then
        raise exception 'Foto salva é prova e não pode ser alterada nem apagada';
      end if;
    elsif TG_TABLE_NAME = 'sinistro_fotos' then
      if exists (select 1 from public.sinistros s where s.id = old.sinistro_id) then
        raise exception 'Foto salva é prova e não pode ser alterada nem apagada';
      end if;
    else
      raise exception 'sofia_fotos_imutaveis ligada a tabela inesperada: %', TG_TABLE_NAME;
    end if;
    return old;  -- obrigatório: devolver NULL num BEFORE DELETE pularia a linha na cascata e deixaria órfã
  end if;

  -- INSERT
  if TG_TABLE_NAME = 'checklist_fotos' then
    if new.avaria_id is not null then
      if not exists (select 1 from public.checklist_avarias a
                     where a.id = new.avaria_id and a.checklist_id = new.checklist_id) then
        raise exception 'A avaria da foto não pertence a este checklist';
      end if;
    end if;
  end if;
  return new;
end;
$$;
```

(`security definer` para o teste "o pai existe?" não depender da RLS de quem chama. Os `create trigger` e os
`revoke update, delete, truncate` das duas tabelas de foto ficam como estão.)

### A4. Seção nova 8b (depois da 8, antes da 9) — excluir checklist/sinistro: só admin, com audit_log

```sql
-- ============================================================
-- 8b. EXCLUIR CHECKLIST OU SINISTRO INTEIRO: só admin, com audit_log
--     (ajuste do João, 03/11). A cascata leva fotos e avarias; os
--     arquivos ficam no bucket (sem policy de DELETE) e os caminhos
--     ficam em audit_log.dados para não se perder a prova.
-- ============================================================
create or replace function public.sofia_excluir_registro_so_admin()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_fotos   jsonb := '[]'::jsonb;
  v_avarias jsonb := '[]'::jsonb;
begin
  if public.sofia_is_admin() is not true then
    raise exception 'Apenas administradores podem excluir checklist ou sinistro';
  end if;

  if TG_TABLE_NAME = 'checklist' then
    select coalesce(jsonb_agg(to_jsonb(f) order by f.created_at), '[]'::jsonb) into v_fotos
      from public.checklist_fotos f where f.checklist_id = old.id;
    select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at), '[]'::jsonb) into v_avarias
      from public.checklist_avarias a where a.checklist_id = old.id;
  elsif TG_TABLE_NAME = 'sinistros' then
    select coalesce(jsonb_agg(to_jsonb(f) order by f.created_at), '[]'::jsonb) into v_fotos
      from public.sinistro_fotos f where f.sinistro_id = old.id;
  else
    raise exception 'sofia_excluir_registro_so_admin ligada a tabela inesperada: %', TG_TABLE_NAME;
  end if;

  insert into public.audit_log (tabela, operacao, registro_id, descricao, usuario_id, usuario_email, dados)
  values (TG_TABLE_NAME, 'excluiu', old.id::text,
          case when TG_TABLE_NAME = 'checklist' then 'Checklist excluído pelo administrador'
               else 'Sinistro excluído pelo administrador' end
            || ' (' || jsonb_array_length(v_fotos) || ' foto(s))',
          auth.uid(), lower(trim(auth.jwt() ->> 'email')),
          jsonb_build_object('registro', to_jsonb(old), 'fotos', v_fotos, 'avarias', v_avarias));
  return old;
end;
$$;

drop trigger if exists trg_excluir_so_admin on public.checklist;
create trigger trg_excluir_so_admin
  before delete on public.checklist
  for each row execute function public.sofia_excluir_registro_so_admin();
drop trigger if exists trg_excluir_so_admin on public.sinistros;
create trigger trg_excluir_so_admin
  before delete on public.sinistros
  for each row execute function public.sofia_excluir_registro_so_admin();
```

Notas: não altera a função compartilhada `sofia_bloquear_autorizacao_nao_admin` (em `sinistros` as duas triggers
convivem; a nova é mais restrita). `postgres`/`service_role` sem JWT também ficam barrados (mesma limitação documentada
dos `trg_bloquear_*`). Exclusão de checklist de **troca** que originou período em
`veiculo_responsabilidade_historico` e de sinistro com `motorista_documentos` continua falhando por FK (já é assim hoje).

### A5. Verificação — acrescentar (e ajustar o "Esperado")

```sql
  ('v22 trg_excluir_so_admin em checklist e sinistros, habilitado',
   (select case when count(*) = 2 then 'OK' else '*** FALHOU *** ' || count(*) end from pg_trigger t join pg_proc p on p.oid = t.tgfoid
     where t.tgname = 'trg_excluir_so_admin' and t.tgenabled <> 'D' and p.proname = 'sofia_excluir_registro_so_admin'
       and t.tgrelid in ('public.checklist'::regclass, 'public.sinistros'::regclass))),
  ('v23 exclusão: guarda sofia_is_admin() is not true + audit_log',
   (select case when prosecdef and prosrc like '%sofia_is_admin() is not true%' and prosrc like '%insert into public.audit_log%'
            then 'OK' else '*** FALHOU ***' end
      from pg_proc where oid = to_regprocedure('public.sofia_excluir_registro_so_admin()'))),
  ('v24 cascata: avaria→checklist e foto→avaria ON DELETE CASCADE',
   (select case when count(*) = 2 then 'OK' else '*** FALHOU *** ' || count(*) end from pg_constraint
     where contype = 'f' and confdeltype = 'c'
       and ((conrelid = 'public.checklist_avarias'::regclass and confrelid = 'public.checklist'::regclass)
         or (conrelid = 'public.checklist_fotos'::regclass and confrelid = 'public.checklist_avarias'::regclass)))),
  ('v25 fotos: delete só com pai ausente, devolve old',
   (select case when prosecdef and prosrc like '%exists (select 1 from public.checklist c where c.id = old.checklist_id)%'
                 and prosrc like '%return old;%' then 'OK' else '*** FALHOU ***' end
      from pg_proc where oid = to_regprocedure('public.sofia_fotos_imutaveis()'))),
```
"Esperado": **24 linhas OK + v04 "AVISO 2"** (com v21 do B1). Ajustar §6 da spec ("19 OK" → "24 OK").

No ROLLBACK comentado, acrescentar antes do `commit;`:
```sql
-- drop trigger if exists trg_excluir_so_admin on public.checklist;
-- drop trigger if exists trg_excluir_so_admin on public.sinistros;
-- drop function if exists public.sofia_excluir_registro_so_admin();
```

### A6. Teste (§3.9) — trocar e acrescentar casos

**Fixture:** nada muda (c1 já tem f1, av1; u12 cria av3 + foto de av3 em c1).

**(p3) novo**, logo depois de (p2):
```sql
  -- (p3) postgres sem JWT exclui checklist: barrado (sofia_is_admin falso, falha fechada)
  n_total := n_total + 1;
  begin
    delete from public.checklist where id = c2;
    r := r || '(p3) postgres sem JWT exclui checklist: *** FALHOU *** (passou)'::text;
  exception when others then
    if sqlstate = 'P0001' then n_ok := n_ok + 1; r := r || '(p3) postgres sem JWT exclui checklist: OK (barrado)'::text;
    else r := r || ('(p3) *** FALHOU *** ' || sqlerrm)::text; end if;
  end;
```

**(u15) novo**, depois de (u14):
```sql
  -- (u15) U exclui checklist (a RLS deixaria; a trigger só-admin barra)
  n_total := n_total + 1;
  begin
    delete from public.checklist where id = c2;
    r := r || '(u15) U exclui checklist: *** FALHOU *** (passou)'::text;
  exception when others then
    if sqlstate = 'P0001' then n_ok := n_ok + 1; r := r || '(u15) U exclui checklist: OK (barrado)'::text;
    else r := r || ('(u15) *** FALHOU *** ' || sqlerrm)::text; end if;
  end;
```

**(n3) novo**, depois de (n2):
```sql
  -- (n3) N (sem Sofia) não sobe arquivo no bucket do checklist
  n_total := n_total + 1;
  begin
    insert into storage.objects (bucket_id, name) values ('checklist-fotos', '__teste_ma/n3.jpg');
    r := r || '(n3) N sobe arquivo: *** FALHOU *** (passou)'::text;
  exception when others then
    if sqlstate = '42501' then n_ok := n_ok + 1; r := r || '(n3) N sobe arquivo: OK (barrado)'::text;
    else r := r || ('(n3) *** FALHOU *** ' || sqlerrm)::text; end if;
  end;
```

**(g9) e (g10) substituídos** (agora só `P0001`, da trigger só-admin; `23503` deixa de valer):
```sql
  -- (g9) G exclui checklist com foto: barrado (só admin exclui)
  n_total := n_total + 1;
  begin
    delete from public.checklist where id = c1;
    r := r || '(g9) G exclui checklist: *** FALHOU *** (passou)'::text;
  exception when others then
    if sqlstate = 'P0001' then n_ok := n_ok + 1; r := r || '(g9) G exclui checklist: OK (barrado)'::text;
    else r := r || ('(g9) *** FALHOU *** ' || sqlerrm)::text; end if;
  end;

  -- (g10) G exclui sinistro: barrado (só admin exclui; antes desta migration o gestor podia)
  n_total := n_total + 1;
  begin
    delete from public.sinistros where id = s1;
    r := r || '(g10) G exclui sinistro: *** FALHOU *** (passou)'::text;
  exception when others then
    if sqlstate = 'P0001' then n_ok := n_ok + 1; r := r || '(g10) G exclui sinistro: OK (barrado)'::text;
    else r := r || ('(g10) *** FALHOU *** ' || sqlerrm)::text; end if;
  end;
```

**(g20), (g21)** do B1, depois de (g19).

**Bloco ADMIN final novo**, depois de (g21) e antes de `-- ================= FIM`:
```sql
  -- ================= ADMIN: foto avulsa nunca; registro inteiro sim =================
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid_a, 'email', mail_a, 'role', 'authenticated')::text, true);

  -- (a4) admin com TODOS os privilégios (role postgres + JWT de admin) apaga foto avulsa: a trigger barra
  n_total := n_total + 1;
  begin
    perform set_config('role', 'postgres', true);
    delete from public.checklist_fotos where id = f1;
    perform set_config('role', 'authenticated', true);
    r := r || '(a4) admin apaga foto avulsa: *** FALHOU *** (passou)'::text;
  exception when others then
    perform set_config('role', 'authenticated', true);
    if sqlstate = 'P0001' then n_ok := n_ok + 1; r := r || '(a4) admin apaga foto avulsa: OK (barrado pela trigger)'::text;
    else r := r || ('(a4) *** FALHOU *** ' || sqlerrm)::text; end if;
  end;

  -- (a5) admin troca o arquivo de uma foto (mesmo cenário de privilégio total)
  n_total := n_total + 1;
  begin
    perform set_config('role', 'postgres', true);
    update public.checklist_fotos set storage_path = 'outro.jpg' where id = f1;
    perform set_config('role', 'authenticated', true);
    r := r || '(a5) admin troca arquivo da foto: *** FALHOU *** (passou)'::text;
  exception when others then
    perform set_config('role', 'authenticated', true);
    if sqlstate = 'P0001' then n_ok := n_ok + 1; r := r || '(a5) admin troca arquivo da foto: OK (barrado pela trigger)'::text;
    else r := r || ('(a5) *** FALHOU *** ' || sqlerrm)::text; end if;
  end;

  -- (a6) admin exclui o checklist c1 inteiro (2 fotos, 2 avarias): passa, cascata leva fotos e avarias, audit_log grava
  n_total := n_total + 1;
  begin
    delete from public.checklist where id = c1;
    perform set_config('role', 'postgres', true);
    if not exists (select 1 from public.checklist where id = c1)
       and not exists (select 1 from public.checklist_fotos where checklist_id = c1)
       and not exists (select 1 from public.checklist_avarias where checklist_id = c1)
       and exists (select 1 from public.audit_log
                   where tabela = 'checklist' and operacao = 'excluiu' and registro_id = c1::text
                     and usuario_email = mail_a and jsonb_array_length(dados -> 'fotos') = 2
                     and jsonb_array_length(dados -> 'avarias') = 2) then
      n_ok := n_ok + 1; r := r || '(a6) admin exclui checklist com fotos/avarias + audit_log: OK'::text;
    else r := r || '(a6) admin exclui checklist: *** FALHOU *** (estado/audit_log errado)'::text; end if;
    perform set_config('role', 'authenticated', true);
  exception when others then
    perform set_config('role', 'authenticated', true);
    r := r || ('(a6) admin exclui checklist: *** FALHOU *** ' || sqlerrm)::text;
  end;

  -- (a7) admin exclui o sinistro s1 com foto: passa, audit_log grava 1 foto
  n_total := n_total + 1;
  begin
    delete from public.sinistros where id = s1;
    perform set_config('role', 'postgres', true);
    if not exists (select 1 from public.sinistros where id = s1)
       and not exists (select 1 from public.sinistro_fotos where id = sf1)
       and exists (select 1 from public.audit_log
                   where tabela = 'sinistros' and operacao = 'excluiu' and registro_id = s1::text
                     and usuario_email = mail_a and jsonb_array_length(dados -> 'fotos') = 1) then
      n_ok := n_ok + 1; r := r || '(a7) admin exclui sinistro com foto + audit_log: OK'::text;
    else r := r || '(a7) admin exclui sinistro: *** FALHOU *** (estado/audit_log errado)'::text; end if;
    perform set_config('role', 'authenticated', true);
  exception when others then
    perform set_config('role', 'authenticated', true);
    r := r || ('(a7) admin exclui sinistro: *** FALHOU *** ' || sqlerrm)::text;
  end;
```

**(z2) substituído** (c1/s1 não existem mais; o que tem de sobrar é o arquivo e o outro checklist):
```sql
  -- (z2) c2 e sua avaria intactos (U/postgres não excluíram) e o ARQUIVO da foto de c1 continua no bucket
  n_total := n_total + 1;
  if exists (select 1 from public.checklist where id = c2)
     and exists (select 1 from public.checklist_avarias where id = av2 and peca = 'Retrovisor')
     and exists (select 1 from storage.objects where bucket_id = 'checklist-fotos' and name = '__teste_ma/c1/Frente.jpg') then
    n_ok := n_ok + 1; r := r || '(z2) c2/av2 intactos e arquivo preservado no bucket: OK'::text;
  else r := r || '(z2) *** FALHOU ***'::text; end if;
```

**Cabeçalho e contagem:** p1–p3 (3) + u1–u15 (15) + n1–n3 (3) + g1–g14 (14) + a1–a3 (3) + g15–g21 (7) + a4–a7 (4)
+ z1–z2 (2) = **51**; usar `Esperado: "RESUMO: 51/51 OK"` no cabeçalho do teste e na §6 da spec. Na conferência pós-rollback acrescentar:
```sql
--   select count(*) from public.audit_log      where usuario_email like '\_\_teste\_ma\_%';
```
E apagar a nota "(g9) pode vir como 23503 ...".

### A7. Fora do SQL (para a spec/plano, não bloqueia o SQL)

- `excluirChecklistAction` e `excluirSinistroAction`: trocar `podeGerirFrotas` por checagem de admin (RPC
  `sofia_is_admin`, só `data === true`, como `podeAutorizarDescontoMulta`), mensagem "Apenas administradores podem
  excluir …"; não tentar apagar arquivo do storage; erro de FK (`23503`) → texto fixo "Este registro tem vínculos
  (troca de responsabilidade/documentos) e não pode ser excluído". Esconder o botão para não-admin.
- Atualizar no texto da spec: §0 (linha "Apagar foto salva"), §2.7 (último bullet), §3.6 (o "inclusive a cascata"
  inverte), §5 e §8.3.
- `docs/DIVIDAS.md`: arquivos de checklist/sinistro excluídos ficam no bucket como órfãos de propósito (prova); os
  caminhos estão em `audit_log.dados.fotos`.

---

## NÃO BLOQUEANTES

**N1. As 3 multas já `autorizado` (todas solicitadas hoje, 03/11) viram etapa `autorizado`** e o gestor pode registrar
`descontada` sem nova confirmação do admin. Não há registro de quem autorizou, e o Igor já era gestor (podia autorizar
pela regra antiga). **Recomendação:** perguntar ao João; se ele quiser a regra nova valendo para elas, no backfill
trocar `when autorizacao_status = 'autorizado' then 'autorizado'` por `then 'solicitado'` (não reescreve
`status`/`autorizacao_status`; o v04 passa a avisar 3 + 2; o admin reautoriza com um clique cada).

**N2. RPC aceita repetir a etapa atual** (ex.: gestor chama `autorizado` numa multa já `autorizado`): o UPDATE não muda
nada, mas grava em `multa_etapas` uma linha "autorizado" com o e-mail do gestor — histórico enganoso. Correção, logo
depois do bloco de checagem de admin na RPC:
```sql
  if p_etapa = v_m.etapa and p_etapa <> 'condutor' then
    raise exception 'A multa já está nesta etapa';
  end if;
```

**N3. Idempotência real só até o deploy do app.** (a) Seção 0 aborta na reaplicação depois que o app gravar `Extra n`
/ `Avaria n` em `posicao`; trocar a condição por
`if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='checklist_fotos' and column_name='tipo_foto') and exists (select 1 from public.checklist_fotos where posicao is null or posicao not in (...)) then`.
(b) O backfill de `prazo_indicacao` roda de novo na reaplicação, já com `trg_multas_etapa` ativa e como `postgres`
(`v_gerir` falso) → aborta se houver multa com recebimento e sem prazo. Envolver em
`do $$ begin if not exists (select 1 from pg_trigger where tgname = 'trg_multas_etapa' and tgrelid = 'public.multas'::regclass) then update public.multas set prazo_indicacao = data_recebimento + 30 where prazo_indicacao is null and data_recebimento is not null; end if; end $$;`.
Nos dois casos o efeito é abortar (nada pela metade), não estragar dado.

**N4. Teste não cobre "gestor insere multa já autorizada"** (u2 é usuário comum com `indicado`). A trigger cobre
(INSERT exige `registrada`/derivados para qualquer role). Se quiser o caso: G
`insert into public.multas (veiculo_id, data, descricao, valor, autorizacao_status) values (v1, current_date, 'teste-ma-g', 50, 'autorizado')`
esperando `P0001` (+1 no total).

**N5. Mapeamento `sem_solicitacao → cobrada` em `atualizarAutorizacaoMultaAction` (§4.2)** falha a partir de
`autorizado` (`autorizado → cobrada` não é transição permitida). A "revogação" antiga do admin vira dois passos
(`solicitado`, depois `cobrada`). É app; tratar no plano.

**N6. `avaria_origem_id` (sem uso)** referencia `checklist_avarias` sem ação: quando passar a ser usado, excluir um
checklist cuja avaria é origem de outra vai falhar (e `set null` bateria na guarda da avaria). Decidir quando o campo
ganhar uso.

**N7. `multa_etapas` some junto com a multa** (cascade) — excluir multa já é gestor/admin e já vai para `audit_log`,
mas sem a trilha das etapas. Se importar, copiar a trilha no `audit_log.dados` de `excluir_multas_em_massa` numa
próxima rodada.

**N8. Storage** — a correção com `(select public.sofia_has_access())` não quebra o app: todas as leituras são
`createSignedUrls` com a sessão do usuário do Sofia (lado servidor) e os uploads são com a sessão do usuário no
navegador; nenhum código fora do Sofia nem service role usa os dois buckets (grep + prefixos medidos). URL assinada já
emitida continua valendo até expirar. `service_role` continua podendo apagar objetos pela API (fora do alcance do
usuário) — só registrar.

**N9. Usuário comum continua alterando `valor`/`descricao` antes do pedido de desconto** (antes de `solicitado`).
Aceitável: o gestor valida depois e, com B1, o valor congela no pedido.

## Conferido e correto (sem mudança)

- Gestor → `autorizado`: RPC (guarda `sofia_is_admin() is not true`), UPDATE de `etapa` (trigger: só de `solicitado` e
  só admin; de qualquer outra etapa recusa), UPDATE de `status`/`autorizacao_status` (recusado para qualquer role sem
  mudar etapa; com mudança de etapa é sobrescrito pela derivação), INSERT (só `registrada`/derivados), pulo para
  `descontada` (só de `autorizado`). Revogação só admin. `descontada → autorizado` exige trio limpo.
- `is not true` em todas as guardas; `sofia_pode_gerir`/`sofia_is_admin` sempre true/false (medido).
- Convivência das triggers: `trg_bloquear_autorizacao_multas` roda antes (nome), não é alterada, e passa para gestor/
  admin; a nova não trava o admin em nada além do desenho (status direto). Nenhuma função do banco escreve em `multas`
  (medido) — não há caminho definer paralelo.
- Backfill de `etapa`/`prazo`/`tipo_foto` só escreve colunas novas, antes das triggers novas; passa pela trigger antiga
  como `postgres` porque não muda `status`/`autorizacao_status`/`valor_descontado`.
- Descontos: sinistro e KM excedido intocados (trigger nova só em `multas`); a leitura de multa segue com
  `status`/`autorizacao_status` preenchidos. As actions de multa do Descontos quebram por desenho (SQL e deploy na mesma
  janela, como a spec diz).
- O teste original prova o que diz em todos os 42 casos (casos "barrado" só aceitam `P0001`/`42501`), exceto (g9)/(g10)
  e (z2), que o ajuste inverte (A6).
