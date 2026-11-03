# Frotas — terceira bateria: decisões do João (03/11/2026)

## Texto literal do João

> "vamos fechar tudo hoje, to operando o pc agora e se botar os agentes todos para acabar hoje vai travar, quando eu parar de usar te sinalizo e voce acaba o sistema essa madrugada"

> "tudo aprovado,prossiga"

A segunda mensagem respondeu à apresentação dos dois mockups, que pedia: aprovar os mockups (inteiros ou com
mudanças) e aprovar as mudanças de schema listadas abaixo.

## O que foi aprovado

Mockups (aprovados inteiros, com todas as decisões em aberto resolvidas pela recomendação escrita em cada um):

- Manutenção e bases — `docs/frotas/mockups/2026-11-03-mockup-manutencao-e-bases.html`
  (https://claude.ai/artifact/Bwf22ugdZmLvHHAtCUw3j6)
- Multa, Pendências (B8), fotos/avaria, histórico do checklist —
  `docs/frotas/mockups/2026-11-03-mockup-multa-fotos-checklist.html`
  (https://claude.ai/artifact/V1Darj3zA3D811LSkCEwsh)

Schema aprovado (conforme listado ao João):

- Manutenção: tabela nova `manutencoes`; colunas `revisoes.prever_proxima`, `revisoes.origem`; `veiculos.intervalo_revisao_km`.
- Multa: colunas novas em `multas` (etapa, locadora, auto_infracao, orgao_autuador, pontos, prazo_indicacao,
  motorista_condutor_id, indicado_em, protocolo_indicacao, boleto_lancado_em, pago_em_dobro, responsavel_dobro,
  desconto_competencia); tabela nova `multa_etapas`.
- Avaria: tabela nova `checklist_avarias`; colunas `checklist_fotos.avaria_id`, `checklist_fotos.tipo_foto`.
- Decisão 3 da multa (aceita pela recomendação): gestor de frotas solicita desconto, **só admin autoriza** — mexe na
  trigger de multas (território de exceção do AGENTS.md: autorização + dinheiro → revisão independente obrigatória).

## O que segue em aberto

- Aplicar SQL em produção: a trava exige autorização escrita citando os arquivos, na hora.
- E-mail diário: `SOFIA_ALERTAS_SECRET` no EasyPanel + Deploy (João); Vault + `sdd-sql-sofia-alertas-cron.sql` (autorização).
- José recebe o e-mail diário? Sem resposta — segue só o Igor (`sofia_gestores`).
- Planilha real de revisões do Igor: não recebida. A importação tem passo de mapeamento de colunas, então sai assim;
  conferir com a planilha real antes da primeira carga.
- Ritmo: de dia no máximo 2 agentes; implementação pesada só depois do sinal do João (madrugada).
