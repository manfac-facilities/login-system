# Revisão adversarial da spec F1/F2/F3 — 26/10/2026

Revisor independente. Veredito: **aprovada com uma correção obrigatória**. Sem corrupção de dado alcançável, sem falha
aberta, sem retorno do B-13; migration não derruba nada.

## Correção obrigatória (prevalece sobre a spec)

### 1. KM excedido: a correção nunca fica em silêncio; resposta do João vira pré-requisito do deploy
Substitui a última frase do §3.4 ("Até a resposta, a action não chama nada de excedência"):

> Até a resposta, a action não altera `km_excedido_desconto`, mas **nunca fica em silêncio**: depois da correção, se
> existir linha em `km_excedido_desconto` para `(veiculo_id, mês do lançamento)`, a mensagem de sucesso acrescenta:
> "Este mês tem registro de KM excedido para o {placa}. A correção não altera esse registro — confira em Descontos."
> A resposta do João à pergunta 1 do §8 é pré-requisito de **C16** (deploy). Se chegar antes de C4, a regra
> escolhida entra em C4.

Acrescentar em C4 o caso de teste correspondente e, em C16, "pergunta 1 do §8 respondida".

A pergunta 1 do §8 passa a cobrir três casos:
- (a) correção cria excesso (sem linha no mês): seguir o fluxo do lançamento (cria linha e pendência);
- (b) correção tira o excesso e status `sem_solicitacao`: apagar a linha e fechar a pendência (apaga dado de cliente
  — escolha do João) ou manter e avisar; atualizar `km_realizado` abaixo do contratual faz `descontos/page.tsx:168`
  mostrar "+-N km";
- (c) status `solicitado`/`autorizado`: não mexer e avisar.

## Backlog — o coordenador decidiu INCLUIR na implementação
- B1: F3 só valida KM quando `p_km is distinct from v_ab.km` (banco e prévia do cliente); senão o legado fora de ordem
  bloqueia corrigir só os litros. (Vizinho mais próximo com KM fica, junto com B1.)
- B2: F1 trava primeiro os veículos (o da equipe e o da equipe de origem, em ordem de id), depois equipe e motoristas;
  corrigir o texto do R8 (ciclo com `lancar_km_atomico` via KEY SHARE da FK).
- B3: F2 confere `k.veiculo_id = v_veiculo_id` depois de travar o lançamento.
- B4: `corrigirKmAction` recusa KM não inteiro com mensagem clara.
- B5: casos de teste SQL faltantes — F1: "Sem motorista" com motorista atual; motorista sem equipe; motorista inativo
  dá `SOF01`; legado com dois ativos (prova que limpa todos); inativos não tocados. F3: KM apagado (null) e pulo do
  vizinho sem KM.
- B6: deixar escrito que a verificação nº 8 é textual; a ordem de trava é garantida por leitura do código.
- B9: audit de F1 guarda os ids dos motoristas em `antes`, não só nomes.
- B10: "era X km" busca por `registro_id in (...)`, não pelos 200 mais recentes.

## Backlog — vai para `docs/DIVIDAS.md` (e B7/B12 avisar o João)
- B7: `veiculo-motorista/route.ts:21-28` sugere o motorista do registro aberto, não o da data da infração (multa que
  chega depois de uma troca sugere o motorista novo; campo é editável). Impacto em desconto.
- B8: checklist (`atribuir_responsabilidade_veiculo`) não limpa o motorista anterior da equipe de destino.
- B11: corrigir o primeiro lançamento pode levar `km_atual` abaixo do KM de cadastro (prévia mostra).
- B12: o ✕ do KM continua sem recalcular `km_atual` (R5).

## Pergunta 2 do §8 — opção do meio sugerida pelo revisor
`revoke update, delete on public.audit_log from authenticated`: o app só faz insert/select em `audit_log`
(`lib/sofia/auditLog.ts:16`, `audit/page.tsx:22`). Impede alterar/apagar o histórico de correções; inserir linha
falsa continua possível.
