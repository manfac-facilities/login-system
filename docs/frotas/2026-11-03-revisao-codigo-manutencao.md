# Revisão independente de código — `feat/frotas-manutencao` (03/11/2026)

Revisor: agente independente (não escreveu o código). Escopo: `git diff master...HEAD` na worktree
`C:\Users\joao-\wt-frotas-manutencao` (10 commits, de `58ba962` a `965fe0a`), código TS/TSX. O SQL tem
revisão própria (`docs/frotas/2026-11-03-revisao-sql-manutencao.md`). Aqui só conferi se as actions batem com ele.

## Veredito

**Aprovado. Nenhum bloqueante.** Há uma **condição de deploy** que já está no plano (T10 + SQL antes),
e ela é obrigatória. Abaixo, 6 itens não bloqueantes para o backlog.

## Verificação executada

- `npx tsc --noEmit`: 27 erros, **todos** em `app/obras/**`, `app/portal-obra/**` e `scripts/**`
  (dependência ausente na junction, que pode ser ignorada). Nenhum erro em Sofia ou `lib/`.
- `npx jest lib/sofia app/.operacoes./sofia app/api/frotas`: 60 suites passaram, 638 testes.
  1 suite (`lib/sofia/extratos/__tests__/agrupar.test.ts`) caiu porque o worker do Jest ficou sem
  memória. Rodei ela sozinha (`npx jest lib/sofia/extratos`): 3 de 3 suites e 42 testes verdes.
  Não tem relação com o branch.

## Os 7 focos

### 1. Escrita antes da checagem de papel: OK
- `manutencoes/_actions.ts`: `abrir`, `avancarStatus`, `concluir` e `anexar` chamam `requireGestorFrotas`
  **antes** de qualquer leitura ou escrita. Há teste "sem gestor → negado sem RPC/sem update" para as quatro.
- `revisoes/_actions.ts`: `importarRevisoesAction` e `definirIntervaloRevisaoAction` checam o papel antes de
  gravar. `criarRevisaoAction` fica sem guarda nova, como o plano manda (T6.1, "colisão 2 da spec").
  `excluirRevisaoAction` não mudou.
- `verAnexoManutencaoAction` e `obterUrlDocumentoPorIdAction` só leem. Exigem sessão, e a RLS
  (`manutencoes_ler` = `sofia_has_access()`, `documentos_veiculo` com "sofia access") barra quem não tem
  Sofia. O caminho do arquivo vem do banco pelo id, nunca do navegador.
- `manutencoes/nova/page.tsx` redireciona quem não é gestor.
- Conferência com o SQL:
  - Os nomes das RPCs e os 10 parâmetros de `sofia_abrir_manutencao` batem, na ordem.
  - Os 4 parâmetros de `sofia_concluir_manutencao` batem.
  - Os updates diretos só tocam colunas que estão no grant por coluna: `status` e `updated_at` (avançar),
    `anexo_storage_path` e `updated_at` (anexar).
  - O `.select('id')` depois do update é coberto pelo `grant select`.
  - `p_tirar_da_equipe` vem do checkbox, que já começa marcado (`checked={tirar}`).

### 2. Importação: OK
- A action não confia no navegador. Para cada linha recebida, refaz as células com `paraCelulas`
  (placa, km, data…) e roda de novo `validarLinhas` contra o banco. `veiculo_id` e `resultado` que vêm
  do cliente são descartados.
- A action também refaz estas checagens:
  - placa cadastrada;
  - KM e data válidos;
  - data no futuro dá erro;
  - repetida (mesma placa e KM) no banco **e** dentro do próprio arquivo;
  - KM maior que o atual vira aviso, e o aviso só é gravado com `incluirAvisos === true`.
- A gravação é um único `insert` (tudo ou nada), só de inserção. **Nunca faz update nem delete em revisão
  existente.** `proxima_km` é recalculada no servidor com o intervalo do carro.
- Testes cobrem: sem gestor, aviso desmarcado (revalidado no servidor), repetida, erro no insert.

### 3. Regra da revisão vigente: correta e testada
- `revisaoVigente`: maior `km_realizada` (KM nulo vai para o fim), desempate por `data_realizada` e depois
  por `created_at`.
- Testes: "importada antiga não vira vigente", "KM nulo vai para o fim", empate, corretiva vigente →
  "sem previsão".
- `montar-novas.test.ts` confere que a base mostra a situação só na vigente e "hist" no resto.
- `criarRevisaoAction` bloqueia KM menor que o da vigente quando a data é igual ou posterior, sem barrar
  histórico antigo.

### 4. Exportar Excel: OK
- As linhas (`CorrLinha` e `DocLinha`) só levam `temArquivo: boolean`. `storage_path` e
  `anexo_storage_path` são lidos em `leitura.ts` só para calcular isso.
- Nenhuma `EXCEL_*` tem caminho de arquivo, e há teste "nenhum valor de planilha é caminho de arquivo".
- A exportação usa as linhas já carregadas com o cliente do usuário (RLS), então só sai o que ele já vê
  na tela.

### 5. Bases antigas e Multas/Sinistros: OK
- `FILTROS_DA_BASE` reproduz exatamente os filtros e a ordem antigos de `abast`, `km`, `mot` e `veic`.
- `filtrarLinhas` e `filtrosDaUrl` das 4 bases antigas seguem pelo caminho antigo (o ramo novo só entra
  em `BASES_NOVAS`).
- `novoHref` passou a ser opcional sem mudar quem já passa. A leitura de veículos continua `select('*')`,
  então as 4 bases não dependem do SQL novo.
- **Multas não foi tocado neste branch** (fica para a T10). Seleção em massa, desconto e excluir continuam
  como no master.
- Sinistros mantém as mesmas actions de antes:
  - `AutorizacaoActions` com `atualizarAutorizacaoSinistroAction.bind(null, id)` e
    `showActions={podeGerir}`, numa célula que não abre a gaveta;
  - `DeleteConfirmButton` + `excluirSinistroAction`, que ainda confere o gestor no servidor.
  - Antes o botão de excluir aparecia para todos e falhava no servidor. Agora só aparece para gestor.
    É uma melhora.

### 6. APIs do Next desta versão: OK
- `searchParams` é `Promise` e recebe `await` em todas as páginas novas.
- As server actions com argumentos que não são `FormData` (`importarRevisoesAction(linhas, bool)`,
  `concluirManutencaoAction(id, obj)`) são válidas.
- `.bind` de server action dentro de client component é suportado.
- `useActionState` está correto.
- Conferi `node_modules/next/dist/docs/.../serverActions.md`: o limite padrão de corpo de uma server
  action é **1 MB** (ver não bloqueante N1).

### 7. Bugs de lógica
Nenhum que cause dano de dado ou falha de autorização. Os achados vão abaixo como não bloqueantes.

## Condição de deploy (obrigatória, já prevista no plano)

**Não publicar este branch, nem rodar a importação em produção, antes de duas coisas:**

1. **Aplicar o SQL.** O código lê `prever_proxima`, `origem`, `intervalo_revisao_km` e a tabela
   `manutencoes`. Sem o SQL, `/sofia/revisoes`, `/historico`, `/manutencoes` e o formulário de revisão
   quebram.
2. **Fazer a T10.** `lib/sofia/queries.ts:122` (`classificarRevisoesMaisRecentes`, que ainda ordena por
   `created_at`) e `lib/sofia/alertas/leitura.ts` ainda usam a regra antiga, "a criada por último".
   Se a planilha de histórico for importada antes da T10, Pendências, Visão geral e o e-mail de alertas
   vão pegar a revisão **importada** como a mais recente e mostrar alerta errado, enquanto o painel novo
   mostra o certo. A Sidebar também ainda não tem os links de "Manutenção corretiva" e "Histórico".

## Não bloqueantes (backlog)

- **N1. Limite de 1 MB na importação.** `revisoes/_importar.tsx:136` envia `previa` inteira, com as linhas
  de erro e repetidas, para a server action. O arquivo aceito vai até 2 MB e 2.000 linhas. Uma planilha
  grande ou com observações longas pode passar de 1 MB. Aí a action falha e aparece "Nada foi gravado":
  não estraga dado, mas a importação não roda.
  Correção: enviar só `linhasParaGravar(previa, comAvisos)` (o servidor revalida igual), ou configurar
  `serverActions.bodySizeLimit`.
- **N2. Anexo trocado deixa arquivo órfão.** `manutencoes/_actions.ts:124` grava o caminho novo e o
  arquivo antigo fica no bucket `sofia-anexos`. Só custa armazenamento.
- **N3. Importação aceita carro inativo.**
  - `revisaoLeitura.ts:59` (contexto da prévia) e a leitura de veículos em `importarRevisoesAction` não
    filtram `status = 'inativo'`, então uma placa desativada importa normalmente.
  - Não causa dano: o carro inativo não aparece no painel.
  - Se quiser barrar, transformar isso em aviso.
- **N4. Importação dupla concorrente.** Não há chave única `(veiculo_id, km_realizada)`. Duas abas
  importando a mesma planilha ao mesmo tempo gravam em dobro. O botão fica desabilitado durante o envio,
  então só acontece com duas abas abertas. Registrar em `DIVIDAS.md`.
- **N5. Concluir sem validação no servidor.** `concluirManutencaoAction` não chama `validarConclusao`
  (o cliente chama), e um custo inválido vira `null`. A RPC valida tudo e devolve SOF01 com a mensagem
  certa, então o resultado é o mesmo. Fica anotado só para consistência.
- **N6. Já existia antes, fora do escopo.** As policies do bucket `sofia-anexos` (`sdd-sql-passo3.sql`)
  deixam qualquer usuário logado enviar e ler qualquer objeto do bucket. As actions novas não pioram isso
  (o caminho vem do banco e a URL assinada dura 60 s), mas um não gestor consegue subir arquivo em
  `manutencoes/<id>/` pelo devtools. O arquivo fica solto, sem vínculo, porque `anexarManutencaoAction`
  exige gestor. Vale um item próprio na dívida de storage.
