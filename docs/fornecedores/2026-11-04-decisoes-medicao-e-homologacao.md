# Medição "com quem está" e fim da homologação — decisões (04/11/2026)

Pedido literal: `docs/cliente/2026-11-04-feedback-fornecedores-medicao.md`.
João (literal): "pode seguir com o 1 e o 2 como propos".

## 1. "Com quem está" a medição (só tela, sem banco)
Linha "Com: …" destacada em cada medição, na Fila de aprovação e no Acompanhamento:
- solicitada + Obra sem pré-aprovação → "Com o engenheiro da obra (<engenheiro>) · pré-aprovação"
- solicitada (pré-aprovada ou sem obra) → "Com <nome(s) de aprovador_contratacao ativos em frn_papeis> · aprovação da medição"
- devolvida → "Com <solicitante> · para corrigir"
- aprovada → "No Financeiro" (pagamento)
Nomes dos aprovadores lidos de `frn_papeis`, nunca fixos no código.

## 2. Fim da homologação de fornecedor (banco: migration 016)
- Aprovação do José passa a valer só para a condição de pagamento; fornecedor novo não trava mais o contrato.
- As 3 conferências (CNPJ, banco, certidões) somem da tela; certidão deixa de ser obrigatória (anexar continua possível).
- Histórico preservado: colunas `homolog_*`/`homologado*` e eventos antigos ficam; nada é apagado.
- Leitura do pedido: "o Omie já cuida do cadastro". O sistema NÃO consulta o Omie (só manda pagamento ao Financeiro → Omie). Se o João quis conferência automática no Omie, é outro trabalho.
- Fluxo: 2 agentes (um por frente), revisão independente, aplicar 016, merge; Deploy é do João.
