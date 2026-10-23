# Triagem — reunião de Frotas de 20/10/2026 (José Guilherme + Igor)

Fonte literal: `docs/cliente/2026-10-20-reuniao-frotas-igor-jose-transcricao.md` (minutos entre colchetes).
Critério combinado na reunião: **bug** = existe mas não funciona; **falta** = não existe e a operação precisa; **melhoria** = segunda bateria.
Ordem combinada: primeiro os bugs que travam o dia a dia, depois melhorias. Foco do José: "a relação entre motorista, equipe e carro" [16:22] e editar o KM diário.

Contexto técnico: `sdd-sql-v04-seguranca.sql` bloqueia para não-admin, por trigger, status/autorização de multa e sinistro,
DELETE de km_diario e abastecimentos, `equipes.ativo`, `veiculos.valor_locacao_mensal`. Parte do que o Igor relata pode ser isso.

## Bugs (existe, não funciona)

| # | O quê | Onde na fala |
|---|---|---|
| B1 | Sinistro: atualizar/encerrar a tratativa não salva — mostra "salvando" e volta "aberto"; sem confirmação de salvo | [20:14] [20:33] [20:56] |
| B2 | Multa: registra, mas não consegue solicitar desconto nem tirar de "pendente" | [10:17] [10:32] |
| B3 | Checklist: os já feitos não aparecem; tela sempre em "criar primeiro" | [05:42] |
| B4 | Permissão: Igor recebe "só administrador" ao editar equipe/motorista e ao cancelar KM diário (pede senha) e abastecimento | [17:22] [17:46] [18:45] [19:06] |
| B5 | Revisão: KM previsto da próxima não cruza com o KM diário; não avisa que passou | [24:22] [24:38] |
| B6 | Revisão lançada não abre o detalhe (observações, peças trocadas) | [11:xx] [12:17] |
| B7 | Sinistro aberto não tem botão de voltar | [20:40] |
| B8 | "Pendências": conferir o que de fato é pendência | [23:39] |

## Falta (não existe, a operação precisa) — José chamou de bug

| # | O quê | Onde |
|---|---|---|
| F1 | Editar equipe: placa do carro, nome, motorista — hoje só troca via checklist (trava) | [05:42] [15:05] |
| F2 | Editar KM atual do veículo / corrigir KM diário digitado errado (erro de 1 km trava os dias seguintes) | [06:45] [10:32] |
| F3 | Corrigir abastecimento digitado errado (litro, km) | [19:06] |
| F4 | Atualizar documento/CNH do motorista — José: "não é questão para agora" | [15:33] |
| F5 | Lançar valor de locação de cada veículo | [14:42] |
| F6 | Histórico do veículo / abastecimento de meses anteriores | [10:32] |

## Melhorias (segunda bateria)

Visão geral nova [05:09]; bases em tabela com exportar (abastecimento, KM, motoristas) [19:19] [26:14]; revisão automática de 10 em 10 mil + corretiva manual + importar lista do Igor [12:28]–[13:44]; módulo de manutenção corretiva [13:46]; fotos sem limite e aba de avaria [21:05]–[22:31]; histórico de checklist para comparar fotos [08:18]; importar TicketLog TXT/Excel [24:55] [25:29]; cartão do motorista [25:54]; extrato equipe×carro×motorista por data [26:28]; processo de multa refeito [02:32]; e-mail de alerta [23:58]; % de disponibilidade [23:01].

## Decisões em aberto

- D1 — Trava do checklist para trocar carro da equipe: José quer tirar [05:42]; João defendeu manter [06:56]; Igor faz checklist sempre e quer histórico [08:18].
- D2 — O que o Igor (gestor de frotas, não-admin) pode editar: José pediu "revisa as permissões dele, me manda, eu valido" [18:03].

## Cruzamento com o documento do Igor (Word, 14 processos)

Fonte: `docs/cliente/2026-10-20-processos-de-frota/PROCESSOS_DE_FROTA_SISTEMA_DE_GESTAO_DE_FROTAS.md`, seções "Oportunidades de Melhoria".
O documento é um mapa de processos e de melhorias, **não uma lista de bugs**. Na reunião o José pediu para não sair fazendo tudo dele [00:01].

Itens do documento que já estão nesta triagem (entram junto com a frente de bugs):
- 4.7.2 histórico do vínculo motorista × veículo × equipe → F1 / extrato [26:28]
- 9.12.3 detalhe do que foi feito em cada revisão → B6
- 11.10.4 e 11.10.6 histórico de checklist, trazer o último na troca → B3 + D1
- 2.12.5 alerta de revisão pelo KM previsto → B5

Todo o resto fica na segunda bateria, agrupado por processo: Ticketlog automático e saldo pré-pago (1, 8, 10); avisos de foto faltando no KM (2.13); contratos das outras locadoras (3); endereço/e-mail do motorista e desligamento × 30% da rescisão (4.7.3–4.7.4); higienização (5); assinatura remota e prazo de indicação de multa (6); SLA de sinistro (7); boletos e rateio automático (10); checklist periódico com comparação automática e indicadores de avaria (11); ocorrências fora do horário (12); escala de plantão (13); indicadores consolidados (14).
