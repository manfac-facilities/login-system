# Feedback 17 — o critério do que entra no sistema

**Recebido em 15/09/2026, noite**, colado pelo João no chat do Claude Code, em resposta ao Excel
com as 185 OS e à pergunta sobre o que deveria entrar. **Registrado literal antes de qualquer
interpretação.**

## Texto literal

> o cliente respondeu: é que vc ta puxando todas as OS, vc tem que puxar tudo que nao está
> arquivado, nem resolvido/concluído

## Leitura

O critério da carga deixa de ser "toda OS do serviço Atividade Spot" e passa a ser:

- **não arquivada** no Field, e
- **não resolvida nem concluída**.

## O que isso muda nos números de 15/09

Das 185 OS extraídas hoje (`entregas/os-field-atividade-spot-2026-09-15.xlsx`), pelo status da
última atividade:

| Status | OS | Entra? |
|---|---|---|
| Resolvido | 58 | não |
| done | 51 | não |
| pending | 45 | sim |
| scheduled | 13 | sim |
| Orçamento Aguardando Aprovação | 4 | sim |
| Falta de Tempo | 3 | sim |
| reported | 2 | sim |
| Fechar OS | 2 | **a decidir** — é desfecho, não conclusão declarada |
| Foi feito atendimento | 1 | **a decidir** — mesma dúvida |
| Programado, on-route, in-progress | 3 | sim |
| Texto livre digitado no lugar do status | 3 | sim |

**Aproximadamente 76 OS entram**, contra 185 pelo critério antigo.

## Perguntas que a fala do cliente deixa em aberto

1. "Fechar OS" e "Foi feito atendimento" contam como concluídas?
2. E a OS que **fica** resolvida depois de já estar no sistema? O sistema nunca apaga por causa do
   Field (regra fechada em 10/09), então ela permanece — o critério vale para **entrada**, não
   para remoção.
3. O status vem da **última atividade** da OS. Uma OS com atividade resolvida e outra pendente
   entra, porque a última manda.
