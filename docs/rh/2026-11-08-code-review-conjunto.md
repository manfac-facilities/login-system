# Code review do conjunto do RH (08/11/2026)

Diff `aad6530...aabac50` de `manfac-facilities/rh`, os 13 módulos. Achados por leitura do código, **sem reprodução**. As telas ficaram de fora, salvo as citadas. A coluna Veredito é preenchida pela verificação independente.

| # | Arquivo | Achado | Veredito |
|---|---|---|---|
| A1 | `lib/pagamentos/rotulos.ts:57`, `lib/pagamentos/actions.ts:372` | `refazerPelaTela` só barra rascunho com tentativa > 1. Depois de recusa definitiva (`situacao_local='erro'`, chave liberada), a conta de celular é corrigida de R$ 200 para R$ 250, a linha ainda oferece "Enviar", e saem R$ 200 com o rateio antigo, com a conta de R$ 250 travada. Vale também para rascunho t1 e para seguro depois de mudar a relação. Se `repo.obter` falhar, a guarda é pulada e o envio segue | CONFIRMADO, BLOQUEIO, sem migration |
| A2 | `015:154`, `015:218`, `004` (`rh_retirar_rascunho`) | `pagamento_id` tem FK sem ON DELETE e `rh_salvar_rascunho` já grava o vínculo. "Retirar" viola a FK em seguro e celular: a linha não sai, a tela diz "Não deu para concluir agora", e a competência fica com o valor no total | CONFIRMADO, BACKLOG, migration para o conserto definitivo (esconder o botão não exige) |
| A3 | `006:1371` | `rh_movimentacao_no_json` devolve `motivo_cancelamento`, `motivo_conclusao` e `pendencias_no_fim` a qualquer `rh_pode_ver`, incluindo admin sem papel, também direto pelo navegador. O 005 e `rh_candidato_no_json` tratam motivo livre como só-rh | CONFIRMADO, BACKLOG (a tela avisa; decisão já pendente com o João), migration |
| A4 | `lib/beneficios/regras.ts:90`, `components/pagamentos/tela-vr.tsx:149` | A sugestão de ausências do VR soma dias corridos, e "Usar a sugestão" os põe no campo que `calcularVr` subtrai de dias úteis. 10 corridos com 8 úteis em mês de 22 úteis: paga 12 em vez de 14. Com 30 dias, dá erro de faixa. Férias e atestado sobrepostos somam duas vezes | CONFIRMADO, BACKLOG, sem migration para o mínimo |
| A5 | `lib/seguro/regras.ts:19`, `preparo.ts:845`, `rh_seguro_incluir` | `seguradosNoMes` devolve períodos, não pessoas. Quem tem dois períodos no mês conta duas vezes no previsto e no peso do rateio | CONFIRMADO, BLOQUEIO, sem migration |
| A6 | `011:728` | `rh_movimento_banco` com `p_lancamento` aceita qualquer `p_minutos` e sinal, sem conferir com `decisao_minutos`. Divergência de 02:00 pode gravar +20:00; o banco é imutável e o índice único impede novo movimento ligado | CONFIRMADO em parte, BACKLOG, sem migration (há correção por movimento avulso) |
| A7 | `005:592` | `rh_arquivo_marcar_removido` não confere se o arquivo sustenta um passo `exige='arquivo'` feito (só para termo de patrimônio). O passo segue feito sem o documento, e `rh_registrar_esocial` continua contando 6.8 como conferida | CONFIRMADO, BACKLOG, migration |
| A8 | `015:324` | `rh_pagamento_ligar_mes` marca o passo 13.7 ao gravar rascunho, antes de qualquer envio, enquanto `rh_seguro_mes_abrir` exige `chave_em_uso` para o mesmo passo. O mês parece completo sem cobrança no Financeiro | CONFIRMADO, BACKLOG, migration |
| A9 | `014:208` | `rh_salvar_comunicado` só trava com `enviado_em`. Depois de envio parcial, o texto pode ser editado; o reenvio manda outra versão a quem falhou e marca tudo como enviado | CONFIRMADO, BACKLOG, sem migration se a trava for na action |
| A10 | `011:1486` | `total_centavos` de `rh_listar_competencias` soma a tentativa mais recente mesmo recusada, cancelada ou rascunho. A diretoria lê custo maior que o real | CONFIRMADO, BACKLOG, migration para o número (trocar o rótulo não exige) |

## Verificação independente

Rodado em `D:/rh-work/verif-cr` (commit `aabac50`): `vitest run tests/verif-cr --maxWorkers=1 --testTimeout=60000`, 3 arquivos, **15 de 15 passando**, com banco PGlite e as migrations 001 a 015. Testes descartáveis, sem commit. Em A1 e A2, actions, envio e repositório são os de verdade; só a porta do Financeiro é falsa. O botão foi conferido renderizando `TabelaPagamentos` no servidor, não em navegador.

### A1. CONFIRMADO, BLOQUEIO
Rodado: recusa definitiva, conta salva em R$ 250 (a trava não pega, chave liberada), HTML com "Enviar de novo", clique. Corpo enviado: `{"valor":"200,00","rateio":[{"departamentoCodigo":"1.01","valor":"200,00"}]}`; conta travada em 25000, pagamento em 20000.
Seguro t1 sai por "Enviar" depois de mudar a relação. T2 é barrado (controle); com `rh_obter_pagamento` falhando uma vez, a guarda é pulada e envia (a tela esconde o botão: exige página antiga ou chamada direta).
Por que bloqueia: a linha mostra R$ 200, mas sem confirmação nem comparação com a conta, e o rateio não aparece; `components/celular/tela.tsx` não compara com o pagamento.
Correção: ~10 linhas. `refazerPelaTela` barra seguro e celular sempre que `!chave_em_uso`, e a action falha fechada se a leitura falhar. Sem migration. `erro` com chave em uso segue reenviando: é a recuperação pela mesma chave. Cuidado: seguro tem bloqueio de duplicidade, e a liberação escrita depende de "Enviar de novo" com a chave solta; a correção precisa manter esse caminho, e remontar pela tela zera a liberação.

### A2. CONFIRMADO, BACKLOG
Rodado: `retirarRascunho` em seguro e celular devolve "Não deu para concluir agora. Tente de novo."; log `rh_seguro_meses_pagamento_id_fkey` e `rh_celular_contas_pagamento_id_fkey`; linha permanece; VR sai (controle).
Não é bloqueio: nada sai nem se perde, e refazer pela tela do módulo regrava o mesmo rascunho.
Correção: esconder "Retirar" nos dois tipos, 1 linha, sem migration. Definitivo: ~5 linhas na migration 016, soltando o vínculo no mesmo comando.

### A3. CONFIRMADO, BACKLOG (decisão do João)
Rodado como `authenticated`, direto na função: admin sem papel e diretoria recebem o texto marcado com CID em `motivo_cancelamento`, `motivo_conclusao`, `pendencias_no_fim` e na lista.
Guarda que o achado não viu: a tela avisa ao digitar e ao ler ("Diretoria e administradores também leem este texto", `concluir.tsx:74` e `:213`, `registro.tsx:187` e `:193`), e isto já está em `docs/rh/2026-11-07-para-o-joao.md:15` como decisão pendente.
Se o João tratar como vazamento, vira BLOQUEIO: nenhum filtro impede CID ou CPF nesses campos.
Correção: ~5 linhas em função do 006, migration 016.

### A4. CONFIRMADO, BACKLOG
Rodado: `calcularVr` com 10 ausências em 22 úteis dá 12 dias (com 8, 14); 30 dá "Use um número de dias de 0 a 22"; férias 10 + atestado 3 somam 13; atestado de 3 dias a partir de um sábado conta 3.
Guarda que o achado não cita: "Usar a sugestão" é clique da pessoa, a coluna "Dias pagos" mostra o resultado, e a cobrança real acima de R$ 10 de diferença bloqueia com "Confira os dias de ausência" (testado). Se a cobrança foi pedida com o mesmo número errado, passa.
Correção: mínimo sem migration, ~5 linhas, rotular como dias corridos. Conta exata é média e mexe em `rh_ausencias_ferias`, com migration.

### A5. CONFIRMADO, BLOQUEIO
Rodado pelo caminho real (`rh_seguro_incluir`, `rh_seguro_excluir` e incluir de novo no mês, depois `planoSeguro`): a relação dá 3 linhas para 2 pessoas. Boleto de R$ 200 sem prêmio: `1.01` R$ 133,33 e `1.02` R$ 66,67, sem erro, em vez de R$ 100 cada. Prêmio de R$ 8 também passa. Prêmio de R$ 100 com boleto certo bloqueia por engano.
Por que bloqueia: a prévia mostra totais por centro, não o peso por pessoa; o único sinal é "Segurados (3)". Ajuda: corrigir data de inclusão pelo caminho retirar e incluir já cria isso. A planilha da seguradora (`seguro/actions.ts:171`) também repete a pessoa.
Correção: ~5 linhas, um por `colaborador_id` em `seguradosNoMes`. Conferir a lista da tela, que usa a mesma função. Sem migration.

### A6. CONFIRMADO em parte, BACKLOG
Rodado: decisão de 120 min aceita movimento de 1200; repetir com 120 devolve o mesmo id, e o valor fica 1200; update recusa ("só cresce").
Parte que cai: "imutável" não trava a correção. Movimento avulso de -1080 fechou o saldo em 120 (testado), e a tela diz "para corrigir, lance outro movimento".
Conferir com a decisão também não é regra pronta: compensação de -120 é legítima, e a decisão nunca é negativa. É digitação visível de quem tem papel `rh`.
Correção: ~10 linhas sem migration, trazendo as horas da decisão já preenchidas. Trava no banco exige definir a regra de sinal, e migration.

### A7. CONFIRMADO, BACKLOG
Rodado: 6.8 sem arquivo recusa; com arquivo fica feita; removido o arquivo, 0 vivos, passo `feita`, `rh_registrar_esocial` aceita. A tela oferece "Remover" sem olhar o passo (`painel-documentos.tsx`, `pagamentos/page.tsx:149`).
Não é bloqueio: só `rh` remove, com motivo obrigatório e histórico "Arquivo removido" (testado).
Correção: ~10 linhas, migration 016, no molde do gatilho do termo (`012:578`). Falta decidir como trocar arquivo enviado errado depois de o passo estar feito.

### A8. CONFIRMADO, BACKLOG
Rodado: 13.7 pendente, rascunho salvo, 13.7 `feita` com `chave_em_uso=false`. Na ordem inversa (rascunho, depois abrir o mês) fica `pendente`: as duas funções discordam.
Não é bloqueio: a tabela da mesma tela mostra "Ainda não enviado" ou "Não confirmado", e `criarPagamentos` envia logo depois de gravar, então o rascunho solto só vem de falha no meio.
Correção: ~15 linhas, migration 016, movendo a marca para quando a chave entra em uso.

### A9. CONFIRMADO, BACKLOG
Rodado no banco: aviso de A `enviado`, de B `falhou`; marcar enviado recusa; texto editado passa; reserva de A recusa, de B volta; marcar enviado passa com o texto novo.
Por leitura (depende de SMTP): `enviarComunicado` monta o e-mail do texto atual, e o botão Editar segue visível sem `enviado_em` (`registro.tsx:120`).
Não é bloqueio: a edição é ato de quem tem papel `rh`, e nada de cliente ou dinheiro muda.
Correção: ~8 linhas na action com `situacaoDosAvisos`, sem migration; trava firme no banco com migration.

### A10. CONFIRMADO, BACKLOG
Rodado como diretoria: cancelado de R$ 500, recusado de R$ 400 e rascunho de R$ 300 dão `total_centavos` 120000, com `com_financeiro` 0 e `lancados` 0.
Atenuante: a mesma lista mostra a situação, e `resumir` em `rotulos.ts` soma igual, de propósito, mas separando o que está com o RH. O número não vai ao Financeiro.
Correção: ~3 linhas em função do 011, migration 016. Sem migration, só trocar o rótulo da coluna.
