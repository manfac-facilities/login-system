# Revisão independente do SQL: manutenção corretiva e colunas de revisão (03/11/2026)

**Objeto:** o SQL literal do §5 de `docs/superpowers/specs/2026-11-03-frotas-manutencao-e-bases-design.md`
(5.1 `sdd-sql-sofia-manutencao.sql` e 5.2 `sdd-sql-sofia-manutencao-teste.sql`).
**Revisor:** subagente independente, que não escreveu o SQL. Nada foi aplicado. Fiz só leitura no banco
`iyytcavcgukfjnjjrerx` pela Management API: definições de função, policies, triggers, colunas NOT NULL, constraints,
grants e default ACL.
**Régua:** só bloqueia dano de dado alcançável ou falha de autorização.

## Veredito

**APROVADO, sem bloqueantes.** Pode ser aplicado como está, com autorização escrita do João e na ordem do cabeçalho
(migration e verificação 22/22, depois o teste 30/30, depois o deploy). Os itens não bloqueantes abaixo vão para backlog.
O N1 e o N3 são baratos e valem a pena se houver nova rodada no arquivo.

## O que foi conferido e está certo

**Funções de autorização (lidas no banco).** `sofia_pode_gerir()` já embrulha tudo em `coalesce(..., false)`, então
nunca devolve NULL. Ela também **implica** `sofia_has_access()`: gestor sem liberação do Sofia não passa, e admin passa
pelo `sofia_is_admin()`. Isso fecha o caso "gestor sem acesso ao Sofia escreve pela RPC".

**RLS de `manutencoes`.**
- **Leitura:** `manutencoes_ler` (SELECT, `sofia_has_access`). Quem não tem acesso ao Sofia não lê. O teste n1 prova.
- **Inserção:** `manutencoes_inserir` exige `sofia_pode_gerir` e o carimbo `criado_por = lower(btrim(e-mail do JWT))`,
  normalizado do mesmo jeito que a RPC grava.
- **Atualização:** `manutencoes_atualizar` exige `sofia_pode_gerir` no USING e no WITH CHECK.
- **Exclusão:** não há policy de DELETE nem grant. Os testes g15 e verificação 15 provam.
- **anon:** `revoke all`, conferido na verificação 14. O default ACL do `public` dá `arwdDxtm` a anon e authenticated
  em tabela nova; o `revoke all` seguido de `grant select, insert, update` neutraliza isso. Conferido no banco.

**Guardas com NULL.** As duas RPCs usam `sofia_pode_gerir() is not true`. Os `not in` só rodam depois de
`is not null` ou sobre valor coalescido. `v_veic.status` é NOT NULL. Na conclusão, `v_m` nulo cai no
`is distinct from`, que levanta erro. Nenhuma guarda falha aberto.

**Funções.**
- As duas são `security invoker` com `search_path = pg_catalog, public` e checam o papel **antes** de qualquer leitura
  ou escrita.
- A abertura trava o veículo `for update` antes de inserir. A conclusão trava o veículo e depois a manutenção, e
  confere de novo o `veiculo_id` depois da trava.
- A checagem "não há outra aberta que também tirou" roda sob a trava do veículo, e a abertura também trava o veículo.
  Por isso abrir e concluir no mesmo carro ficam serializados.
- `EXECUTE` foi revogado de `public` e de `anon`. Isso importa porque o default ACL de função dá `X` a anon.

**Vínculo de equipe.** O `update veiculo_responsabilidade_historico set fim = current_date where veiculo_id =
p_veiculo_id and fim is null` é idêntico ao `enviarParaOficinaAction`. Só fecha o histórico daquele veículo.
`motoristas.equipe_id` não é tocado, igual ao app. A conclusão faz exatamente o `retornarDaOficinaAction`
(`ativo`, previsão nula, substituto nulo) e não recoloca equipe.

**Trigger.** O `trg_bloquear_escrita_veiculos` (BEFORE UPDATE) só guarda `valor_locacao_mensal` para quem não é
gestor. Não interfere nas RPCs nem no teste g20.

**Backfill.** O `update revisoes set prever_proxima = false where tipo = 'corretiva'` só roda dentro do bloco que cria
a coluna, ou seja, na primeira aplicação, e só escreve essa coluna. `revisoes` não tem trigger. No banco hoje há 20
corretivas, nenhuma com `proxima_km` ou `proxima_data`, o que confere com a spec.

**Idempotência.** Todos os comandos são `if not exists`, `drop/create policy`, `create or replace` ou revoke/grant.
A seção 0 aborta se `manutencoes` já existir com outro formato. Uma reaplicação não refaz o backfill.

**Teste.**
- O padrão de troca de papel (`set_config('role','authenticated',true)` com o JWT forjado) e o `SOF01` são os mesmos
  do teste F1–F3, que passou 35/35 em produção.
- Conferi as fixtures contra as colunas NOT NULL e as constraints reais. `hub_user_roles.nivel` aceita
  `analista`/`administrador`, placa e código são únicos (os valores do teste são novos), `auth.users` não tem trigger
  e `motoristas.equipe_id` e o histórico existem.
- As leituras de `audit_log` como gestor e como admin passam pela policy `sofia access`.
- A contagem dá 30 casos (p1, g1–g20, u1–u5, n1–n2, a1, z). Cada caso pega o SQLSTATE certo: P0001 na guarda,
  SOF01, 23514 nos CHECKs e 42501 no DELETE e na violação de RLS.
- O rollback é garantido pelo `raise` final.

**Verificação.**
- Os padrões `like` das linhas 11 a 13 batem com o deparse real do `pg_policies`, por exemplo
  `( SELECT auth.jwt() AS jwt)`.
- A linha 16 (7 CHECKs) vale no Postgres 17, que não registra NOT NULL em `pg_constraint`. Quebraria só no 18.

## Bloqueantes

Nenhum.

## Não bloqueantes

**N1. O UPDATE do gestor não congela colunas.** É mais largo que a dívida 6, que cita só `criado_por`. Pela policy, um
gestor via PostgREST consegue:
- trocar `veiculo_id`, `tirou_da_equipe`, `data_entrada` e `criado_por`;
- reabrir uma concluída (`status` volta para aberto com `data_saida = null`);
- concluir direto (`status = 'concluida'` com saída, custo e quem arca) sem devolver o carro e sem auditoria.

Quem consegue isso é um papel autorizado a escrever, então não é falha de autorização. Mas é sobrescrita de registro
fora do caminho auditado.

Correção barata (2 linhas, não afeta as RPCs, que só atualizam status, saída, custo, quem arca e `updated_at`):

```sql
revoke update on public.manutencoes from authenticated;
grant update (status, data_saida, custo, quem_arca, oficina, saida_prevista, observacoes, anexo_storage_path, updated_at)
  on public.manutencoes to authenticated;
```

Isso trava `veiculo_id`, `criado_por`, `tirou_da_equipe`, `data_entrada` e `created_at`. Se adotar, a verificação 15
precisa trocar `has_table_privilege(..., 'UPDATE')` por `has_column_privilege(..., 'status', 'UPDATE')` mais
`not has_column_privilege(..., 'veiculo_id', 'UPDATE')`. Reabrir ou concluir por UPDATE direto continua possível. Para
fechar isso de vez é preciso um trigger, o que fica fora da régua.

**N2. A conclusão pode devolver a Ativo um carro que está na oficina por outro episódio.** Exemplo: corretiva aberta
com "tirar", depois "Retornar da oficina" pela ficha, depois "Enviar para oficina" pela ficha de novo, e só então
alguém conclui a corretiva antiga. O carro vai para `ativo` e perde `previsao_retorno_oficina` e `substituto_id`. É
uma variação da dívida 2, a ação é explícita do gestor ("o veículo volta para Ativo") e a decisão foi registrada.
Sugestão para `DIVIDAS.md`: citar também a perda do substituto nesse caso.

**N3. O teste não prova que só o histórico do carro certo é fechado.** O g1 confere que o de v1 fechou, mas não há
outro histórico aberto para provar que ficou intacto. Correção literal:
- na fixture, acrescentar `(v2, e1, null, date '2000-01-01')` ao insert de `veiculo_responsabilidade_historico`;
- no g1, acrescentar a condição
  `and exists (select 1 from public.veiculo_responsabilidade_historico where veiculo_id = v2 and fim is null)`.

O a1, depois, fecha o histórico de v2, o que é esperado e não afeta os outros casos.

**N4. Idempotência não é exercitada.** Recomendo rodar a migration duas vezes seguidas na aplicação. As duas devem
dar 22/22, e as linhas 4 a 6 continuam valendo antes do app gravar.

**N5. Data de fechamento do histórico.** `fim = current_date` (dia UTC) mesmo quando `data_entrada` é passada. É igual
ao app. Fica só o registro.

**N6. Reabrir sobrescreve a previsão.** Abrir com "tirar" num carro que já está em `manutencao` sobrescreve
`previsao_retorno_oficina`. É coerente com a manutenção mais nova.

**N7. Dado de produção inconsistente hoje.** O veículo `EWH1B84` está em `status = 'manutencao'` com `equipe_id`
preenchido. Se alguém abrir uma corretiva com "tirar" para ele, a equipe sai, o que é o efeito correto. Vale avisar o
coordenador.

**N8. Grants antigos em `audit_log` (fora do escopo deste SQL).** `audit_log` dá a `anon` INSERT, SELECT, UPDATE,
DELETE, TRUNCATE, REFERENCES e TRIGGER. A RLS `sofia access` barra o anon, então não é alcançável pelo PostgREST,
exceto TRUNCATE, que o PostgREST não expõe. Fica a sugestão de `revoke all on public.audit_log from anon` numa rodada
futura.
