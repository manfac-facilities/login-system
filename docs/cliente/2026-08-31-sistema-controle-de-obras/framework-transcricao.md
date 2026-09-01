# Transcrição literal do `framework.jpeg`

Diagrama de fluxo desenhado pelo cliente. Caixas brancas = etapa do processo;
caixas amarelas = anotação sobre o estado atual; rosa = artefato/pergunta;
azul = pessoa/papel.

## Fluxo principal (topo → base)

```
OBRA APROVADA ──► EMAIL, WHATSAPP, TELEFONE
      │
      ▼
    FIELD ──► TÉCNICO VAI PREENCHER EM CAMPO E FINALIZAR A OS ──┬─► RELATÓRIO FOTOGRÁFICO
      │                                                          └─► FECHAMENTO DA OS
      ▼
 BASE DE OBRAS
```

## Ramificações a partir de BASE DE OBRAS

| Ramo | Anotação amarela (estado atual) |
|---|---|
| DIA A DIA DAS OBRAS | FAZ MANUAL E DEPENDE DO RESP DA OBRA |
| DASHBOARD DAS OBRAS | NÃO EXISTE HOJE |
| RELATÓRIOS PARA REUNIÃO | EXISTE, PORÉM SEM PADRÃO E MAL FEITO |
| ADMINISTRATIVO | ZEEV |

`DIA A DIA DAS OBRAS ──► VISÃO DO QUE FOI EXECUTADO CADA DIA`

## Ramo esquerdo (visão diária)

```
VISÃO DO QUE FOI EXECUTADO CADA DIA
      ▼
RDO — RELATÓRIO DIÁRIO DE OBRAS   (rosa)
      ▼
SABER O QUE FOI PRODUZIDO NAQUELE DIA.
TEVE PRODUÇÃO? FALTOU ALGUM ITEM?   (rosa)

YURI — ANALISTA DE OBRAS  (azul) ──► TÉCNICO OU PRESTADOR DE SERVIÇO  (azul)
```

## Ramo direito (administrativo)

```
ADMINISTRATIVO (ZEEV)
      ▼
 FINANCEIRO
      ▼
  COMPRAS
      ▼
CONTRATAÇÃO DE PARCEIROS
```
