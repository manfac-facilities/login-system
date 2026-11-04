# Frotas, terceira bateria: roteiro de conferência depois do deploy

Para fazer **logado em produção** (`https://hub.manfac.com.br/sofia`), depois de aplicar os dois SQL e do Deploy.
Antes de tudo, confirme o build pelo `Last-Modified` dos chunks (não pelo painel do EasyPanel).

Papéis para testar: **admin**, **gestor de frotas** e **usuário comum do Sofia**. Onde o roteiro diz "como gestor" e
"como admin", use duas sessões (janela anônima para a segunda). Para não sujar dado real, use um veículo de teste e
apague/encerre o que criar quando a tela permitir; o que não permite apagar (corretiva concluída, foto, etapa de multa)
fica como registro: prefira uma multa e um checklist de teste combinados com o Igor.

Fontes: specs `docs/superpowers/specs/2026-11-03-frotas-manutencao-e-bases-design.md` e
`2026-11-03-frotas-multa-fotos-checklist-design.md`; decisões `docs/frotas/2026-11-03-decisoes-terceira-bateria.md`.

## 0. Antes de clicar: o SQL entrou? (só leitura)

Rodar no SQL Editor (ou pela Management API, projeto `iyytcavcgukfjnjjrerx`). Todas são `select`.

```sql
-- Manutenção: colunas e tabela (esperado: 3 linhas em colunas, 1 em tabela)
select table_name, column_name from information_schema.columns
 where table_schema='public'
   and ((table_name='revisoes' and column_name in ('prever_proxima','origem'))
     or (table_name='veiculos' and column_name='intervalo_revisao_km'));
select to_regclass('public.manutencoes') is not null as tabela_manutencoes;
select proname from pg_proc
 where proname in ('sofia_abrir_manutencao','sofia_concluir_manutencao'); -- 2 linhas
-- Manutenção sem DELETE (esperado: false)
select has_table_privilege('authenticated','public.manutencoes','DELETE') as pode_deletar;
-- As 20 corretivas antigas não preveem próxima (esperado: 0)
select count(*) from public.revisoes where tipo='corretiva' and prever_proxima;

-- Multa: colunas novas (esperado: 13), etapa preenchida em todas (esperado: 0 sem etapa)
select count(*) from information_schema.columns
 where table_schema='public' and table_name='multas'
   and column_name in ('etapa','locadora','auto_infracao','orgao_autuador','pontos','prazo_indicacao',
     'motorista_condutor_id','indicado_em','protocolo_indicacao','boleto_lancado_em','pago_em_dobro',
     'responsavel_dobro','desconto_competencia');
select count(*) as multas_sem_etapa from public.multas where etapa is null;
select etapa, count(*) from public.multas group by 1 order by 1;
-- Tabelas, funções e triggers de multa/avaria (esperado: tudo preenchido)
select to_regclass('public.multa_etapas') is not null as multa_etapas,
       to_regclass('public.checklist_avarias') is not null as checklist_avarias,
       to_regprocedure('public.sofia_multa_registrar_etapa(uuid,text,jsonb)') is not null as rpc_multa;
select tgname, tgrelid::regclass, tgenabled from pg_trigger
 where tgname in ('trg_multas_etapa','trg_fotos_imutaveis','trg_excluir_so_admin','trg_checklist_avarias_guarda')
   and not tgisinternal order by 1, 2;  -- esperado: 1 + 2 + 2 + 1 linhas, tgenabled = 'O'
-- Fotos imutáveis: sem UPDATE/DELETE para os papéis do app (esperado: false nas quatro)
select has_table_privilege('authenticated','public.checklist_fotos','DELETE') d1,
       has_table_privilege('authenticated','public.checklist_fotos','UPDATE') u1,
       has_table_privilege('authenticated','public.sinistro_fotos','DELETE') d2,
       has_table_privilege('authenticated','public.sinistro_fotos','UPDATE') u2;
-- Storage restrito ao Sofia (esperado: 4 linhas, todas com sofia_has_access no texto)
select policyname, (coalesce(qual,'') || coalesce(with_check,'')) like '%sofia_has_access%' as restrita
  from pg_policies where schemaname='storage' and tablename='objects'
   and policyname in ('authenticated read checklist','authenticated upload checklist',
                      'authenticated read anexos','authenticated upload anexos');
-- Nenhuma fotografia com posição desconhecida sem tipo_foto (esperado: 0)
select count(*) from public.checklist_fotos where tipo_foto is null and posicao like 'Avaria%';
```

Se qualquer linha vier diferente do esperado, **pare**: não siga com o roteiro de telas.

## 1. Revisão a cada 10 mil km (`/sofia/revisoes`)

1. Abra **Revisões**. Aparece o cartão do intervalo (10.000 km), 4 cartões (Atrasadas; Vencem em até 1.000 km; Chegam em
   até 30 dias; Sem previsão automática) e a tabela, um carro por linha, do mais urgente ao menos.
2. Clique num cartão: a lista filtra e a URL ganha `?sit=...`. Clique de novo/limpar: volta.
3. Carro em `manutencao` aparece com "na oficina". Carro sem revisão: "Sem revisão registrada".
4. Clique numa linha: abre `/sofia/revisoes/nova?veiculo=...` com o carro escolhido e a KM realizada já no KM atual.
5. No formulário, escolha **Calcular sozinha**: a prévia diz "Próxima revisão em X km" (com média de km/dia, completa
   "chega em ~N dias"). Troque para **Informar à mão** e **Não prever a próxima**: a prévia acompanha. Tipo Corretiva
   seleciona "Não prever" sozinho.
6. Digite um KM menor que o da última revisão com data igual ou posterior: deve recusar com "O KM (X) é menor que o da
   última revisão deste carro (Y). Confira o número."
7. Ficha do veículo (`/sofia/veiculos/[id]`), como gestor: campo de intervalo próprio. Salve 8.000: a Revisões passa a
   calcular com 8.000 para esse carro. Como usuário comum o campo não aparece.
8. Pendências e Visão geral: carros atrasados e "Revisão chegando: PLACA, faltam X km" coerentes com a tela de Revisões.

## 2. Importação da planilha (`/sofia/revisoes`, botão "Importar planilha")

1. Como **usuário comum** o botão não aparece. Como **gestor** aparece.
2. Envie uma planilha pequena de teste (3 linhas: uma boa, uma com placa inexistente, uma repetida de revisão que já
   existe). Passo de mapeamento de colunas aparece (a planilha real do Igor ainda não foi recebida: conferir com ela antes
   da primeira carga de verdade).
3. Prévia: boa = ok; placa inexistente = erro; repetida = marcada; KM maior que o atual = aviso (só grava se marcar
   "incluir avisos").
4. Confirme. Deve gravar só as válidas, tudo-ou-nada; as importadas aparecem no **Histórico**
   (`/sofia/revisoes/historico`) com origem "importada".
5. Confira que a **importada antiga não virou a vigente**: o carro continua com a situação calculada pela revisão de
   maior KM, e na base as outras ficam "Histórico".

## 3. Manutenção corretiva (`/sofia/manutencoes`)

1. Como **usuário comum** a lista abre, mas "Nova manutenção" não aparece e `/sofia/manutencoes/nova` redireciona.
2. Como **gestor**: "Nova manutenção", escolha um carro de teste, defeito, oficina, data de entrada, com o checkbox
   "tirar da equipe" **marcado**. Salvar. O carro passa para `manutencao`, sai da equipe, e a linha aparece como
   "Aguardando orçamento".
3. Avance o status (aguardando aprovação, em conserto). Anexe um arquivo: "Ver anexo" abre por link assinado.
4. **Concluir**: informe data de saída, custo e quem arca. O carro volta para `ativo`, a manutenção vira "Concluída",
   "Dias parados" aparece. Concluir sem custo mostra "a definir".
5. Abrir duas corretivas no mesmo carro: concluir uma não devolve o carro enquanto a outra, que também o tirou, estiver
   aberta (regra da RPC).
6. Não existe botão de excluir nem editar a concluída (de propósito, dívida registrada).
7. Veículo `EWH1B84` está em manutenção com equipe preenchida (dado de produção, ver `docs/DIVIDAS.md`): **não** use
   esse carro no teste.

Leitura de conferência (só leitura), depois do passo 4:

```sql
select id, veiculo_id, status, tirou_da_equipe, data_entrada, data_saida, custo, quem_arca, criado_por
  from public.manutencoes order by created_at desc limit 5;
select operacao, tabela, registro_id, descricao, dados from public.audit_log
 where tabela in ('manutencoes') limit 20; -- ordene pela coluna de data do audit_log (select * mostra o nome)
```

## 4. As 5 bases novas e o botão Exportar

Rotas: Revisões `/sofia/revisoes/historico`, Corretiva dentro de `/sofia/manutencoes`, Multas `/sofia/multas`,
Sinistros `/sofia/sinistros`, Documentos `/sofia/documentos`.

Em cada uma:
1. A tabela abre **sem período** (mostra tudo), com busca e os filtros próprios (Revisões: de/até, placa, tipo, situação;
   Corretiva: status e quem arca; Multas: motorista, situação, autorização; Sinistros: tipo, situação; Documentos:
   tipo e situação, sem período).
2. Clique numa linha: abre a gaveta com os detalhes. Ordene por uma coluna. Rodapé com totais.
3. **Exportar**: baixa `.xlsx` (`frotas-revisoes-…`, `frotas-manutencao-corretiva-…`, `frotas-multas-…`,
   `frotas-sinistros-…`, `frotas-documentos-…`). Abra: dinheiro vem como número, datas em dd/mm/aaaa, autorização em
   texto, e **nenhuma coluna com caminho de arquivo** (só "tem arquivo: sim/não"). Aplique um filtro e exporte de novo:
   só saem as linhas filtradas.
4. As 4 bases antigas (Abastecimento, KM, Motoristas, Veículos) seguem iguais.
5. Multas e Sinistros: seleção em massa, ações de autorização e Excluir comportam-se como antes, e só aparecem para quem
   pode (o Excluir do sinistro só para admin, ver seção 8).

## 5. Fluxo de multa por etapa (`/sofia/multas/[id]`)

Use uma multa de teste. Etapas: Registrada, Confirmar condutor, Termo, Indicado, Validada (ou Contestada), Boleto lançado
(cobrada), Solicitar desconto, Autorizar desconto, Descontada.

**Como gestor de frotas:**
1. Em "Registrada" a tela oferece só a próxima etapa. Registre o condutor (sugestão vem do motorista do dia), depois o
   termo (anexe o papel; compressão se for imagem), depois a indicação (protocolo e data; o prazo de indicação aparece
   com 30 dias a partir do recebimento).
2. Valide em nome do gestor da equipe, lance o boleto e **Solicitar desconto** (informe valor e competência).
3. Na etapa **Solicitado** o botão "Autorizar" aparece **desabilitado com o motivo** ("só administrador autoriza").
   Tentar forçar não passa: o banco recusa.
4. "Cancelar solicitação" volta para boleto lançado (permitido ao gestor).
5. Depois de solicitada, `valor`, motorista e condutor não editam mais (congelam no pedido).
6. Multa em dobro: marque "pago em dobro" e o responsável.

**Como admin:**
7. Na multa **Solicitado**, "Autorizar desconto" funciona (vai a Autorizado). "Revogar" volta a Solicitado.
8. Com a multa **Autorizada**, o gestor consegue registrar "Descontada" (RH desconta) e "Desfazer desconto" (volta a
   Autorizado e limpa valor/tipo/competência).
9. A trilha de quem fez cada etapa aparece no detalhe (tabela `multa_etapas`).

Pular etapa para frente é permitido (a tela registra a etapa pulada como "não registrada"); `descontada` só a partir de
`autorizado`; `contestada` é final.

```sql
-- Trilha da multa de teste (troque o id): etapa, quem, quando
select etapa, etapa_anterior, feito_por, em_nome_de, feito_em from public.multa_etapas
 where multa_id = '<ID_DA_MULTA>' order by feito_em;
-- status e autorizacao_status são derivados da etapa (devem bater com a tabela da spec §2.1)
select etapa, status, autorizacao_status, valor, valor_descontado from public.multas
 where id = '<ID_DA_MULTA>';
```


## 6. Pendências (B8) e Descontos

1. **Pendências** (`/sofia/pendencias`): cada multa mostra o texto da etapa em que está ("<placa>, <infração>…"). Antes da
   indicação, o prazo é o `prazo_indicacao`; multa em `solicitado`/`autorizado` vai para **"Aguardando terceiros"**.
   Multa descontada não aparece.
2. **Descontos** (`/sofia/descontos`): a lista de **multas aparece** (se sumir, a seleção ambígua PGRST201 voltou: ver
   `motoristas!motorista_id(nome)` em `descontos/page.tsx`). Os botões antigos de multa sumiram e há o link "Abrir no
   fluxo da multa". Sinistros e KM seguem como antes.
3. O e-mail diário de alertas só confere depois que o segredo e o cron forem configurados (item separado do deploy).

## 7. Fotos extras, avaria e câmera (`/sofia/checklist/novo`)

1. No checklist, as 4 posições obrigatórias + Interna continuam. **Só câmera ao vivo**: não há "escolher da galeria".
2. "+ Mais fotos (ângulo livre)": adiciona miniaturas com "x" (apagar só no rascunho, antes de salvar). No 30º, o botão
   some e aparece "Limite de 30 fotos".
3. "+ Registrar avaria": peça, tamanho, e **pelo menos 1 foto da peça e 1 do dano**; sem isso não adiciona. Se deixar uma
   avaria preenchida sem clicar em adicionar e enviar, ela se perde (dívida conhecida; hoje a tela não avisa).
4. Salve. O detalhe mostra as fotos extras ("Extra 1…") e a avaria.
5. **Sinistro novo**: lista de fotos com "Mais fotos", galeria permitida, teto 30.
6. Na **troca de carro** (`tipo = troca`), cada posição mostra a foto da mesma posição do último checklist ("Último:
   Frente · dd/mm/aaaa"); sem anterior: "Primeiro checklist deste veículo." A trava D1 continua como antes.

## 8. Exclusão só admin, fotos imutáveis

1. Como **usuário comum e gestor**: o botão Excluir do checklist e do sinistro não aparece (ou, se forçado, a mensagem é
   "Apenas administradores…").
2. Como **admin**: exclua um checklist **de teste com fotos** (e um sinistro de teste). Deve excluir sem erro.
3. Confira o registro:

```sql
select operacao, tabela, registro_id, descricao, dados->'fotos' as fotos
  from public.audit_log
 where tabela in ('checklist','sinistros') and operacao = 'excluiu'
 limit 20; -- ordene pela coluna de data do audit_log
```
   Esperado: uma linha por exclusão, com os caminhos das fotos em `dados.fotos` (os arquivos continuam no bucket, por
   desenho).
4. Não existe nenhuma tela para apagar ou trocar uma foto avulsa; nenhum papel, nem admin, consegue. (Teste real só em
   PGlite; em produção, não tente apagar foto.)
5. Marcar avaria como reparada: botão desabilitado com o motivo para usuário comum; gestor/admin marca com data (padrão
   hoje); depois de reparada não volta nem muda.

## 9. Histórico do checklist (`/sofia/checklist/veiculo/[veiculoId]`)

1. Na lista de checklists, a linha tem "Histórico do veículo". Abre a tabela: Data, Tipo, Motorista, Avarias; o primeiro
   checklist do carro leva o rótulo "base". Qualquer usuário do Sofia consegue abrir.
2. Comparação padrão: o mais recente contra o anterior. "Comparar com a entrada (base)" usa o mais antigo. Escolher dois
   iguais: "Escolha dois checklists diferentes."
3. Alterne **lado a lado** e **sobreposto** (controle de opacidade). "Outras fotos" mostra as extras e de avaria.
4. "O que mudou (automático, só dos dados)": item OK que passou a problema (e o inverso), "Avaria nova", "Avaria
   resolvida", "Avaria continua". Não há comparação de imagem nem KM (não existe no checklist).
5. Abaixo, avarias abertas do veículo com "Marcar como reparada" (gestor/admin).

## Se algo falhar

- Erro 500 nas telas de Revisões/Manutenções: o SQL de manutenção não foi aplicado (seção 0).
- Descontos sem multas ou multa que não muda de etapa: conferir se o deploy subiu (chunks) e a seção 0 de multa.
- Qualquer divergência nos `select` da seção 0: não corrigir à mão; avisar o João (os SQL têm teste e rollback próprios).
