# Revisão independente das correções da F4 e da F5 do RH (07/11)

Alvos:
- **F4, Patrimônio:** `rh-f4`, `git diff 3c8df99..d41049f`, em `D:\rh-work\f4`.
- **F5, Recrutamento e Comunicação:** `rh-f5`, `git diff 2f7937a..c63294c`, em `D:\rh-work\f5`.

Revisor que não escreveu o código. Não alterei código, não fiz commit e não toquei em banco real. As
revisões de origem são `2026-11-07-revisao-f4.md` e `2026-11-07-revisao-f5.md`.

## Veredito

**Nenhum BLOQUEIO, nas duas frentes.** Os consertos fazem o que prometem, e a auditoria segue igual
para tudo o que não é candidato (medido linha a linha contra `to_jsonb`). Nenhuma operação deixou de
ser auditada, e nenhuma outra frente redefine os mesmos gatilhos ou funções. As corridas novas
(termo × remoção, cancelamento da admissão × aprovação, cancelamento da vaga, cancelamento repetido)
terminam em estado coerente em Postgres real. 012, 013 e 014 aplicam limpas do zero, em ordem, sobre
001 a 007, com todas as verificações finais `OK`.

Ficam 6 itens de BACKLOG, todos menores.

## O que rodou

| Verificação | Resultado |
|---|---|
| F4: `vitest run tests/patrimonio tests/hub-install/012-patrimonio.test.ts tests/hub-install-safety.test.ts --testTimeout=60000 --maxWorkers=2` | 8 arquivos, **361 de 361** |
| F5: `vitest run tests/recrutamento tests/comunicacao tests/hub-install/013* 014* tests/hub-install-safety.test.ts`, com as mesmas opções | 7 arquivos, **358 de 358** |
| Postgres real (`embedded-postgres` 18, descartável em `D:\rh-work\pg`): stub, 001 a 007 da F5 (iguais por `md5` em f2, f2c, f4, f5 e f6b), depois `f4/012`, `f5/013` e `f5/014` num banco só | 012: 14 verificações OK; 013: 15 OK; 014: 12 OK |
| Corridas com duas conexões (A segura a transação 0,7 s) e bordas | Tabelas abaixo |
| Leitura | O diff inteiro das duas frentes; o 005 (`rh_arquivo_registrar`, `rh_arquivo_marcar_removido`, `rh_aviso_reservar`, `rh_aviso_concluir`, gatilhos de auditoria); o 006 (`rh_movimentacao_travar`, `rh_cancelar_movimentacao`); `lib/avisos/enviar.ts`; `lib/comunicacao/{actions,regras,repositorio}.ts`; as migrations de f2, f2c, f6b, f6 e f3fix, só leitura |

Não rodei `npm ci`, build, biome nem a vitrine. Não criei testes em `tests/rev/`: as provas foram feitas
por script fora das branches (`D:\rh-work\pg\rev-f4f5fix.mjs` e `rev-b8.mjs`, só dados fictícios).

## A) F4, Patrimônio

### BK1, termo assinado sem arquivo: corrigido

`012_rh_patrimonio.sql:537-540` trocou o `exists` por `perform ... for share`. O gatilho
`rh_pat_termo_arquivo_guarda` (`:557-579`, `before update of removido_em on rh_arquivos`) recusa tirar o
arquivo de um termo `assinado`.

| Cenário (Postgres real) | Resultado |
|---|---|
| R7a: assinar primeiro, remover ao mesmo tempo | A remoção **espera** e depois é recusada: "o termo já está assinado...". Termo `assinado`, 1 arquivo vivo |
| R7b: remover primeiro, assinar ao mesmo tempo | A assinatura **espera** e recusa "anexe o termo assinado...". Termo `aguardando`, 0 arquivos |
| R7c: termo com dois arquivos, remover um × assinar | A assinatura espera e assina com o outro. `assinado`, 1 vivo |
| `update rh_arquivos set removido_em` direto pela chave de serviço, fora da função | Recusado pelo gatilho |

Também conferi:
- O gatilho é `security invoker` com `row_security = off`. Funciona tanto chamado de dentro das funções
  `security definer` quanto pela chave de serviço direta.
- Os outros gatilhos e funções que mexem em `removido_em` não esbarram nele: `rh_apagar_curriculos_vencidos`
  só toca `registro_tipo = 'candidato'`, e as frentes f2 e f6 não removem arquivo em lote.
- Não há ciclo de trava. A assinatura trava o termo e depois o arquivo. A remoção trava o arquivo e
  depois só **lê** o termo.

### BK2, classe do arquivo: corrigido

`and a.classe = 'geral'` em `:539`. Um arquivo `saude` anexado direto ao termo não vale como assinado:
foi recusado no teste em banco real.

### BK4, texto da lista: corrigido

`components/patrimonio/lista.tsx:231` agora diz "Nada em aberto com vínculo encerrado". Há um teste
novo que barra "saiu".

O que a revisão de origem deixou para depois (BK3, BK5, BK6 e F1) foi para o `docs/DIVIDAS.md` da
branch, com texto fiel.

## B) F5, Recrutamento e Comunicação

### 1. Os gatilhos de auditoria substituídos (`013:166-213`)

**Para o que não é candidato, a auditoria grava exatamente o mesmo.** Comparei o corpo da função com
`rh_auditar` (002:101-128): mesmos campos, mesmo `por`, mesmo `registro` e mesmo `motivo`, e
`return null`. A única diferença é o bloco `if/elsif` que tira chaves. Medido em banco real:

| Linha | `antes`/`depois` comparados com `to_jsonb(linha)` |
|---|---|
| `rh_arquivos` `geral` (termo), INSERT e UPDATE (remoção) | idênticos; `por` = autor |
| `rh_etapas` de `pessoa`: INSERT, UPDATE e DELETE | 3 linhas de auditoria, todas idênticas |
| `rh_etapas` de `movimentacao` | `dados` e `motivo` presentes |
| `rh_arquivos` `curriculo` | idêntico, menos `nome_original`; nenhuma linha da auditoria com o nome do arquivo |

- **Nenhuma operação deixa de ser auditada.** `create or replace trigger` mantém o nome, a tabela e os
  eventos `after insert or update or delete ... for each row`. A verificação final do 013 confere as duas
  ligações.
- **NULL não abre nada.** No INSERT e no DELETE, um dos lados é NULL, e `'curriculo' in (NULL, x)` dá
  NULL quando `x` não é currículo. O `if` trata isso como falso e a linha é gravada **inteira**. Quando
  `x` é currículo, dá verdadeiro e a chave sai. NULL nunca faz deixar de gravar, só pode fazer deixar de
  tirar, e esse caso não ocorre: a CHECK `rh_arquivos_curriculo_so_de_candidato` impede trocar a classe.
- **Outras frentes:** nenhuma redefine `rh_arquivos_auditar`, `rh_etapas_auditar`, `rh_auditar()` ou a
  função nova. Busca nos `0*.sql` de f2, f2c, f6b, f6 e f3fix. O 005 é idêntico em todas (`md5`). O único
  gatilho a mais em `rh_etapas` é `rh_etapa_previa_apos_esocial` (011, f3fix e f6), `before update`,
  restrito a `competencia`/`6.9`, que não interage. O 012 põe um gatilho `before` em `rh_arquivos` com
  outro nome, e os dois convivem (aplicados juntos).

### 2. `rh_apagar_curriculos_vencidos` (`013:638-711`)

**O que apaga:**
- do candidato vencido: `cpf`, `email` e `motivo`. O motivo vira o marcador "apagado pelo prazo de
  guarda" em `nao_seguiu`, porque a CHECK exige um motivo;
- de `rh_etapas`: a chave `texto` dos passos `1.9` e `1.12` desses candidatos, e só deles
  (`registro_tipo = 'candidato' and registro_id = any (v_ids)`);
- de `rh_arquivos`: o `nome_original` dos arquivos `candidato` marcados como removidos.

**O que preserva:**
- o nome do candidato;
- o restante de `dados` dos passos;
- as vagas;
- `rh_movimentacoes` e `rh_colaboradores`. Nenhum `update` toca essas tabelas, e a admissão aberta pela
  aprovação ficou com CPF no teste.

Medido:
- um candidato de vaga **aberta** com o mesmo CPF de um vencido continua com o CPF;
- uma vaga reaberta pelo cancelamento da admissão volta a `encerrada_em = null` e sai do filtro.

**Candidato contratado:** o currículo e o CPF do *candidato* saem em 12 meses (B4 da origem, já em
`DIVIDAS.md`). O cadastro da pessoa e a movimentação ficam com o CPF e não são tocados. Não alcança dado
de quem não deveria.

### 3. Admissão cancelada reabre a vaga (`013:590-630`)

O gatilho é `after update of situacao on rh_movimentacoes`, só quando a admissão passa a `cancelada` e
tem `origem_candidato_id`.

Ele procura o candidato por `movimentacao_id = new.id and decisao = 'aprovado'` e trava essa linha. Só
reabre a vaga se ela estiver `preenchida`. Uma admissão `concluida` não se cancela: o 006 recusa
(`:1211` e o gatilho `rh_movimentacao_travar`).

| Corrida (Postgres real) | Resultado |
|---|---|
| C1: cancelar a admissão de A, aprovar B na mesma vaga | B espera; depois aprova. A sem decisão, B aprovado, vaga `preenchida`, 1 admissão aberta |
| C2: aprovar B primeiro, cancelar a de A | B recusa "vaga já não está aberta"; o cancelamento reabre. Vaga aberta, ninguém aprovado, 0 admissões |
| C3: cancelar a admissão × cancelar a vaga | O cancelamento da vaga espera e cancela a vaga já reaberta. Estado coerente |
| C4: A cancelado, B aprovado depois, tentar cancelar de novo a admissão de A | Nada muda; a vaga de B segue `preenchida` |
| C5: cancelar a mesma admissão duas vezes ao mesmo tempo | Uma reabertura só, um histórico só |
| C6: cancelar a admissão de A × aprovar A de novo | A aprovação espera e reaprova A com uma admissão nova. Uma aberta |

**Não há caminho que reabra uma vaga preenchida por outra pessoa.** O gatilho acha o candidato pela
admissão que está sendo cancelada, não por `origem_candidato_id`. Uma admissão aberta à mão com origem
forjada não acha ninguém. Para A seguir aprovado numa vaga já preenchida por B, a vaga teria de ter
reaberto sem limpar A, e as duas coisas acontecem na mesma transação. Não há ordem de trava invertida:
o cancelamento trava a movimentação, depois o candidato e depois a vaga; a aprovação trava o candidato,
depois a vaga e por último insere uma movimentação nova.

### 4. B8 (`014:247-318`, `lib/comunicacao`)

`rh_comunicado_destravar_avisos` e `rh_comunicado_situacao_avisos` são `security definer`, com
`search_path` e `row_security = off`. Têm `revoke` de `public`, `anon` e `authenticated`, e grant só a
`service_role`. Ambas começam por `rh_autor_rh(p_autor)`.

`rh_comunicado_marcar_enviado('email')` (`:251-259`) trava o comunicado e recusa quando existe aviso de
e-mail que não está `enviado`. O caminho manual (`'manual'`) não passa por essa trava e continua sendo a
saída.

Em `lib/comunicacao/actions.ts:158-205`:
- a ação solta as reservas presas antes do envio, e a falha disso para tudo (teste do autor);
- a chave guardada para cada resultado é a mesma enviada (`chaveDoAviso(id, lote[i].id)`, a mesma ordem
  de `Promise.all`);
- `ja_reservado` só conta como entrega se o banco disser `enviado` (`regras.ts:55-61`);
- `envioCompleto` exige `semConfirmacao === 0`.

O banco é a segunda barreira: mesmo que a conta da app errasse, o comunicado não fecha por e-mail com
uma reserva presa.

Medido em banco real (`rev-b8.mjs`):

| Cenário | Resultado |
|---|---|
| `marcar_enviado('email')` com um aviso `enviado` e outro `reservado` | Recusa "há destinatário sem confirmação de envio" |
| `destravar` com reserva de agora | 0, nada muda (envio em andamento protegido) |
| `destravar` com reserva de 20 min | 1, vira `falhou` com `SEM_CONFIRMACAO` (passa na CHECK do código de erro) |
| `situacao_avisos` | `{chave: situacao}`, só chave e situação, sem e-mail |
| Reservar de novo a chave destravada | `true`: o reenvio alcança a pessoa |
| Autor `null`, `''` ou `diretoria`, nas duas funções | Recusa `RH_GUARD` (falha fechado) |
| Logado (`authenticated`) chamando as duas | `permission denied` |

### 5. Aplicação do zero

012, 013 e 014 aplicam em ordem sobre 001 a 007 num banco limpo, com todas as verificações finais `OK`.
A F5 sozinha (001 a 007, 013, 014) também aplica: é o que os testes `tests/hub-install/013*` e `014*`
fazem no PGlite.

## BLOQUEIO

Nenhum.

## BACKLOG

**K1. Arquivo extra de um termo assinado não se tira mais.**
- Onde: `012_rh_patrimonio.sql:565-570`.
- Cenário: o RH anexou o PDF errado e o certo, e assinou. Os dois ficam presos, porque o gatilho recusa
  remover qualquer arquivo do termo. Falha fechado, sem dano.
- Correção, se incomodar: recusar só quando for o último arquivo vivo de classe `geral`.

**K2. `delete` direto em `rh_arquivos` passa pelo gatilho.**
- Onde: `:577-579` cobre só `update of removido_em`.
- Cenário: com a chave de serviço, um `delete` apaga o arquivo de um termo assinado (medido como
  `postgres`).
- Hoje nenhum código do RH apaga `rh_arquivos`, e quem tem a chave de serviço já pode mudar o próprio
  termo. Registro só por completude.

**K3. O passo 1.13 ("Registrar a decisão") continua feito depois que a admissão é cancelada.** Já está
em `DIVIDAS.md` pela própria frente. Confirmei que não trava nada (C6 reaprova).

**K4. A auditoria das etapas do candidato tira `dados` inteiro, não só `texto`.**
- Onde: `013:188-190`.
- O efeito: datas e confirmações dos passos `1.4` a `1.12` deixam de ser auditadas campo a campo. A linha
  de auditoria continua existindo, com `situacao`, `feita_em` e `feita_por`.
- É uma escolha a mais do que a remoção apaga (que tira só `texto` de `1.9` e `1.12`). Correção, se
  quiserem o detalhe: tirar só `dados -> 'texto'`.

**K5. O `motivo` dos passos do candidato (o motivo de "não se aplica") não é apagado pelo prazo.**
- Onde: `013:682-685`.
- A auditoria já não o guarda, mas a linha em `rh_etapas` mantém o texto livre. Só `rh` lê.
- Correção: `motivo = null` no mesmo `update`, onde a CHECK permitir, ou um marcador.

**K6. A trava de `marcar_enviado('email')` conta avisos que a lista atual não alcança.** Já está em
`DIVIDAS.md` pela própria frente.
- Cenário: alguém com aviso `falhou` encerrou o vínculo e saiu da lista. A app calcula "completo" e
  chama `marcar_enviado`, o banco recusa, e a tela mostra erro depois de os e-mails terem saído.
- A saída é "Registrar aviso". Falha fechado.

## O que não verifiquei

- Postgres de produção. Rodei o 18 do `embedded-postgres`; a semântica de `for share`, `for update` e
  snapshot por instrução é a mesma.
- O caminho completo de `enviarComunicado` contra o banco real com SMTP. Conferi pelos testes do autor
  (com dublê) e pela leitura.
- O apagamento com admissão **concluída**: meu script não conseguiu concluir a admissão (carimbo velho).
  A conclusão "colaborador e movimentação intocados" vem da leitura dos `update` da função, mais a
  admissão aberta medida.
- A auditoria de etapa de candidato em banco real (o meu cenário não criou etapas). Ela está coberta pelo
  teste do autor "apagar leva também o nome do arquivo...", que passou.
- Build, biome, vitrine, larguras e tela logada.

## Limpeza

- Não criei nada em `tests/rev/` de nenhuma branch.
- Os scripts `D:\rh-work\pg\rev-f4f5fix.mjs` e `rev-b8.mjs` foram removidos ao fim, e as pastas de dados
  descartáveis foram apagadas.
- `D:\rh-work\f4` e `D:\rh-work\f5` não foram alterados. O `CLAUDE.md` modificado nas duas é o conhecido,
  e há diferenças só de fim de linha em quatro arquivos `lib/` de f5, vindas de antes.
