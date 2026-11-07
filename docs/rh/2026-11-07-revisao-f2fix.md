# Revisão independente das correções da F2 (Férias e Exames)

Branch `rh-f2` em `D:\rh-work\f2`, commits `560fe37`, `000cd2e` e `b76b12e` sobre `076b01c`
(`git diff 076b01c..b76b12e`). Revisão original: `docs/rh/2026-11-07-revisao-f2.md`, achados F1, F2,
F3, B1 e B4. Data: 07/11/2026.

## Veredito

**0 bloqueios.** Os cinco achados foram corrigidos. Não encontrei caminho para dado de saúde vazar,
para acesso falhar aberto, para dano de dado alcançável nem para quebra do que está em produção.
Ficam três itens de backlog, todos pequenos.

| Achado | Situação |
|---|---|
| F1. Link da movimentação para o exame | Corrigido: o passo 11.5 leva a `/exames?novo=1&pessoa=&mov=&tipo=encerramento`. Na admissão o link não existe, e isso está declarado em `DIVIDAS.md` |
| F2. Exame de encerramento depois do vínculo encerrado | Corrigido: quem está encerrado continua na lista do formulário, e o tipo fica travado em encerramento |
| F3. Carga inicial com ASO já vencido | Corrigido: o `min` saiu e a tela mostra um aviso (`avisoDeVencido`) |
| B1. Exame aberto de quem encerrou o vínculo | Corrigido: função `rh_encerrar_exame_sem_novo` e botão próprio |
| B4. Cancelar férias em andamento | Corrigido: coluna `dias_gozados` e helper `rh_ferias_dias_contados` |

## O que rodou

- `vitest run tests/ferias tests/exames tests/movimentacoes tests/hub-install/008-ferias.test.ts tests/hub-install/009-exames.test.ts --testTimeout=60000 --maxWorkers=2`: **14 arquivos, 276 testes, todos passaram.**
- `tests/hub-install-safety.test.ts` (regras de texto das migrations: `search_path`, `rh_*`, grants): passou.
- Teste descartável meu em `tests/rev/` (5 casos, todos passaram; já foi apagado):
  - **001 a 010 aplicam do zero e em ordem** num PGlite só (`abrirBanco("999")`), sem erro.
  - Grants: `rh_encerrar_exame_sem_novo` só `service_role` (anon e authenticated não executam); `rh_ferias_dias_contados` sem grant para ninguém.
  - Cancelar duas vezes: a segunda chamada não dá erro, não grava outro histórico, e `dias_gozados` continua 3. O saldo fica certo (30 − 3 gozados − 5 de outra marcação = 22). Numa marcação que não foi cancelada, `update ... set dias_gozados = 2` cai na constraint.
  - `rh_encerrar_exame_sem_novo`: anon e admin logado recebem `permission denied`; pela chave de serviço, autor comum ou admin sem papel `rh` é recusado (`Controladoria`). Com motivo marcado, nem `diretoria` nem admin o veem em `rh_historico_listar('exame')` ou em `rh_historico_da_pessoa`; logado sem papel leva `sem acesso`. Nenhuma linha de `rh_auditoria` contém o motivo.
  - `rh_salvar_exame` forjado: movimentação de outra pessoa → recusa. Tipo `periodico` ou `retorno` com movimentação de encerramento → recusa. `encerramento` com movimentação de admissão → recusa. Pessoa encerrada com `periodico` sem movimentação → recusa. Movimentação inexistente → recusa.
- `git status` da pasta: limpo antes e depois.

## O que conferi por leitura

**B4.**
- `rh_ferias_dias_contados` devolve `dias` para gozo vigente e `coalesce(dias_gozados, 0)` para gozo cancelado. É usado em saldo (`008:149`), conferência de saldo (`:247`), sobreposição (`:313-315`, com guarda `> 0`), `rh_em_ferias` (`:512`), contador `em_ferias` (`:548`) e `rh_ausencias_ferias` (`:621`).
- Não há dupla contagem: cada gozo entra uma vez, com dias ou com dias gozados, e a sobreposição impede marcar outra vez por cima do dia já gozado. Dia negativo também não acontece: a constraint `rh_ferias_gozos_gozados` (`:81-82`) prende `dias_gozados` entre 0 e `dias`, e exige 0 fora de `cancelada`.
- Cancelar antes de começar grava 0, e o gozo some do calendário. Cancelar depois do fim continua recusado (`:364`). Cancelar duas vezes não faz nada (`:361`).
- A trava (`:115-117`) congela `dias_gozados` depois de cancelado. Antes disso, a constraint segura o valor.
- `rh_agenda_ferias` (`:588`) e o "próximo gozo" (`:418`, `:429`) seguem excluindo os cancelados. Está certo: eles listam começos futuros.
- A tela (`diasGozadosAoCancelar`) faz a mesma conta do banco e avisa quantos dias ficam gozados.

**B1.** `009:280-324`:
- `security definer`, `search_path` e `row_security = off`; usa `rh_autor_rh`, que exige papel `rh` ativo.
- Trava o exame com `for update`. Repetir devolve `ja_arquivado: true`.
- Recusa exame de encerramento e vínculo que não esteja `desligado`. O motivo vai para o histórico como sensível (`true`), e a leitura filtra com `rh_ve_saude()` = papel `rh` (`005:255`, `:281`).
- `rh_contar_exames` e a agenda leem só exame aberto (`009:428`, `:454`, `:459`), então ele sai dos contadores.

**F1/F2.** Parâmetros forjados na URL (`app/(modulo)/exames/page.tsx:31-62`) só preenchem o formulário. Quem decide é `rh_salvar_exame` (`009:185-209`), que confere pessoa × movimentação, tipo × movimentação e pessoa encerrada só com encerramento. Isso já existia e foi provado no teste acima. A ação do servidor (`lib/exames/actions.ts`) não tem caminho que contorne o banco. `ligarPassosAoExame` cobre os três tipos de movimentação que o banco aceita (`006:82`).

## BLOQUEIO

Nenhum.

## BACKLOG

### R1. `rh_ausencias_ferias` devolve linha com 0 dias para férias canceladas antes de começar
- **Onde:** `supabase/hub-install/008_rh_ferias.sql:617-626`. Com `dias_gozados = 0`, `fim = inicio - 1`. Se `inicio` cai no mês e não é o dia 1, a linha passa no `g.fim >= v_ini`.
- **Cenário (medido):** férias marcadas para o dia 6 de um mês futuro e canceladas antes. A função devolve `{colaborador_id, dias: 0}`. Chega a `ausenciasNoMes` (`lib/ferias/fontes.ts:46-47`) como `Map(pessoa → 0)`. Hoje não dá dano: é sugestão para o VR que o RH confirma, e 0 não desconta nada. Mas uma tela que trate "está no mapa" como "teve férias" erra.
- **Correção:** acrescentar `and g.fim >= g.inicio` (ou a mesma guarda `> 0` da sobreposição) no `where`.

### R2. Cancelar no primeiro dia sempre consome um dia de saldo
- **Onde:** `008:370`, conta "até hoje, inclusive".
- **Cenário:** férias começam hoje, a pessoa não saiu, e o RH cancela de manhã. Um dia fica gozado. O direito já está em 30, então a conferência de saldo não devolve esse dia. A tela avisa antes de confirmar ("1 dia fica gozado, contando hoje").
- **Correção, se a empresa quiser:** no cancelamento, campo "último dia gozado", com padrão em hoje e permissão de escolher a véspera.

### R3. "Arquivar" continua oferecido junto de "Encerrar sem novo exame"
- **Onde:** `components/exames/registro.tsx:188-198`.
- **Cenário:** num periódico de quem já encerrou o vínculo, os dois botões aparecem. "Arquivar" ainda exige uma validade futura inventada, o problema original do B1, só que agora existe a saída certa ao lado. Não grava nada errado sem alguém digitar a data.
- **Correção:** esconder `ArquivarExame` quando `semNovo`.

## O que não consegui verificar

- As telas na vitrine, em qualquer largura. A ordem era não rodar a vitrine e não fazer build. `tests/exames/telas.test.ts` passou, mas não vi a tela.
- O texto exato do passo 11.5 renderizado na página da movimentação, com o link montado a partir de dado real. Conferi `ligarPassosAoExame` só por leitura.
- Corrida entre cancelar o gozo e marcar outro. O PGlite tem uma conexão só, então não testei; já está no backlog como B2.
- Se a 008 e a 009 já foram aplicadas em algum banco real. Como as correções alteraram as próprias migrations (coluna nova no `create table`), um banco que já tenha a 008 antiga não recebe `dias_gozados`. Pelo que li, a F2 ainda não foi aplicada em produção, mas não confirmei no banco.
