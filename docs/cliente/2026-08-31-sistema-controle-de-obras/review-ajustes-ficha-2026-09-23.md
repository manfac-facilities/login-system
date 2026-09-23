# Revisão independente — ajustes da ficha da obra (23/09/2026)

**Revisor:** subagente independente (não escreveu o código). **Alvo:** branch `feat/ajustes-ficha`,
11 commits a partir de `4d3dc3d` (worktree `.claude/worktrees/agent-a1ac9807d801714b1`).
**Referências:** `spec-ajustes-ficha-2026-09-23.md`, `plano-ajustes-ficha-2026-09-23.md`,
`mockup-ajustes-ficha-2026-09-22.html`, AGENTS.md, `.claude/rules/obras.md`.
**Régua:** bloqueia só dano de dado alcançável, falha de autorização/validação no servidor, ou texto/fluxo
divergente que o cliente veria.

## Veredito: APROVAR COM CORREÇÕES

Uma correção de texto de tela (uma linha). Nenhum dano de dado, nenhuma falha de autorização, nenhuma
quebra de obra existente encontrada.

Verificação executada no worktree:
- `npx jest` (suíte inteira) 2x: **1142 passed, 1 todo**, 0 falhas.
- `npx jest app/obras` 3x: **716 passed, 1 todo**, 0 falhas.
- `npx eslint` nos 8 arquivos de produção alterados: limpo. `npx tsc --noEmit`: nenhum erro em `app/obras`.
- Dois cenários extras rodados num teste temporário (copiado de `_actions.test.ts`, apagado depois;
  `git status` limpo no fim) — resultados citados no backlog.

---

## BLOQUEANTES

### 1. Texto do seletor diz "recomeça hoje" quando a data informada é outra (texto de tela)

- **Onde:** `app/obras/obra/[id]/_etapa.tsx:137`.
- **Cenário:** obra em Fechar OS, a pessoa escolhe "Pendente faturamento" e informa 20/09 como data de
  fechamento. A tela mostra ao mesmo tempo a dica do campo *"É essa data que inicia os dias esperando o
  faturamento"* e, logo abaixo, *"…e o contador de dias parada nesta etapa recomeça hoje."*. O servidor
  grava `desde_etapa = 20/09` (`_actions.ts:394`), então a obra entra em Pendente faturamento já com
  3 dias. A segunda frase está errada, e as duas se contradizem na mesma tela.
- **Atenuante:** o mockup aprovado tem a mesma frase (`mockup-ajustes-ficha-2026-09-22.html:454`). O
  código segue o mockup à letra. Mas a frase contradiz o comportamento que a spec (A4) pede e que o
  mockup descreve na dica. Por isso é bloqueante só de texto, como o coordenador definiu.
- **Correção sugerida (1 linha):** quando `comData`, trocar o final da frase por
  `e o contador de dias parada nesta etapa começa na data de fechamento da OS.` (com a data escolhida,
  ex. `` `…começa em ${br(data)}.` ``). Sem data, a frase continua como está.
- **Como foi confirmado:** leitura de `_etapa.tsx:137` (condição só `mudou`, sem olhar `comData`) e do
  teste `_actions.test.ts` "Fechar OS → Pendente faturamento grava a data informada… e em desde_etapa"
  (passa: `desde_etapa: diasAtras(2)`).

---

## Pontos verificados sem achado bloqueante

1. **`mudarEtapaAction` / `corrigirDataFechamentoAction`:**
   - Sessão e acesso passam por `abrirSessao()`, igual às outras actions. Há testes "sem sessão" e "sem acesso".
   - A validação no servidor usa a mesma `validarDataFechamentoOS` da tela.
   - Data futura e data anterior à maior entre relatório e aprovação são recusadas antes de qualquer
     escrita. Os testes confirmam que o `update` e a RPC não são chamados.
   - `hoje` vem de `hojeISO()` no servidor. A tela recebe `hoje` por prop.
   - O marco só é gravado via `gravarComHistorico`/RPC, com linha de → para.
   - O `update` direto de `mudarEtapaAction` só leva `etapa`/`desde_etapa`/`atualizacao`, como antes.
   - A guarda "Fechar OS concluído" (`marco_fechou_os` não nulo e etapa depois de `fecharOS`) está no
     servidor. "Aplicável" olha a obra lida do banco. Por isso a data não sobrescreve um marco já
     gravado: ela é recusada, e o teste cobre isso.
2. **`desde_etapa` com a data informada:**
   - A regra de crítica/atenção (`ancoraDias`/`critico`, `tipos.ts`) usa aprovação, liberação e
     entrada. **Não usa `desde_etapa`**, então a data retroativa não torna a obra crítica.
   - O que muda é `paradaEtapa`, que alimenta "encalhada" (`tipos.ts:607`, >= 15 dias), o Kanban, a
     tabela e a "esteira mais velha". Uma OS fechada há 15+ dias entra em Pendente faturamento já
     encalhada. É exatamente o que A4 pede ("é essa data que inicia os dias esperando o faturamento").
   - No "corrigir data", `desde_etapa` acompanha a correção só se ainda for igual ao marco antigo e a
     obra estiver em `pendFat`. A correção vai na mesma chamada atômica.
3. **Renomeação de `aprovarOS`:**
   - Só o `nome` mudou (`tipos.ts:165`). A chave e `planilha` ficaram iguais.
   - `git grep -i "pendente fechamento"` em `app/`/`lib/` só encontra o teste que garante a ausência do
     nome antigo.
   - O import usa `STATUS_MANFAC_PARA_ETAPA` com chaves de planilha (`importacao.ts:286-293`), não o nome.
   - O histórico formata a etapa com `nomeEtapa()` na gravação. Linhas antigas continuam dizendo o nome
     antigo, o que é intencional (spec §4.2).
4. **Equipe em texto livre:**
   - Triagem (`liberarObraAction`, `_actions.ts:531`) e Cronograma (`_actions.ts:801`) gravam com
     `nulo()`, que apara o texto.
   - As sugestões vêm da **mesma consulta que já existia** (`page.tsx:122`, `select('equipe, analista_cliente')`
     em `obras_obra`, sob RLS). Antes ela alimentava o `<select>`; agora alimenta o `<datalist>`.
     **Nenhuma exposição nova.**

---

## BACKLOG (não bloqueia)

- **B-a. Tela aceita, servidor recusa, quando a obra está em Fechar OS sem `marco_relatorio`.**
  - A tela valida contra `obra.marco_relatorio` (nulo). O servidor valida contra `depois.marco_relatorio`,
    que o cálculo carimba com **hoje** (`_actions.ts:382`).
  - Resultado confirmado em teste temporário: data de 2 dias atrás devolve
    `"A data não pode ser anterior ao relatório de entrega (23/09/2026)."`. A pessoa não consegue
    retroagir e a mensagem confunde.
  - **Sem dano:** nada é gravado.
  - Só acontece em obra que chegou a Fechar OS sem passar pela troca manual depois de 21/09 (import
    antigo, ou o caminho B5 de `salvarAutorizacaoAction`).
  - O backfill de 21/09 achou 0 obras nessa situação. **Não verifiquei produção hoje.**
  - Se aparecer: validar contra `obra.marco_relatorio` e carimbar o relatório com a menor entre hoje e a
    data informada, o que exige decisão.
- **B-b. `dataFechamentoOS` é validado aparado, mas gravado sem aparar.** Confirmado em teste:
  `' 2026-09-21'` passa e vai assim para `desde_etapa`/marco. Não é alcançável pela tela (o
  `input type="date"` não gera espaço), só por chamada forjada. Correção: aparar uma vez no início da action.
- **B-c. Marcos carimbados como "data da marcação"** (decisão 1 de 21/09, salto de etapa) viram
  referência mínima da data de fechamento. Um `marco_relatorio` artificial de "hoje" impede informar a
  data real anterior, e não há "corrigir" para o relatório. É consequência da regra, não do código.
- **B-d.** "Tentar de novo" também aparece para recusa de validação do servidor, onde repetir não
  resolve. É inofensivo.

---

## Teste instável (`_blocos-editaveis.test.tsx`)

**Não reproduzido.** Rodei 3x o arquivo sozinho (6/6), 3x `app/obras` em paralelo (716/716) e 2x a
suíte completa (1142/1142), sem nenhuma falha. Não dá para atribuir com certeza.

O padrão, porém, é **anterior à branch**: o primeiro teste do arquivo (`autorizacao: editar, erro do
servidor, cancelar`, linha 11) já tinha `timeout` de 20 s antes destes commits, sinal de que o arquivo
já era lento com `userEvent`. O teste novo (linha 134) também tem 20 s. Os outros quatro, antigos,
usam o padrão de 5 s e são os candidatos mais prováveis a estourar sob carga.

Conclusão: provavelmente é pré-existente, de tempo, e não é defeito do código novo. **Não confirmado.**

---

## O que NÃO consegui verificar

- **Banco de produção** (não consultado): quantas obras estão hoje em Fechar OS sem `marco_relatorio`
  (B-a).
- **Comportamento visual do `<datalist>`** em iOS/Safari (já registrado pelo implementador em DIVIDAS).
- **A tela rodando no navegador:** a revisão foi por leitura de código, testes jest, eslint e tsc.
- **A instabilidade relatada**, que não se reproduziu (ver seção acima).
