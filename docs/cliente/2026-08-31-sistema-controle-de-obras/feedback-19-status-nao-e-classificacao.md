# Feedback 19 — o cliente separa status de classificação

**Recebido em 15/09/2026, noite**, colado pelo João no chat do Claude Code, respondendo à pergunta
sobre os estados de fronteira. **Registrado literal antes de qualquer interpretação.**

## Texto literal

> o cliente disse a respeito da pergunta: ela continua confundindo, ela ta confundindo status com
> classificação

## O que estava errado, e é erro nosso

O Field tem **dois** campos por atividade, e nós tratamos os dois como um só:

- **status** — texto livre, preenchido pela equipe. É onde aparecem "Falta de Tempo", "Fechar OS",
  "Foi feito atendimento" e até frases inteiras sobre serralheiro e postinhos.
- **classificação** (`statusClassification` na API) — campo estruturado, com valores fixos:
  pendente, agendado, a caminho, em andamento, resolvido e afins.

**O critério do cliente (feedback 18: "pendente ou agendado") é de classificação.** A planilha das
185 OS e a tabela de contagens do feedback 18 foram montadas sobre o campo **status**, o errado.

## O que cai por terra

- A contagem "45 pendentes + 13 agendadas = 58 OS" — foi calculada pelo campo errado.
- A pergunta sobre "Fechar OS" e "Foi feito atendimento" serem ou não conclusão: eles não são
  classificação nenhuma, são texto que alguém digitou. A classificação dessas OS está em outro
  campo, que ainda não olhamos.
- A pergunta sobre os "estados de fronteira" (a caminho, em andamento, orçamento aguardando
  aprovação) misturava os dois campos, e foi ela que o cliente chamou de confusa.

## O que fazer

1. Recontar tudo por **classificação**, e só por ela.
2. Refazer a coluna da planilha do cliente para mostrar a classificação, no vocabulário dele.
3. Só então perguntar, se ainda restar dúvida, e com uma pergunta escrita na língua do campo certo.
