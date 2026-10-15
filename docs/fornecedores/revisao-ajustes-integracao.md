# Revisão independente — PR #15 (ajustes de integração das melhorias)

- **Repositório:** `manfac-facilities/fornecedores`, `feat/melhorias-ajustes` → `feat/melhorias`
- **SHA revisado:** `904dc59e51e2f9961a23c894519462c45c38f53a` (inclui o commit final do "!" no passo de quem devolveu)
- **Clone:** novo, em `D:\fornecedores-work\revisao-ajustes`. Banco de produção **não** acessado.
- **Base conferida:** `origin/feat/melhorias` tem o mesmo conteúdo de `b80618f` (último merge de frente). Diff revisado:
  `b80618f..904dc59`, com 15 commits e cerca de 40 arquivos.
- **Régua:** é BLOQUEANTE só dano de dado ou falha de acesso que alguém consiga alcançar.

## Veredito: **APROVAR**

Não achei bloqueante. Ficaram 4 observações não bloqueantes (no fim deste laudo).

## Testes rodados (só arquivos específicos)

- 12 arquivos, **124/124 passando**: `regras/copia-fixa`, `aprovacoes/editor`, `configuracoes/em-uso`,
  `configuracoes/modal-desativar`, `avisos/avisar`, `modelo/campos`, `contratos/lista`, `eventos/linha-do-tempo`,
  `ficha/dados`, `regras/limite-parcelas`, `modelo/pagina`, `modelo/actions`.
- `tests/sql/rollback.test.ts` (PGlite): **14/14 passando**, inclusive "só 009", "009+010" e a trava nos dois casos.
- `tsc --noEmit`: limpo.

## Pontos pedidos

### 1. I-1: nenhum prazo, parcela, nome ou texto de contrato aprovado sai da cópia fixa — OK
- Varredura própria: `CONDICOES` aparece em `app/`, `lib/` e `components/` só na definição e no comentário de
  `lib/regras/condicoes.ts`. Não sobrou nenhum padrão `= CONDICOES` em parâmetro: `condicaoPorCodigo`, `condicaoPermitida`,
  `diasDaCondicao`, `faltasParaEnviar` e `aplicarAditivoCondicao` passaram a exigir o catálogo. O tsc confirma que
  todos os chamadores passam o catálogo.
- Ficha (`contratos/[numero]/page.tsx`): nome, prazo e "consolidado" saem de `f.condicao`, a versão pinada. Uma
  versão ausente lança erro em `_ficha/dados.ts`, então a ficha não cai no catálogo.
- Lista, aprovações, medições, Financeiro e documento: todos usam `versoesDe` + `condicaoDoContrato`, a versão
  pinada, que lança erro se a versão estiver ausente.
- E-mails (`lib/avisos/*`): nenhum prazo nem parcela fixa no código. Nos e-mails 1 e 2 as parcelas saem da versão
  pinada. Em `aprovado_alterado`, antes e depois saem de `frn_eventos.dados`. Busquei textos fixos ("D+", "30%",
  códigos de condição) e não achei nenhum. Ressalva de nome: ver observação N1.

### 2. Corte do configurador em "Em uso" — OK, no servidor e falhando fechado
- `configuracoes/condicoes/page.tsx:91-95`: `veNumeros = papeis.financeiro === true || papeis.admin === true`. Para
  quem não é José nem admin, o servidor monta `{numero: null, status: rascunho|enviado}`, e o número nem chega às
  props.
- Falha fechada: se `lerPapeis` der erro, volta `SEM_PAPEL` e a pessoa cai em SemAcesso. Se só `frn_sou_admin`
  falhar, `admin` fica `false` e a pessoa vê só a contagem.
- Reduzir o status a "rascunho ou enviado" mantém certa a separação do modal de desativar. Um devolvido tem
  `status = rascunho`: o check da 003 só aceita rascunho, aguardando, aprovado, encerrado e cancelado.
- Nenhuma outra rota de Configurações devolve números. A tela do modelo lista os "já gerados" pela RLS da própria
  pessoa.

### 3. Editor do José com versão pinada diferente da atual — OK, não grava versão errada
- "Aprovar condições" sem alteração não mexe na condição, e a pinada se mantém (`aprovacaoBloqueada` só trava se
  houver alteração inválida).
- Com alteração, quem decide é `frn_alterar_e_aprovar_condicoes` (010:255-349). A função faz quatro coisas:
  - pina **a versão atual**, com join em `frn_condicoes`;
  - valida quantidade e soma dos percentuais contra essa versão;
  - exige `status = 'aguardando'` e `condicoes_aprovadas_em is null`, com `for update`;
  - recusa "Nada foi alterado".
- Condição já aprovada não pode ser sobrescrita. Se o catálogo mudar entre a tela e o envio, o SQL recusa com
  mensagem clara.
- `trocarCondicao` usa os percentuais da versão atual quando a quantidade de parcelas é diferente. Isso evita
  mandar ao banco percentuais da pinada que ele recusaria.

### 4. Rollback com aplicação parcial — OK; trava M1 preservada
- `009-012-ROLLBACK.sql:35-52`: a contagem de modelos só roda se `frn_modelos_contrato` existir (`to_regclass` +
  `execute`). As três condições da trava continuam: versão > 1, `parcelas_ajustadas` e modelo > 1.
- O resto do script só usa `drop ... if exists` para objetos da 010–012. A verificação "nada apagado" exige as 5
  colunas da 009 e trata tabela e coluna da 011 como par.
- Os testes cobrem quatro casos, todos passando:
  - só 009, revertendo, com verificação 7/7 OK e o app velho funcionando;
  - 009+010, idem;
  - trava com versão > 1 só com a 009;
  - trava com percentuais ajustados em 009+010.

### 5. "Teto" do global com material separado; CT-0001 — OK
- `lib/modelo/campos.ts:99-106`: o ramo do material passa a terminar com ", valor global (teto), consumido por
  serviço executado" quando o contrato é global.
- CT-0001 (global, sem material): o texto é `${mo}${teto}`, idêntico ao anterior. Os testes do "CT-0001 real" em
  `tests/modelo/campos.test.ts` passam.
- Redação: ver observação N2.

### 6. E-mails 1 e 2 sem regressão — OK
- `lib/avisos/avisar.ts:60-80` (`condicaoDoAviso`): `versoesDe` e `condicaoDoContrato` ficam dentro de `try`.
  Versão nula, versão ausente ou erro de banco caem no nome do catálogo e o e-mail sai do mesmo jeito.
  `nomesDeCondicao` já engolia o erro. Coberto em `tests/avisos/avisar.test.ts`.

### 7. Itens marcados como feitos — conferidos
| Item | Conferido |
|---|---|
| I-1 ficha + cast/fallback `SPOT_MENSAL_CONSOLIDADO` | sim (`page.tsx`) |
| Catálogo obrigatório / varredura / padrão fora | sim (grep + tsc) |
| Chip Encerrado sem cancelado | sim. A spec diz "igual ao status" (spec:169), e o cancelado agora fica só em Todos |
| Teste do atraso pela versão pinada | sim (`tests/contratos/lista.test.ts`) |
| Pulso do "agora" | sim (`ui.css`, com `prefers-reduced-motion`; `linha-do-tempo.tsx` põe a classe `agora`) |
| `_sem-acesso` no modelo | sim |
| "Em uso" só contagem | sim (item 2) |
| Erro de desativar dentro do modal | sim (`_tabela.tsx`, `erro` dentro do `<dialog>`, limpo ao abrir e ao cancelar) |
| Banner sobre rascunhos | sim (`_form.tsx`) |
| Editor do José | sim (item 3) |
| `PARCELAS_MAX` + comentário | sim. Os três lugares usam a constante, e o teste confere contra a 009 |
| Teto do global | sim (item 5) |
| Robustez do modelo (2 e 4) | sim. A prévia cai no exemplo e a versão inválida não vira NaN |
| Rollback parcial | sim (item 4) |
| E-mails com parcelas | sim (item 6) |
| **"!" no passo de quem devolveu** (`904dc59`) | sim. `parteDaDevolucao` lê a parte do `contrato_devolvido` mais recente, gravada por `frn_devolver_contrato` (005:536 e 010:247). Sem parte, nenhum "!" aparece. `frn_eventos.dados` é lido com a mesma RLS das linhas que a ficha já mostra, e o motivo já aparece na tela. Não há vazamento novo. |

## Não bloqueantes

- **N1. Nome da condição nos e-mails pelo catálogo atual.** Os e-mails de aditivo (`avisar.ts:160-176`), o
  antes/depois de `aprovado_alterado` e o fallback de `condicaoDoAviso` usam `nomesDeCondicao`, o catálogo atual.
  Não é a cópia fixa e não envolve prazo nem parcela, mas se a condição for renomeada nas Configurações o e-mail de
  um contrato aprovado mostra o nome novo. Sugestão: DIVIDAS.
- **N2. Redação do teto com material.** Antes, o "teto" qualificava só a mão de obra ("Valor global (teto)…: R$ MO.
  Material, separado…"). Agora a frase vem depois do total MO+MAT e pode ser lida como teto do total, material
  incluído. Não afeta o CT-0001. Só muda se o João quiser outra redação.
- **N3. UX do editor quando a versão atual tem outra quantidade de parcelas.** Ao clicar "Alterar condições", o
  editor já abre como "alterado" (percentuais da versão atual), e o botão vira "Aprovar com a condição alterada".
  Para aprovar sem mudar nada, é preciso clicar "Desfazer". O diálogo mostra "(versão N)" antes e depois, então
  nada passa despercebido.
- **N4.** Quem tem `configurador` e também é aprovador vê números pela RLS dos contratos nas outras telas. A
  restrição de "Em uso" vale só para quem não é José nem admin, o que segue a §1.7.
