# Roteiro de teste — cancelamento de obra e ajustes da ficha

**Data:** 24/09/2026 · **Quando usar:** depois do próximo deploy do Controle de Obras em produção
(`hub.manfac.com.br/obras`). **Quem executa:** qualquer pessoa da equipe com acesso ao sistema.

## Antes de começar

- Isto é **produção** — dado real. Escolha para o teste de cancelamento uma obra que **precise
  mesmo ser cancelada**, ou cancele e já desfaça em seguida (passo 10), para não deixar uma obra
  real cancelada por engano.
- Para o teste de "edição ao mesmo tempo" (bloco 3), você precisa de **duas pessoas** (ou duas abas
  do navegador, uma anônima) logadas ao mesmo tempo na mesma obra.
- Marque cada linha como **OK** ou **Deu errado**, e escreva o que apareceu na tela quando der
  errado. No fim, mande o roteiro marcado de volta.

---

## Bloco 1 — Cancelar uma obra e desfazer

**1.** Abra a ficha de uma obra que esteja em **Levantamento**, **Em andamento** ou **Paralisado**.
Role até o quadro **"Ciclo de vida da obra"**.

- Deve aparecer: abaixo do seletor de etapa, uma faixa **"Encerrar sem executar"** com o botão
  **"Cancelar obra"**.
- [ ] OK  [ ] Deu errado — o que apareceu:

**2.** Clique em **"Cancelar obra"**.

- Deve aparecer: uma janela **"Cancelar a obra [nome da loja]"**, com "Quem cancelou?" (duas
  opções: "Cancelado pelo Cliente" / "Cancelado pela Manfac"), um campo de observação opcional, e
  os botões **"Voltar sem cancelar"** e **"Cancelar obra"**.
- [ ] OK  [ ] Deu errado — o que apareceu:

**3.** Sem escolher quem cancelou, tente clicar em **"Cancelar obra"** (o botão da janela).

- Deve aparecer: o botão **desabilitado**, e a frase **"Escolha quem cancelou para continuar."**
- [ ] OK  [ ] Deu errado — o que apareceu:

**4.** Escolha **"Cancelado pelo Cliente"** ou **"Cancelado pela Manfac"** (o que fizer sentido
para a obra escolhida). Pode deixar a observação em branco — é opcional. Clique em **"Cancelar
obra"**.

- Deve aparecer: a janela fecha e a própria ficha já aparece cancelada, com uma faixa cinza
  mostrando "Cancelado pelo Cliente" (ou "pela Manfac"), a data e hora, quem cancelou, e a etapa
  em que a obra estava.
- [ ] OK  [ ] Deu errado — o que apareceu:

**5.** Confira o resto da ficha: fotos, diário e histórico anteriores.

- Deve aparecer: nada some — fotos, diário e histórico da obra continuam visíveis, só que a ficha
  não deixa mais editar nada (sem botão Editar nos blocos).
- [ ] OK  [ ] Deu errado — o que apareceu:

**6.** Vá em **Controle de Obras → Diário do dia** e em **Controle de Obras → Tarefas**.

- Deve aparecer: a obra cancelada **não aparece** em nenhuma das duas telas.
- [ ] OK  [ ] Deu errado — o que apareceu:

**7.** Vá em **Controle de Obras → Base**, deixe o filtro de etapa em **"Todas"**, e olhe o Kanban.

- Deve aparecer: a obra cancelada não está na lista nem no Kanban; embaixo da lista aparece o
  aviso **"N obra(s) cancelada(s) fora desta lista · ver canceladas"**.
- [ ] OK  [ ] Deu errado — o que apareceu:

**8.** Clique em **"ver canceladas"**.

- Deve aparecer: a lista muda para o grupo **"Canceladas"**, a obra aparece com a etiqueta
  **"Cancelada · Cliente"** (ou "· Manfac"), e a coluna "Dias em aberto" mostra **"—"**.
- [ ] OK  [ ] Deu errado — o que apareceu:

**9.** Volte à ficha da obra cancelada e clique em **"Desfazer cancelamento"**.

- Deve aparecer: uma janela **"Desfazer o cancelamento?"** dizendo para onde a obra volta, com os
  botões **"Manter cancelada"** e **"Desfazer cancelamento"**.
- [ ] OK  [ ] Deu errado — o que apareceu:

**10.** Clique em **"Desfazer cancelamento"** (o botão da janela).

- Deve aparecer: a ficha volta exatamente para a etapa em que a obra estava antes de cancelar (o
  selo cinza desapareceu, o seletor de etapa voltou, o botão "Cancelar obra" voltou a aparecer).
- [ ] OK  [ ] Deu errado — o que apareceu:

**11.** Confira de novo o Diário do dia, Tarefas, e a Base com o filtro "Todas".

- Deve aparecer: a obra voltou a aparecer normalmente em todas as três telas, como antes do
  cancelamento.
- [ ] OK  [ ] Deu errado — o que apareceu:

**12.** Na ficha, abra o **Histórico de alterações** e filtre por **"Cancelamento"**.

- Deve aparecer: duas linhas novas — uma do cancelamento e uma do "desfazer", com quem fez e
  quando.
- [ ] OK  [ ] Deu errado — o que apareceu:

---

## Bloco 2 — Obra que já foi executada não pode ser cancelada

**13.** Abra a ficha de uma obra que já esteja em **"Relatório de entrega"** ou em qualquer etapa
depois dela (Executado, Fechar OS, Faturado, etc.).

- Deve aparecer: **nenhum botão** "Cancelar obra" no quadro Ciclo de vida — só a frase **"Esta
  obra já foi executada em campo e não pode ser cancelada. Ela segue até faturar o que foi feito
  (decisão do cliente, 14/09)."**
- [ ] OK  [ ] Deu errado — o que apareceu:

---

## Bloco 3 — Duas pessoas editando a mesma obra ao mesmo tempo

**14.** Com duas pessoas (ou duas abas) logadas, abram a **mesma obra** e, no mesmo bloco (por
exemplo, **Cronograma**), cliquem em **Editar** nas duas. A Pessoa A altera um campo e clica em
**Salvar** primeiro (confirme que salvou). Em seguida, a Pessoa B — sem recarregar a página —
altera outro campo do mesmo bloco e clica em **Salvar**.

- Deve aparecer, para a Pessoa B: uma mensagem dizendo que **não salvou**, com a frase **"Outra
  pessoa alterou esta obra enquanto você editava. Recarregue a página para ver o que foi gravado e
  refaça a sua alteração."** O que a Pessoa B tinha digitado continua no formulário (não some).
- [ ] OK  [ ] Deu errado — o que apareceu:

---

## Bloco 4 — Trocar a etapa pelo seletor aparece no Histórico

**15.** Numa obra qualquer (não cancelada), use o **seletor de etapa** no quadro Ciclo de vida
para mudar a etapa para a próxima da esteira. Depois, abra o **Histórico de alterações**.

- Deve aparecer: uma linha nova no Histórico no formato **"Esteira · Etapa: [etapa antiga] →
  [etapa nova]"**.
- [ ] OK  [ ] Deu errado — o que apareceu:

---

## Bloco 5 — Data de início inválida na Triagem

**16.** Abra uma obra que esteja em **"Aguardando definição"** (Triagem). No campo **Data de
início**, tente digitar uma data que não existe (por exemplo, 31/02) ou um ano com 5 dígitos, se o
navegador deixar. Preencha os outros campos obrigatórios normalmente e tente salvar.

- Deve aparecer: a mensagem **"Data de início inválida. Confira o dia, o mês e o ano."**, e a obra
  continua em "Aguardando definição" (nada foi salvo).
- [ ] OK  [ ] Deu errado — o que apareceu:

---

## Ao terminar

Mande este roteiro marcado de volta. Se algum passo deu errado, descreva exatamente o que
apareceu na tela (ou uma captura de tela) — isso encurta a correção.
