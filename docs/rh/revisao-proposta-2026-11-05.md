# Revisão independente da proposta de fases do RH (05/11/2026)

Documento revisado: `docs/rh/2026-11-05-proposta-fases-e-decisoes.md`.
Contra: `docs/cliente/2026-11-05-rh-atividades-rh-dp.md`, `docs/cliente/2026-11-05-rh-direcao-do-joao.md` e o código nos clones
em `...\scratchpad\repos\` (`financeiro`, `rh`, `orcamento`, `fornecedores`). Somente leitura. Nada foi rodado, nem banco consultado.
Caminhos abaixo são relativos a `repos/financeiro` (F), `repos/rh` (R) e `repos/orcamento` (O).

## Resumo

A proposta acerta na maior parte dos fatos técnicos (lista na seção "Confirmado"). Dois pontos a derrubam como está escrita,
e os dois ficam justamente na recomendação 1 (folha e VR como uma solicitação consolidada). Ela serve para VR, VT, seguro
e celular. Para folha CLT e ajuda de custo não está demonstrada, e uma regra do Financeiro que a proposta não menciona
trava o caso comum.

---

## BLOQUEANTE (a proposta está errada ou incompleta de um jeito que muda a decisão)

### B1. "O formato já existe" vale para pagamento a UM favorecido; folha e ajuda de custo são N pagamentos a N pessoas

Afirmação revisada: "Nada disso exige lançamento em lote no Financeiro se cada pagamento continuar sendo uma solicitação
consolidada com rateio" (linhas 20-21) e a recomendação 1.

Prova, campo a campo, para a solicitação consolidada de folha/VR:

| Campo obrigatório | O que o código exige | Cabe na folha? |
|---|---|---|
| fornecedor | `fornecedor_documento` com 11 a 14 caracteres, `razao_social` (F `006_fin_solicitacoes.sql:45-48`). Na porta, ou é do catálogo ativo ou é `cnpj_novo`/`cpf_novo` (F `lib/solicitacoes/preparar.ts:49-129`). | Um só favorecido por solicitação. Para a folha não existe fornecedor natural (a contabilidade? um "FOLHA" fictício? o próprio CNPJ?). |
| forma de pagamento | `boleto`, `guia`, `pix_chave` ou `pix_qrcode`; não há TED nem "pagamento em lote" (F `lib/solicitacoes/formas.ts:3`). | Folha não é boleto. |
| `codigo_pagamento` | Obrigatório e validado (linha digitável, guia ou PIX copia e cola) em toda forma, exceto `pix_chave` (F `006:86-87`; `lib/solicitacoes/codigo.ts:14-33`). Só `tipo = 'regularizacao'` escapa (F `016_fin_regularizacao.sql:50-53`). | Sobra `pix_chave`. Com fornecedor do catálogo sem chave PIX no Omie, a etiqueta `completar_chave_pix` impede validar (F `preparar.ts:293-295`; `etiquetas.ts:41-46`). Com a chave de UMA pessoa, o total da folha iria para essa pessoa. |
| vencimento | Entre 365 dias atrás e 730 à frente (F `preparar.ts:167-170`). | Cabe. |
| categoria e tipo de documento | Códigos ativos no catálogo do Omie (F `preparar.ts:173-178`). | Cabe, se existirem categorias de pessoal. |

Conclusão: a solicitação consolidada é estruturalmente aceita pelo banco (valor único, várias linhas de rateio, soma
garantida), mas o Financeiro hoje modela "um favorecido, uma forma de pagar, um código". Para folha CLT e ajuda de custo ela
só fica coerente se for um lançamento contábil de um favorecido que NÃO recebe aquele dinheiro (então o pagamento real sai
por fora e existe risco de pagar duas vezes), ou se for usada como pagamento a UMA conta. A proposta não diz isso e a pergunta 1
ao cliente ("pagamento só, um por CC ou um por pessoa?") não pergunta o que decide: **quem recebe o dinheiro e por onde ele sai**.

A recomendação 1 sobrevive para os itens de boleto de fornecedor real: VR (operadora), VT (boleto da operadora, 16.4),
seguro (13.7) e celular (18.8). Lá a forma é `boleto`, o favorecido é a operadora e o rateio é a única coisa que o RH acrescenta.

Existe um precedente que a proposta não citou: a **regularização** (F `016_fin_regularizacao.sql`), pagamento que já saiu do
banco, criado a partir de linha do extrato do BTG, sem código de pagamento e com rateio. Se a folha hoje sai do banco pela
contabilidade e entra no Omie depois, esse é o encaixe natural (o RH fornece o rateio pronto, o financeiro regulariza).
Não verifiquei se é o fluxo real; a pergunta 1 precisa descobrir isso.

Correção sugerida: (a) trocar a pergunta 1 por "como o dinheiro da folha sai (banco, arquivo da contabilidade, por pessoa?) e
quem lança no Omie"; (b) dividir a recomendação 1 em duas: consolidada para os itens de boleto, e "a decidir" para folha CLT e
ajuda de custo, com as três saídas (regularização, tipo novo no Financeiro, ou o RH só exporta o rateio); (c) não escrever
"nada exige lote" antes da resposta.

### B2. Regra "obra obrigatória" do Financeiro: o rateio por pessoa cai nela e a solicitação não valida

Não aparece na proposta nem nas "bordas".

Prova: centro de custo com OBRAS ou SPOT no nome, combinado com categoria fora da lista de categorias fixas, exige ligar a
solicitação a uma obra/OS (F `044_fin_obra_vinculos.sql:98-114`, `fin_obra_exige`). A lista semeada tem só Remuneração PJ,
Prêmios, Aluguel e Manutenção de Veículos, Combustível, Multas, **Seguro de Vida, Vale Refeição**, ASOs, Comissões e
Estacionamento (F `044:80-93`). Ficam de fora, portanto: folha CLT, VT, ajuda de custo, celular. Sem obra ligada a solicitação
fica pendente e `validarAction` recusa (F `lib/solicitacoes/decisoes-actions.ts:165-171`; `lib/obra/divisao.ts:179-186`). A
porta de medição trata isso criando a solicitação como "pendente" na fila "Sem obra" (F `lib/integracoes/medicoes.ts:163-186`).

Efeito: o rateio do RH vai quase certo ter linha em CC de OBRAS/SPOT (é onde está o pessoal de campo). Resultado: a folha
consolidada fica parada na fila "Sem obra", e a saída "fácil" é o financeiro ligar a uma obra qualquer, o que joga o custo
de pessoal de todos os centros na obra errada. Isso é dinheiro com valor errado.

Correção sugerida: antes da fase 2, o José (papel financeiro/diretor) inclui as categorias de pessoal na lista de fixas pela
função `fin_obra_incluir_categoria_fixa` (F `044`, lista de funções no cabeçalho), e isso entra na ordem de deploy da decisão 7
como pré-requisito de dados. Conferir também quais categorias o RH vai usar para folha CLT, VT, ajuda de custo e celular.

---

## IMPORTANTE

### I1. O cadastro da fase 2 não tem os campos que as entregas da fase 2 prometem
A fase 2 promete "seguro, ajuda de custo e celular com rateio calculado", mas as colunas propostas são só "e-mail, subtipo MEI,
benefícios (VR/VA/VT e valor)" (linhas 49-50). Faltam: quem é segurado e o prêmio (13.1), qual celular/linha é de quem (18.8),
valor e período da ajuda de custo (16.1-16.2). Sem isso o rateio desses três não sai do cadastro, e o "sem digitação" não se cumpre.
Correção: listar as colunas/tabelas dessas três entregas na seção "O que a fase 2 precisa no banco", ou tirar os três da fase 2.

### I2. Qual é o total que manda: o calculado pelo cadastro ou o do boleto
Para VT, seguro, celular (e VR por boleto), o valor real é o do boleto da operadora. O Financeiro compara o valor digitado com o
do código e marca `valor_diverge_codigo` (F `preparar.ts:299`), e o banco exige que o rateio feche exatamente o valor da
solicitação (F `006:282-289`). Se o RH calcular o total pelo cadastro e o boleto vier diferente (tarifa, ajuste, proporcional),
ou a etiqueta dispara em todo mês, ou o RH distribui um valor que não é o que será pago. Correção: regra explícita de que o
total é o do boleto e o cadastro só fornece os pesos do rateio; diferença acima de uma tolerância bloqueia o envio.

### I3. "Anexo de boleto pela porta" não é o obstáculo; a linha digitável é
A porta realmente não aceita anexo (F `lib/integracoes/medicoes.ts:32-34`, "TODO"), e o anexo só entra pelo solicitante, em
etapa aberta, até 10 arquivos pdf/jpg/png de 10 MB (F `006:367-372`, `006:379-382`; tabela `006:115-127`). Mas para forma `boleto`
o `codigo_pagamento` (linha digitável) é obrigatório e conferido (F `schemas.ts:102-103`; `codigo.ts:25-27`). Anexar o PDF não o
substitui. Se o RH não lê a linha digitável do PDF, alguém digita todo mês, ou seja, o mesmo trabalho manual que o João quer eliminar.
Correção: incluir na fase 2 a leitura da linha digitável do boleto (ou aceitar digitação em campo único) e dizer que o anexo é
extra, não o requisito.

### I4. Idempotência: a porta devolve a primeira solicitação mesmo que os valores tenham mudado
A chave de origem "nunca cria uma segunda solicitação — a segunda chamada devolve a primeira, em qualquer etapa"
(F `023_fin_integracao_medicoes.sql`, cabeçalho; função `fin_criar_solicitacao_integrada`). O contrato atual manda reenviar com
chave nova só quando a anterior está `recusada`/`cancelada` (F `medicoes.ts:69-72`); `devolvida` só se corrige pela tela do
solicitante. Consequência: se o RH fechar a competência, enviar, e depois corrigir um salário, o reenvio com a mesma chave não
altera nada e a tela do RH pode mostrar "enviado" com o valor velho. A proposta diz "envio repetido sem duplicar" mas não trata
correção nem retorno de status. Correção: chave = competência + tipo + revisão; o RH consulta o estado (existe consulta só com a
chave, F `medicoes.ts:73-75`) e mostra devolvida/recusada/lançada; e define-se o que fazer com revisão quando o original já está `lancada`.

### I5. Dependências que a ordem das fases ignora

| Item | Precisa de | Mas está em fase | Problema |
|---|---|---|---|
| 5.2, 5.3, 6.1-6.4, 15.1 (férias, desligados, afastados) | áreas 8, 11, 7 | 2 usa o que nasce em 3, 4 e 5 | A "competência: quem conta naquele mês" não tem de onde saber quem está de férias/afastado. Hoje só existem `status` e `desligamento` (R `002:20-39`). VR de quem está de férias é dinheiro pago a mais. Correção: sinal manual mínimo "fora da competência" com motivo na fase 2. |
| 2.6, 11.5 (ASO) | área 14 | 3 usa o que nasce em 4 | Checklist de admissão/desligamento sem controle de ASO. |
| 2.7.1-2.7.4, 2.7.8-2.7.9, 2.11, 2.17, 11.3 (patrimônio, devolução) | área 18 | 3 usa o que nasce em 6 | Mesmo problema; 11.3 (descontos na rescisão) ainda depende de multas (Frotas), que a decisão 4 empurra para "depois". |
| 2.16 (comunicado de novo colaborador) | 12.2 | 3 usa o que nasce em 7 | |
| 11.4 (saldo de banco de horas) | 3.12 | 3 usa o que nasce em 5 | |
| 17.5 (escala de plantão) | 3.7, 4.4 | 3 (área 17 inteira) vs 5 | Plantão e escala são o mesmo tema. |
| 13.2, 13.3, 13.4 (incluir/excluir segurado, planilha até dia 25) | admissão/desligamento | 2 usa eventos de 3 | Na fase 2 só dá para manter a relação à mão. |

### I6. Visibilidade da solicitação no Financeiro (pergunta que a proposta deixou como não verificada)
Respondida pelo código. A policy de `fin_solicitacoes` deixa ver: o solicitante (por e-mail), admin do hub, papel
`financeiro` e papel `diretor` (F `006:182-189`); rateio, anexos e eventos seguem a mãe (F `006:191-202`). Não há outra leitura
de outro módulo (nenhum `fin_solicitacao` em `orcamento`; o Fornecedores lê só o que ele mesmo criou, via tabela de integração).

- **Uma solicitação por pessoa expõe o salário a toda a equipe financeiro, a todos os diretores e a todo administrador do hub.**
  Isso contraria a regra do RH, em que o admin do hub sem papel vê salário nulo (R `003_rh_salario.sql:5-9`). O aviso de
  e-mail do envio também leva o valor (F `lib/avisos/mensagens.ts:178`).
- **A consolidada não mostra salário individual, mas não é "sem salário":** mostra a folha total e o total por centro de custo.
  Um CC com uma só pessoa revela o salário dela. O total geral é visível ao mesmo grupo. O texto da proposta ("o Financeiro vê o
  valor por centro de custo, sem salário por pessoa") está certo só com essa ressalva.
- A afirmação de que "uma por pessoa exige lançamento em lote" (linha 65) está exagerada: 50 chamadas idempotentes à porta
  funcionam. O que realmente pesa é 0 de 50 ligados a fornecedor (R/descoberta), 50 itens na fila do financeiro para validar
  um a um, e a exposição acima.
Correção: ajustar a redação; decidir se o grupo `financeiro`/`diretor`/admin pode ver a folha total; manter a descrição da
solicitação sem nomes.

### I7. Limites do rateio na porta
O formulário limita a **20 linhas** de rateio (F `lib/solicitacoes/schemas.ts:17`, `:69-72`), a porta reaproveita o mesmo
schema (F `medicoes.ts:50-57`). Cada CC aparece uma vez e **toda linha tem de ter valor maior que zero**
(F `lib/solicitacoes/rateio.ts:48-51`, `:74-76`, `:81-82`; `006:108`). Se o RH tiver mais de 20 CCs ou algum CC com valor zero no
mês, o envio é recusado. Não verifiquei quantos CCs distintos existem no rateio de produção (a descoberta não traz a contagem).
Também: CC inativo no Omie recusa a solicitação inteira (F `preparar.ts:186`); a proposta lista a borda mas não diz a política.
Redistribuir em silêncio muda o custo por CC; correção: bloquear o fechamento da competência e mostrar o CC inativo.

### I8. Cobertura: itens sem entrega descrita
- **6.13 (contracheque a cada CLT no dia do pagamento):** nenhuma fase o descreve. Envolve arquivo por pessoa, e-mail e sigilo
  de salário. O e-mail corporativo entra na fase 2, então caberia aqui, mas não está dito.
- **6.12 (FOPAG consolidada para José e Eduardo):** é um relatório, não um pagamento; fica naturalmente na fase 2, mas não é citado.
- **6.7 a 6.10 (movimentações à contabilidade, conferir prévia, pedir correção, aprovação interna):** a fase 2 descreve só a
  importação do valor final (decisão 2). O ciclo de prévia, que é o coração da área 6, não tem fase.
- **16.3 "provisionamento da ajuda de custo":** a própria proposta diz que o Financeiro "não tem provisão" (linha 13) e mesmo
  assim põe 16 na fase 2. Nenhuma pergunta ao cliente esclarece o que "provisionar" significa. Se for lançar uma despesa futura,
  não há onde.
- **17.2 (equipes de campo) e 17.3 (chaves PIX):** estão na fase 3 junto de admissão/desligamento, sem relação com checklists.
  A decisão 6 trata 17.3 só como permissão, sem dizer onde a chave mora nem fase.
- **Fase 1 "No ar":** a descoberta classifica 7, 10 e 11 também como parciais; a tabela só cita 2, 5, 9, 17.1. Menor, mas os números
  "7 parciais" e a linha da fase 1 não casam.

### I9. Fidelidade ao dono: o que foi trocado, e o que ficou sem dizer
O João pediu (a) dividir em partes, (b) folha e VR sem digitar centro de custo, valor e rateio, puxando do cadastro, (c) pensar
integração sempre, até perguntar ao outro Claude.
- (a) Atendido.
- (b) Parcialmente trocado, e a troca está declarada só nas decisões, não na tabela de fases. **O valor da folha deixa de vir do
  cadastro** (ele falou em nome, salário, centro de custo) **e passa a vir de upload mensal da contabilidade** (decisão 2): some
  a digitação de valor e rateio, mas surge um upload com formato ainda desconhecido ("preciso de um arquivo de exemplo"). Os
  **26 PJ (52% do cadastro) ficam fora do pagamento** (decisão 3), então "folha com rateio entregue ao Financeiro" na fase 2
  cobre 24 pessoas. A **ordem foi invertida** (VR antes da folha), com o trade-off dito ("a folha, que é a maior dor, chega
  uma entrega depois"). Tudo isso aparece, mas a tabela de fases e a frase "a fase 2 é o que você pediu" (linha 35) escondem que
  o entregável é menor que o pedido. Correção: uma linha na tabela dizendo "CLT apenas; valor via arquivo".
- (c) Parcialmente. Há mapa de integrações e coluna "Conversa com". Mas ele sugeriu consultar o outro Claude e a proposta
  não propõe esse mecanismo (só cópias de leitura locais, decisão 5). A decisão 5 contraria o desejo implícito de "tudo no mesmo
  repositório" e diz por quê, o que é legítimo; falta dizer que contraria.
- Em fase 6 aparece "Almoxarifado" como sistema com o qual conversar. Pela própria descoberta ele não existe (só o papel
  `almoxarifado` e o fluxo de estoque dentro do Compras: `descoberta-integracoes-2026-11-05.md:223-227`).

### I10. Colunas aditivas no RH: seguras para o Orçamento, com duas ressalvas
Confirmado que o Orçamento lê `rh_colaboradores` e `rh_colaborador_rateios` direto, por colunas nomeadas, nunca `select *` nem
`to_jsonb` do cadastro (`orcamento/supabase/hub-install/007`, `008`, `016:255-290`, `022:30-40`). A trava de segurança dele só
varre os SQL do próprio Orçamento (O `tests/hub-install-safety.test.ts:8,88-92`), então migration do RH não a aciona. Colunas
novas não quebram nada ali. Ressalvas:
1. **Salário com vigência (item 2 da fase 2):** o Orçamento usa `salario_centavos` (O `022_orc_colaborador_salario.sql`, e
   `CLAUDE.md`: "devolve também rh_colaboradores.salario_centavos"). Se a vigência virar tabela e a coluna deixar de ser mantida,
   o Orçamento lê salário velho sem erro. A proposta diz "nenhuma coluna existente pode ser renomeada ou removida" mas não que
   ela continua sendo a fonte do valor atual. Correção: regra de que `salario_centavos` é sempre o valor vigente hoje (atualizado
   na mesma transação).
2. **Semântica, não só estrutura:** o headcount do Orçamento filtra `tipo_contratacao <> 'socio'` e `status = 'desligado'`
   sem desligamento (O `016:261-262`). Acrescentar valores a `status` ou `tipo_contratacao` (por exemplo "férias") mudaria
   a contagem sem erro. Subtipo MEI como coluna separada, como propõe a proposta, está certo; manter assim.
   Além disso, `rh_salvar_colaborador` atualiza a linha inteira (R `003:158-170`); coluna nova precisa seguir "chave ausente
   mantém o valor", como fez o salário, ou editar pela tela antiga apaga o e-mail/benefícios. E `rh_listar_colaboradores`
   precisa de `drop function` ao ganhar coluna (R `003:252`); isso é permitido na trava do RH (R `tests/hub-install-safety.test.ts:386`).

---

## MENOR

- **Conversão de percentual:** `numeric(5,2)` para centésimos inteiros é exata (multiplicar por 100); a proposta a lista como
  borda de arredondamento (linha 54-55). O arredondamento real está em dividir centavos entre CCs e pessoas. O Financeiro põe a
  sobra na última linha (F `rateio.ts:66-73`, `:91-99`). Se o RH arredonda por pessoa e soma, o total pode diferir do valor
  da folha; arredondar por pessoa e usar a soma como total, ou aplicar o rateio ao total já com a sobra na última linha, mas decidir.
- **Competência:** a proposta não define o período. O pedido fala em fechamento do ponto de 25 a 24 (3.9) e envio da
  seguradora até o dia 25 (13.4), enquanto o rateio tem vigência mensal no dia 1 (R `002:55`). Se a competência for mês-calendário,
  admissão/desligamento e hora extra caem em mês diferente do ponto.
- **Nova porta:** o porteiro do Financeiro já libera qualquer rota sob `/api/integracoes/` (F `lib/auth/porteiro.ts:21`), então
  rota nova passa. Mas a origem tem `check (origem in ('fornecedores_medicao'))` (F `023_fin_integracao_medicoes.sql:19`), a rota
  lê o segredo `FORNECEDORES_INTEGRACAO_SECRET` (F `app/api/integracoes/medicoes/route.ts:54`) e o `solicitante_email` tem de ser conta do hub
  (`route.ts:25-37`). Precisa de migration (trocar o check), segredo próprio e conta de solicitante. A proposta cita só "nova `origem`".
- **Prazos que a proposta não mencionou:** o envio vira emergencial automático (etapa `aguardando_diretor`, sem justificativa)
  quando o vencimento é anterior à primeira janela: 2 dias úteis a partir do envio (até 17h) e depois segunda, quarta ou sexta
  (F `prazos.ts:85-98`; `006:249`). VR e seguro com vencimento curto cairão no diretor.
- **Pergunta 3 ao cliente** ("valor por dia vezes dias úteis ou fixo") não pergunta o calendário de crédito do VR (15.4) nem
  como tratar admitido/desligado no meio do mês.

---

## Respostas diretas às perguntas 1 a 4

### 1. Cobertura (só os itens com problema)
2.6, 2.7.x, 2.11, 2.16, 2.17, 11.3-11.5, 13.2-13.4, 17.2-17.5, 6.7-6.10, 6.12, 6.13, 16.3, 5.2/5.3 e 15.1: ver I5 e I8.
Os demais itens numerados (1.1 a 1.14, 2.1-2.5, 2.8-2.15, 3, 4, 7, 8, 9, 10, 12, 14, 18.1-18.7) têm fase coerente com a
área e nenhuma dependência além das da tabela de I5.
Itens soltos pedidos: 2.18 (fase 3, depende da 13 na fase 2: ordem certa, falta o gatilho de admissão que só existe na 3);
13.7, 16.4 e 18.8 são solicitação normal de boleto de fornecedor real: encaixam em fase 2, mas veja I3 (linha digitável) e I2
(total do boleto); 16.3 sem contraparte (I8); 11.3 e 11.4 (I5); 17.2-17.5 (I5 e I8).

### 2. Fidelidade ao dono
Ver I9. Em resumo: entrega menor que o pedido (CLT, valor por arquivo, VR antes da folha) mas declarada nas decisões; a
tabela de fases e a frase "é o que você pediu" não refletem isso.

### 3. Afirmações técnicas, conferidas

| Afirmação | Resultado | Prova |
|---|---|---|
| Financeiro aceita um valor e várias linhas de rateio, soma garantida | **Confirmado** | Banco recusa se há zero linhas, se soma dos valores difere do valor ou se soma dos percentuais ≠ 10000: F `006:282-289`. Valor por linha > 0: F `006:108`. Aplicação recalcula e põe sobra na última linha: F `rateio.ts:37-100`. Limite de 20 linhas só na aplicação: F `schemas.ts:17`. |
| Solicitação consolidada de folha/VR viável nos campos obrigatórios | **Só para boleto de fornecedor real.** Folha e ajuda de custo: ver B1 | F `006:45-58,86-87`; `codigo.ts`; `etiquetas.ts:41-46` |
| Porta aceita só medição | **Confirmado** | Check de origem F `023:19`; corpo exige `medicao.id` e `medicao.numero` (F `medicoes.ts:39-57`); segredo fixo do Fornecedores (F `route.ts:54`) |
| Anexo não entra pela porta | **Confirmado** | F `medicoes.ts:32-34`; anexo só pelo solicitante em etapa aberta: F `006:367-372` |
| Quem enxerga uma solicitação | **Respondido** (I6) | F `006:182-202` |
| Colunas aditivas no RH não quebram Orçamento nem a trava dele | **Confirmado, com duas ressalvas** (I10) | O `016:255-290`, `022`; O `tests/hub-install-safety.test.ts` varre só `supabase/hub-install` do Orçamento |
| Etapa inicial e fluxo | `aguardando_financeiro`; `aguardando_diretor` se emergencial. Depois: o financeiro valida (bloqueia sem obra, B2), vai para `lancando` e o lançamento no Omie é assíncrono, rodado a cada 5 minutos pelo agendador | F `006:249`; `decisoes-actions.ts:162-171`; `011_fin_anexo_trava.sql` (cabeçalho). "Entregue ao Financeiro" não quer dizer lançado nem pago. |
| `possivel_duplicidade` dispara à toa para folha/VR mensal? | **Não, para o mensal normal.** | A heurística é: mesmo `codigo_pagamento` OU mesmo fornecedor+valor+vencimento, entre solicitações que não estão canceladas nem recusadas (inclui lançadas): F `repositorio.ts:103-129`, `preparar.ts:232-239`, `:296`. Mês seguinte tem vencimento e boleto diferentes. Dispara quando o RH manda duas solicitações do mesmo fornecedor com mesmo valor e mesmo vencimento (por exemplo, uma por CC com valores iguais), ou quando reenvia com chave nova enquanto a anterior está viva (aí o alerta é correto). É só etiqueta; não impede validar (impedem apenas `cadastrar_fornecedor` e `completar_chave_pix`: `etiquetas.ts:41`). Não substitui a idempotência (I4). |

### 4. Lacunas de dinheiro (valor errado ou pagamento duplicado)
1. B2: custo de pessoal ligado à obra errada para destravar a validação.
2. B1: lançar a folha consolidada e pagar as pessoas por fora (duplicidade), ou pagar o total a uma única conta.
3. I4: correção de valor depois do envio que não chega ao Financeiro (valor velho lançado).
4. I2: total do boleto diferente do total calculado no cadastro.
5. I5: VR pago a quem está de férias/afastado/desligado, por falta de sinal na fase 2.
6. I7: CC inativo ou mais de 20 CCs; cuidado para não redistribuir em silêncio.
7. Pessoas sem salário (2 de 50): a proposta cita; a regra deve bloquear o fechamento, não tratar como zero.

---

## Confirmado sem ressalva (para o João saber o que está certo)
- "O Orçamento já puxa pessoas, salário e rateio do RH" e é o único caminho automático (O `CLAUDE.md`, `007`, `022`).
- "Não tem lote, recorrência nem provisão" no Financeiro: não achei nenhuma menção a folha, VR, lote ou provisão no código do Financeiro.
- "A porta é restrita a medição" e "anexo não entra por ela".
- Contagens do RH (24 CLT, 26 PJ, 0 ligados a fornecedor, 2 sem salário) batem com `descoberta-estado-atual-2026-11-05.md`; não as reconsultei no banco.
- Ordem de deploy "Financeiro primeiro, RH depois" e migrations aplicadas pelo José: coerente com os `CLAUDE.md` dos módulos.
- Não existe porta no hub para conceder acesso de fora: o hub só altera `hub_system_access` por `app/admin/_actions.ts`
  (grep em `app/api` e `lib`). Por ser território de exceção (`hub_system_access`/`hub_user_roles`), a peça nova da fase 3 deve
  entrar com a defesa de borda mesmo sem pedido.

## Não verificado por mim
Quantos CCs distintos existem no rateio de produção; se a folha hoje entra no Omie por regularização; as categorias reais de
pessoal no Omie; build e testes de qualquer repositório.
