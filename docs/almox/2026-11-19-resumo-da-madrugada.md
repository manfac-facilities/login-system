# Almoxarifado — resumo da madrugada (18→19/11/2026)

Para o João ler de manhã. Primeiro o que você precisa fazer/decidir, depois o que foi feito.

## 1. O que só você pode fazer (em ordem)

| # | O quê | Por quê | Tempo |
|---|---|---|---|
| 1 | **Clicar em Deploy no app `almox` do EasyPanel** (`painel.manfac.com.br` → projeto `manfac` → `almox`) | Tentei de madrugada: a sessão do EasyPanel no Chrome tinha expirado e caiu no login — senha eu não digito. Tudo está no GitHub (`fase-1`, `6068324`) | 1 min + build |
| 2 | **Escolher a equipe do piloto** | Recomendo **MANFAC 3**: é a única cuja transferência (DPSP → MANFAC 3) já foi medida no Omie. A MANFAC 6 é Obras/Spot e gera um tipo de lançamento (saída) nunca testado, com só 12 itens com saldo | resposta |
| 3 | **Dizer quem aprova os pedidos** da equipe (para a MANFAC 3: aprovador do contrato DPSP, ou um gestor) | **Hoje ninguém aprova**: `alx_papeis` está vazio e ser admin do hub não dá direito de aprovar. A pessoa precisa ter login no hub; eu concedo em `/almox/papeis` | resposta |
| 4 | **Dizer quem é o almoxarife do balcão** | Você, Jose e Eduardo (admins) já conseguem separar e registrar retirada. Se for outra pessoa, ela precisa do papel e do link direto (o card do hub só aparece para admin) | resposta |
| 5 | **Nome e celular dos técnicos** da equipe do piloto | O convite sai por link/WhatsApp para cada um | lista |
| 6 | **Autorizar o SQL 025 (agendador da fila do Omie)** e criar 2 segredos no cofre do Supabase | **Sem isso a fila do Omie não roda sozinha** — nenhuma tela dispara a gravação; só o agendador. Segredos (Supabase → Project Settings → Vault): `almox_producao_cron_secret` = o mesmo valor de `ALX_CRON_SECRET` do app almox no EasyPanel; `almox_producao_omie_url` = `https://hub.manfac.com.br/almox/api/tarefas/omie` | "autorizo 025" + 2 min no painel |
| 7 | **Autorizar o SQL 026 (aprovador não vê custo)** — ver seção 3 | Só obrigatório **antes de cadastrar aprovador que seja gente do cliente**. Se o aprovador for da Manfac, pode ficar para depois | "autorizo 026" |
| 8 | **No dia em que os técnicos começarem: ligar a gravação no Omie** | Já autorizado por você ("quando o piloto começar"). É um commit + Deploy; eu faço quando você disser "começou". Só depois disso aplico o 025 (antes, toda tarefa viraria falha) | "começou" |
| 9 | **Autorizar cadastrar o feriado de 20/11** em Configurações do almox | `alx_configuracoes` está vazio: pedido aprovado hoje ganharia retirada na sexta 20/11 (feriado nacional) | "pode" |
| 10 | **Autorizar um ensaio** com 1 colaborador de teste (convite → PIN → pedido → aprovação → separação → retirada), gravação no Omie ainda desligada | **Nada desse fluxo rodou em produção até hoje** (todas as tabelas de pedido, sessão e convite estão vazias). O ensaio grava dados reais no banco, por isso pede o seu ok | "pode ensaiar" |

**Realista para hoje de manhã:** com 1 (Deploy) e 2–5 respondidos, o sistema está pronto para
cadastrar a equipe e convidar os técnicos. Para a primeira retirada gravar no Omie, precisa do 6
e do 8. Pela regra de 1 dia útil de antecedência, um pedido normal feito hoje vira retirada na
**segunda 23/11** (sexta é feriado), salvo pedido emergencial.

Comunicação: o envio de e-mail está desligado e os avisos do sistema (SQL 008) não estão
aplicados — **o aprovador não é avisado de pedido novo**. Para o piloto, combinar pelo WhatsApp que
ele olhe `/almox/pedidos`.

## 2. O que subiu para o GitHub (`manfac-facilities/almox`, `fase-1` = `6068324`)

Tudo com **revisão independente** (quem escreveu nunca revisou) e suíte inteira passando:
**126 arquivos, 2499 testes, 0 falhas; tsc limpo; lint 0 erros; build ok.**

1. **Tela de Retirada com assinatura** (`/almox/pedidos/<id>/retirada`): conferir itens → técnico
   digita PIN e assina com o dedo → confirmar; requisição imprimível com a assinatura. Botão no
   detalhe do pedido separado e link no fim da Separação. Revisão: nada bloqueia.
2. **Tela Falhas no Omie** (`/almox/falhas-omie`, no menu, só almoxarife/admin), com "tentar de
   novo" que não duplica gravação. Revisão: nada bloqueia.
3. **Bug corrigido:** o aviso "Ninguém com esse nome" não aparece mais antes de digitar.
4. **Falha grave achada e corrigida antes de ligar a gravação:** o método que a fila usava para
   saber se um lançamento já entrou no Omie (`ConsultarAjusteEstoque`) **não existe no Omie**.
   Com a gravação ligada, todo lançamento teria travado em falha. Medido (só leitura) e trocado por
   `ListarAjusteEstoque` filtrado. A primeira revisão achou um caminho de **lançamento duplicado**
   na correção; foi corrigido e uma segunda revisão confirmou que só se grava quando o Omie
   responde exatamente o "não existe" medido.

**Aplicado em produção (com a sua autorização de 18/11):** SQL 024, pasta privada
`almox-arquivos` (onde a assinatura fica). Conferido: privada, 0 regras de acesso abertas.

## 3. Pronto, mas fora da `fase-1` de propósito (branch `sql-piloto`)

- **025** agendador da fila (item 6 acima).
- **026** aprovador deixa de ler custo (CMC, valores, fila, inventário…). Achado da auditoria de
  segurança. Muda a tela de aprovação para uma função nova: **o código e o SQL precisam subir
  juntos** (código antes do SQL derruba a tela de aprovação). Por isso não entrou no deploy de hoje.

Estado: **três revisões independentes, nada bloqueia.** A segunda rodada fechou também o custo
que sobrava (`cmc_entrega` dos itens de pedido); a terceira conferiu, contra o banco de produção,
que a troca para permissão por coluna não quebra nenhuma tela, função ou escrita. A branch já
está atualizada com a `fase-1` e no GitHub (`sql-piloto` = `d4fbd91`, 128 arquivos, **2514
testes, 0 falhas**, build ok). Quando você autorizar: eu junto na `fase-1`, aplico o 026 e você
clica Deploy logo em seguida (nessa ordem).

## 4. Auditoria de segurança do caminho do piloto

Nada bloqueia (`docs/almox/2026-11-18-auditoria-seguranca-piloto.md`). Técnico não vê nem cancela
pedido de outro; convite, PIN e sessão bem feitos; RLS ligada nas 42 tabelas; nenhuma função
aberta sem checar papel. Para saber no piloto: **quem errar o PIN de outro técnico de propósito
trava o acesso dele** (15 min → 1 h → 24 h); o almoxarife resolve em Colaboradores → desbloquear.

## 5. Antes de ligar a gravação — um ponto não medido

**Medido de madrugada (só leitura, `docs/almox/2026-11-19-omie-janela-listagem.md`):** a
listagem sem data devolve todos os 6.988 lançamentos da empresa, de 06/03/2026 (o mais antigo que
existe) a 18/11/2026. Não há janela curta: se existir alguma, ela é de pelo menos 8,5 meses, e a
fila só repete um código por horas ou dias. **Risco de duplicação por data: descartado na
prática.** Fica como melhoria opcional mandar `data_movimento_de: "01/01/2020"` na consulta
(medido que funciona junto do código); não fiz, por ser mudança não necessária.

## 6. Mensagem de status ao cliente (WhatsApp), atualizada

> Bom dia! Atualização do Almoxarifado:
>
> ✅ Novas telas prontas: *Retirada com assinatura* do técnico (no tablet, com PIN) e *Falhas no
> Omie* (mostra na hora qualquer lançamento que não entrar).
> ✅ Corrigimos um ponto na integração com o Omie antes de ligar a gravação.
>
> Próximo passo: piloto com 1 equipe. Preciso de vocês:
> 1. Qual equipe começa (sugiro a MANFAC 3)
> 2. Quem aprova os pedidos dessa equipe
> 3. Nome e celular dos técnicos
>
> Com isso cadastro e mando o convite para eles.

## 7. Backlog (nada bloqueia; anotado)

Retirada: arquivo de assinatura órfão se o registro falhar depois do upload; histórico de
aprovação some do detalhe quando o pedido está separado; saldo relido só ao confirmar (mockup
mostra antes). Falhas: falta o tile/alerta da tela inicial e o contador no menu; teste da contagem
não prova o filtro de ambiente. Omie: 3 casos do ponta a ponta só em teste de unidade. Segurança:
bloqueio dirigido de PIN (A2), enxurrada de falhas trava login por 5 min (A3), proxy único (A4),
convite encaminhado (A5), mesma origem com outros apps do hub (A6).
