# Decisões do João — Gestão de Frotas — 26/10/2026

Respostas dadas no chat, em perguntas de múltipla escolha. Texto das opções escolhidas, literal:

- **D1 — Trava do checklist para trocar carro da equipe:** "Trava só p/ carro (Recomendado)" — trocar o carro
  continua exigindo checklist (é o carro que o checklist inspeciona); motorista e nome da equipe passam a ser
  editáveis direto.
- **B5 — Alerta de revisão por KM:** "Avisa a 1.000 km (Recomendado)" — revisão aparece como "vence em breve" quando
  faltam 1.000 km ou menos e "atrasada" depois que passa.
- **B6 — Peças trocadas no detalhe da revisão:** "Sim, texto livre (Recomendado)" — campo de texto no formulário e no
  detalhe; exige coluna nova em `revisoes`, aplicada depois do mockup aprovado.
- **F2/F3 — Quem vê o botão de corrigir KM/abastecimento enquanto o José não responde:** em vez de escolher, o João
  perguntou "o que tem que responder sobre permissao". Tratado como: mockup mostra o botão para admin e marca o
  gestor de frotas como pendente da resposta do José (lista em `2026-10-23-diagnostico-permissoes.md` §5).

Instrução do mesmo dia: "irei trabalhar o dia todo em outro projeto e quero que você fique tocando o gestão de frotas,
deixe as decisões estratégicas para quando terminar a parte operacional".

## Permissões do Igor (D2) — decidido pelo João, 26/10/2026

Mensagem literal: "igor tem acesso total ao frotas, mas nao aos outros sistemas"

Leitura: equivale a "sim" nos 15 itens de `2026-10-23-diagnostico-permissoes.md` §5, inclusive os de desconto em
salário (11 a 13) e exclusões, **restrito ao Gestão de Frotas** — opção B do §4 (papel "gestor de frotas" só no
Sofia), não a opção A (administrador do hub). Substitui a validação item a item que estava pedida ao José.

## Mockup da rodada 2 — APROVADO pelo João, 26/10/2026

Mensagem literal: "prossiga, mockup aprovado"

Mockup: https://claude.ai/artifact/D8qNHTksGDkjztteE6vFy3 (versão 1). Cópia versionada: `docs/frotas/2026-10-26-mockup-rodada2.html`.
Aprovação vale para as 4 seções, incluindo as suposições que o mockup declarou: "vence em breve" não vira pendência
(aparece na lista e como aviso no painel); campo editável da equipe é o `codigo`; trocar motorista avisa que a equipe
anterior fica sem motorista; corrigir abastecimento não mexe em `veiculos.km_atual`; correção grava antes/depois na
Auditoria com motivo opcional.
