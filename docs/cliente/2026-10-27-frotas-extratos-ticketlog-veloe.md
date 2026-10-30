# Pedido ao Gestão de Frotas: extratos da Ticketlog e da Veloe

De: Jose Guilherme (financeiro). Data: 27/10/2026.
Para: João, ler nas sessões do Claude do Gestão de Frotas, como ponto de partida
de um brainstorming (não é uma spec fechada: o desenho do sistema é seu).

## Contexto em 1 minuto

A Ticketlog (combustível) e a Veloe (pedágio e estacionamento) são **carteiras
pré-pagas**. O financeiro recarrega (PIX de valor redondo) e os motoristas
consomem depois. Decidido com a contabilidade e a controladoria:

- cada carteira vira uma **conta corrente da Manfac no Omie**;
- a **recarga** é transferência do BTG para essa conta (sem centro de custo);
- o **consumo** é a despesa: sai dessa conta, somado **por dia e por centro de
  custo**, para sabermos quanto cada obra gastou.

O financeiro (repositório `financeiro`, módulo do hub) cuida da recarga, da
conciliação e de **toda escrita no Omie**. O que falta é a origem do consumo por
centro de custo, e isso mora no Gestão de Frotas, porque é lá que estão veículos,
cartões e equipes. Desenho completo do lado do financeiro:
`financeiro/docs/superpowers/specs/2026-10-27-financeiro-carteiras-frota-design.md`.

## O que o financeiro precisa do Gestão de Frotas

1. **Cadastro de ligação**
   - Cartão Ticketlog (`NUMERO CARTAO`) → equipe.
   - Tag Veloe (`VeloeTag`) e/ou placa → veículo → equipe.
   - Equipe → centro de custo do Omie, **com data de início** (a equipe quase
     sempre fica no mesmo centro de custo, mas pode mudar).
   - Atenção: na Ticketlog a **placa não serve** — na amostra de outubro todas as
     206 transações vieram com a mesma placa (cadastro errado lá). O que vale é o
     **cartão** (26 cartões, um por equipe). O nome do motorista vem como texto
     livre ("NOME - EQUIPE 17") e também não serve de chave.

2. **Envio dos extratos pelo setor de Frotas**
   - A qualquer momento, quantas vezes quiser, com períodos que se sobrepõem.
   - Cada linha é guardada pelo **código da transação**; linha repetida é
     ignorada, nunca duplicada. Reenviar o mesmo arquivo não muda nada.
   - A cada envio, o Frotas **digita o saldo atual** que a plataforma mostra
     (o extrato não traz saldo nem recargas).
   - Linha cujo cartão/tag não tem equipe ligada fica numa lista **"sem centro de
     custo"** para o Frotas resolver.

3. **Entrega para o financeiro** (o banco do hub é compartilhado), por plataforma:
   - cada linha: plataforma, código da transação, **data de uso**, valor,
     centro de custo resolvido (ou vazio), quando chegou;
   - cada saldo digitado: plataforma, valor, data/hora, quem digitou.
   O financeiro só **lê** isso. Forma de entrega (tabela sua com leitura liberada,
   view, função) fica para combinarmos — por favor, proponha antes de construir.

## Os arquivos (amostras reais de 01/10 a 27/10/2026)

**Ticketlog** — `.xlsx` (`RFCV_<cliente>_<data>_<hora>.xlsx`), aba "Transações",
cabeçalho na 1ª linha, 39 colunas. Usar:
`CODIGO TRANSACAO` (único), `DATA TRANSACAO` (data e hora), `NUMERO CARTAO`,
`VALOR EMISSAO`, `SERVICO` (só "Abastecimento" na amostra). Úteis para a tela de
vocês: `LITROS`, `VL/LITRO`, `HODOMETRO OU HORIMETRO`, `NOME ESTABELECIMENTO`,
`CIDADE`.

**Veloe** — `.csv` separado por `;`, vírgula decimal, 31 colunas. Usar:
`ID Transacao` (único), `Data de Utilizacao` (**não** a de processamento: diferem
em ~6% das linhas), `Hora de Untrada` (sic), `Placa`, `VeloeTag`, `Valor Cobrado`,
`Tipo do Movimento` (só "Debito" na amostra), `Tipo de Transacao` (passagem,
estadia, "REENVIO DENTRO SLA" — reenvio **não** é duplicata, é cobrança real).
`CPF/CNPJ` vem estragado pelo Excel (notação científica): ignorar.

Os dois têm nome de motorista: dado pessoal, fora de log e de e-mail.
O Jose pode passar os arquivos de amostra.

## Combinados que valem para os dois lados

- Fora deste pedido: cruzar com RH e orçamento/PEF (vem depois, a ideia é tudo
  interligado apontando divergências); notas fiscais dos postos; Ticketlog
  pós-pago (boletos — não é carteira).
- Período inicial: os relatórios a partir de **01/08/2026** serão enviados para
  regularizar o passado.
- Nada de escrita no Omie a partir do Gestão de Frotas.

## Perguntas para o João responder antes de construir

1. Onde fica a ligação equipe → centro de custo hoje no sistema novo, e ela usa o
   mesmo código de centro de custo do Omie?
2. Qual forma de entrega para o financeiro você prefere (item 3)?
3. Previsão de quando o envio dos extratos fica pronto.
