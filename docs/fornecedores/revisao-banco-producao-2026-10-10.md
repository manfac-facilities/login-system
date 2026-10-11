# Revisão independente do banco de produção — 10/10/2026

**Veredito: sem divergências. O banco (ref `iyytcavcgukfjnjjrerx`) está como os arquivos 001–006 (Fornecedores) e 023–024 (Financeiro) dizem. Nada de 007 nem 025 foi aplicado.**

Método: só consultas de leitura (`information_schema`, `pg_catalog`, `pg_policies`, `cron.job`, `storage.buckets`, `has_*_privilege`, contagens) pelo `aplicar.js`, com os SQLs em `scratchpad/verif/q1..q6.sql`. Nenhuma escrita.
Leitura dos arquivos: 001–004, 006, 023 e 024 inteiros; a 005 (1458 linhas) foi lida no cabeçalho, nos privilégios/verificação (linhas 1320–1458) e por varredura das assinaturas, `security definer`, `search_path` e `grant/revoke` das 36 funções. Os corpos das funções NÃO foram comparados linha a linha com o banco (ver "Não verificável").

| # | Item | Esperado | Encontrado | OK/DIVERGE |
|---|---|---|---|---|
| 1 | Tabelas frn_* (001–004) | 10: papeis, condicoes, fornecedores, contratos, tabela_precos, aditivos, medicoes, atendimentos, anexos, eventos | as 10, nenhuma a mais | OK |
| 1 | Tabelas fin_* (023/024) | fin_solicitacao_integracoes, fin_pagamentos_omie, fin_pagamentos_omie_trava | as 3 | OK |
| 1 | Colunas, tipos, NOT NULL, defaults | conforme `create table` + `alter ... add column` | todas as colunas presentes (inclui excecao_dias, fin_solicitacao_id, fin_tentativa nas tabelas que o arquivo reaplica); numeric(14,2) / (9,4) / (12,3) corretos; frn_eventos.id identity ALWAYS | OK |
| 1 | Constraints check/unique/pk/fk | todas as declaradas (ex.: frn_ct_*, frn_md_*, frn_ad_*, frn_fornecedores_homologacao_completa, frn_papeis_*, frn_condicoes_lista) | todas presentes com a definição esperada; FKs com ON DELETE RESTRICT/CASCADE conforme arquivo; unique de fin_ref, fin_solicitacao_id, storage_path, numero, seq | OK |
| 1 | Índices | contratos (criado_por, status, fornecedor), medicoes (contrato+item+status, status), atendimentos_abertos (parcial), anexos (contrato, medicao parcial), eventos (contrato+criado_em, fin_criada_uq, fin_recusada_uq), aditivos_cond_pendente_uniq (parcial), fin_pagamentos_omie_codigo_idx | todos os 13 presentes, com os predicados parciais corretos | OK |
| 1 | Sequências | frn_ct_seq, frn_md_seq, frn_eventos_id_seq sem USAGE/SELECT para anon/authenticated | as 3 existem; has_sequence_privilege = false para anon e authenticated (USAGE e SELECT); nenhum grant a PUBLIC | OK |
| 2 | RLS ligada | em todas as 13 tabelas | relrowsecurity = true nas 13 (force = false, como o arquivo) | OK |
| 2 | Policies frn_* | 1 policy SELECT por tabela, `to authenticated`, 10 no total, nenhuma de escrita | exatamente 10 SELECT/authenticated; quals idênticos aos arquivos (papeis: próprio ou admin; condicoes/fornecedores: sessão não nula; contratos: dono ou vejo_tudo; filhas: exists em frn_contratos) | OK |
| 2 | Policies fin_* novas | nenhuma (só chave de serviço) | nenhuma | OK |
| 2 | Grants de tabela | authenticated só SELECT nas 10 frn_*; anon nada; fin_* novas sem grant a anon/authenticated; PUBLIC nada | confere. service_role tem todos os privilégios (default do Supabase; os arquivos não revogam dele) | OK |
| 3 | Funções existentes | 47 em 001–006 (frn_*) + 5 fin_* (023: 1, 024: 4) = 52 | 52 no schema public, mesmas assinaturas; nenhuma extra | OK |
| 3 | security definer + search_path | definer onde o arquivo diz (frn_e_admin, frn_tem_*, frn_ve_tudo, frn_sou_admin, frn_vejo_tudo, frn__evento, frn__obra_rotulo, frn__pode_operar, frn_condicao_permitida, frn_dias_pagamento, frn_total/medido/em_aberto/parcelas_mo, frn_listar_obras e todas as de escrita); invoker em frn_email, frn__ator, frn__numero, frn__brl, frn_sugerir_condicao, frn_competencia, frn__eventos_imutavel e nas 5 fin_* | confere função a função; toda definer tem `search_path=public, pg_temp`; as que o arquivo marca têm também `row_security=off` | OK |
| 3 | EXECUTE (inclui PUBLIC por padrão) | authenticated só em frn_email/frn_sou_admin/frn_vejo_tudo; anon em nenhuma; service_role em todas; PUBLIC em nenhuma | anon = false em 52/52; authenticated = true só nas 3 esperadas; service_role = true em 52/52; nenhuma ACL com grantee PUBLIC e nenhuma ACL nula | OK |
| 3 | Função de trigger frn__eventos_imutavel | revogada de public/anon/authenticated | anon/authenticated = false; sem PUBLIC | OK |
| 4 | 023 — tabela fin_solicitacao_integracoes | colunas ambiente, origem, chave, solicitacao_id, criado_em; PK (ambiente, origem, chave); unique solicitacao_id; FK fin_solicitacoes ON DELETE CASCADE; checks de ambiente, origem ('fornecedores_medicao') e chave (1–100) | idêntico; RLS ligada; sem policy; sem grant a anon/authenticated; 0 linhas | OK |
| 4 | 023 — função fin_criar_solicitacao_integrada(jsonb) | invoker, search_path fixo, EXECUTE só service_role | invoker, `search_path=public, pg_temp`; anon=false, authenticated=false, service_role=true, sem PUBLIC | OK |
| 4 | 024 — tabelas fin_pagamentos_omie e _trava | colunas/checks/PK/FK/índice conforme arquivo; RLS ligada, sem policy, sem grant | idêntico; 0 linhas | OK |
| 4 | 024 — funções travar/destravar/registrar/por_solicitacao | só service_role | idem (anon/authenticated = false, service_role = true); fin_pagamentos_por_solicitacao é `stable` como declarado | OK |
| 4 | 024 — fin_solicitacoes intacta | sem colunas data_pagamento_omie / valor_pago_centavos | consulta ao information_schema: 0 dessas colunas em fin_solicitacoes | OK |
| 5 | Trigger frn_eventos_imutavel | BEFORE UPDATE OR DELETE, por linha, habilitado | presente, `tgenabled = O` (habilitado) | OK |
| 5 | Trigger frn_eventos_imutavel_truncate | BEFORE TRUNCATE, por statement, habilitado | presente, `tgenabled = O`; total de 2 triggers não internos em frn_eventos | OK |
| 5 | Bucket fornecedores-anexos | existe, privado, 10 MB, pdf/jpeg/png | `public=false`, limit 10485760, mimes {application/pdf,image/jpeg,image/png} | OK |
| 5 | Policies de storage do bucket | nenhuma (acesso só pelo servidor) | nenhuma policy em storage.objects que cite fornecedores | OK |
| 6 | Crons de fornecedores / pagamentos Omie (007, 025) | nenhum job | `cron.job` tem 12 jobs, todos preexistentes (compras-*, financeiro-producao-{catalogo,lancamento,programacao}, obras-*, field-sync, conciliacao). Busca por "fornecedor"/"pagamento"/"omie pag" em nome e comando: 0 resultados. Nenhum objeto de agendamento de fornecedores no catálogo | OK |
| 7 | frn_condicoes | 12 linhas | 12; ordens 1–12 únicas; todas ativas; modo/dias/so_global/exige_justificativa conforme seed (só TABELA_FIXA e CONSOLIDADO são so_global; EXCECAO exige justificativa; dias 7/15/null corretos); parcelas somam 100% nas 7 de modo `parcelas`; SPOT_A_VISTA e SPOT_D30 ausentes | OK |
| 7 | frn_fornecedores origem 'carga_inicial' | 1226 | 1226 (total também 1226); todos homologado = true, homologado_por = 'carga_inicial'. Catálogo `fin_catalogo_fornecedores` ativo em produção = 1226, com 0 fora do formato de documento/razão, então 1226 = tudo que podia entrar | OK |
| 7 | frn_papeis | eduardo.maia → aprovador_contratacao; jose.guilherme → aprovador_financeiro (seed 001) | exatamente 2 linhas, ambas ativo = true, concedido_por = 'seed 001 (C5)'; nenhuma outra | OK |
| 7 | Tabelas operacionais vazias | contratos, aditivos, medicoes, anexos, eventos, integrações, pagamentos = 0 (nada usado ainda) | todas 0 | OK |

## Observações (não são divergência)

- `service_role` mantém todos os privilégios de tabela nas tabelas novas. É o default do Supabase e os arquivos não pedem revogação; não afeta anon/authenticated.
- Os 3 `select` de verificação embutidos nos arquivos (001–006, 024) não foram reexecutados: foram substituídos por consultas equivalentes de leitura, porque dois deles chamam funções com `NULL` (não gravam, mas fogem à regra "só catálogo").

## Não verificável só com leitura

- **Corpos das funções** (`prosrc`) comparados com o texto dos arquivos: não feito. Conferi assinatura, volatilidade, `security definer`, config e ACL. Se quiser prova de que o corpo aplicado é o do arquivo, é possível comparar hash do `prosrc` com o texto extraído do `.sql` (também só leitura), mas não foi pedido.
- **Comportamento** das funções (ex.: `frn_ve_tudo(NULL)` = false, numeração acima de 9999, fronteiras de sugestão): exige executar funções; não chamado. Os blocos de verificação dos próprios arquivos cobrem isso e a outra sessão os rodou.
- **Idempotência da 023** (`create table` sem `if not exists`): reaplicar falharia por "already exists" e a transação desfaria sem dano. Não testável sem escrita; não é defeito do banco, só do arquivo.
