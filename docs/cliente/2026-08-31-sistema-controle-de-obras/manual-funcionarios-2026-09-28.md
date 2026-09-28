# Controle de Obras — Manual do usuário

Manfac · setembro/2026

## O que é

O Controle de Obras é o sistema que acompanha cada obra desde a hora em que ela entra
(pelo Field Control) até o momento em que é faturada. Ele substitui a planilha: mostra
em que etapa cada obra está, de quem é a vez de agir e há quantos dias ela está parada
ali.

## Para que serve

- Ver todas as obras de uma vez, com quem está com cada uma e o que está travando.
- Responder, todo dia, se a obra andou em campo — e por quê, quando não andou.
- Cobrar automaticamente quem precisa resolver uma falta (material, ferramenta, equipe,
  documento ou foto), com prazo.
- Registrar quem autorizou a obra, quando a OS foi aprovada pelo cliente e quando foi
  fechada.
- Cancelar uma obra que não vai ser executada, sem apagar nada.

## Como entrar

1. Acesse **hub.manfac.com.br** e faça login.
2. Clique no card **Controle de Obras**.
3. Se o card não aparecer, seu acesso ainda não foi liberado — peça a um administrador
   do hub para liberar o acesso ao módulo **Controle de Obras** em Admin → Acessos.

O sistema tem três telas principais, nas abas do topo: **Diário do dia**, **Tarefas** e
**Base de obras**. A partir de qualquer uma delas, clicar numa obra abre a **ficha**
dela.

---

## Base de obras

**Para que serve:** ver a base inteira, filtrar e encontrar uma obra.

No topo da tela ficam os **indicadores** (quantas obras aguardam definição, estão em
andamento, paralisadas, presas no fechamento, pendentes de faturamento, sem OS
aprovada, sem cobertura, aprovadas há mais de 60 dias, ou passaram do prazo). Eles
sempre mostram a base inteira, mesmo quando você aplica um filtro — não são afetados
pela busca.

1. Escolha **Tabela** ou **Kanban** no topo da lista. A Tabela mostra todas as colunas
   (no celular vira uma lista de cartões); o Kanban agrupa as obras por fase do
   processo (Antes de executar, Executando, Fechamento, Faturamento).
2. Para achar uma obra, digite no campo **Buscar loja ou OS** — funciona com o nome da
   loja, o número da OS ou parte da descrição.
3. Use os filtros **Responsável da obra**, **Etapa da obra**, **Autorização**,
   **Classificação** e **Field Control** para restringir a lista.
4. Na Tabela, clique no cabeçalho de uma coluna para ordenar por ela; clique de novo
   para inverter.
5. Clique em qualquer linha ou cartão para abrir a ficha da obra.

**Atenção:** obras canceladas ficam de fora da lista "Todas" de propósito. Para vê-las,
use o filtro **Etapa da obra** e escolha uma das opções de "Canceladas", ou clique em
"ver canceladas" no aviso que aparece no fim da lista.

---

## Ficha da obra

A ficha é a tela de uma obra: mostra onde ela está, de quem é a vez de agir e há quanto
tempo. Ela abre ao clicar em qualquer obra, na Base, no Diário ou nas Tarefas.

### A esteira: onde a obra está

**Para que serve:** ver o caminho completo da obra, do que já passou ao que falta.

A esteira lista os passos da obra em ordem: Execução em campo → Relatório de entrega →
Executado - pendente aprovação OS (só quando a OS não estava aprovada antes) → Fechar
OS → Pendente faturamento → Faturado. O passo em que a obra está agora fica marcado com
"a obra está aqui".

1. Abra a ficha da obra.
2. Role até **Ciclo de vida da obra**.
3. Veja o passo atual, quem é o dono dele e há quantos dias está parado ali.

**Atenção:** a obra **não sai de campo sozinha**. Quando a equipe terminar o serviço, abra a
ficha e use **Mudar a etapa desta obra** para levá-la a **Relatório de entrega** (e depois às
etapas seguintes). Sem isso, ela continua aparecendo como em campo.

### Obra aguardando definição (Triagem)

**Para que serve:** preencher o mínimo para a obra poder entrar no dia a dia.

Enquanto a obra está na etapa "Aguardando definição", abrir a ficha mostra um checklist
em vez da esteira normal. Nenhuma obra aparece no Diário do dia até esses cinco campos
estarem completos.

1. Abra a ficha da obra recém-chegada (etapa "Aguardando definição").
2. Preencha **Responsável da obra**, **Equipe / prestador**, **Prioridade**, **Data de
   início** e **Duração em dias**.
3. Se já souber quem autorizou a execução ou se a OS já foi aprovada, preencha também
   e clique em **Salvar dados** — isso não libera a obra, só guarda o que você já sabe.
4. Com os cinco campos do checklist completos, clique em **Liberar para o diário do
   dia**.

**Atenção:** ao liberar, a obra entra na base como "Levantamento" e passa a ser cobrada
todo dia no Diário.

### Os três blocos que você edita

**Para que serve:** manter Autorização, Identificação e Cronograma atualizados depois
que a obra já está em andamento.

1. Na ficha, localize o bloco (**Autorização**, **Identificação** ou **Cronograma**) e
   clique em **Editar**.
2. Altere os campos necessários.
3. Clique em **Salvar**.
4. Se o que salvar destravar a obra (por exemplo, preencher a data de aprovação da OS
   numa obra parada esperando isso), o sistema avisa antes e pede confirmação.

Alguns campos não se editam na ficha porque vêm do Field Control (Nº OS, Loja,
Chamado) — eles são corrigidos lá, e o sistema só os preenche aqui quando estão vazios.

**Dica:** cada bloco mostra no rodapé quem editou por último e quando.

### Mudar a etapa da obra

**Para que serve:** mover a obra manualmente de uma etapa para outra.

1. Na ficha, role até **Ciclo de vida da obra** e use o campo **Mudar a etapa desta
   obra**.
2. Escolha a nova etapa na lista.
3. Se a mudança for de "Fechar OS" para "Pendente faturamento", informe também a
   **Data de fechamento da OS** — ela vem preenchida com hoje, mas pode ser ajustada
   se o fechamento aconteceu em outro dia.
4. Clique em **Confirmar mudança**.

**Atenção:** qualquer pessoa com acesso ao Controle de Obras pode mudar a etapa. Fica
registrado quem mudou e quando. Se a obra já estiver com a OS fechada, dá para
**corrigir a data** depois, direto no passo "Fechar OS" da esteira.

### Remarcar o início

**Para que serve:** registrar por que a data de início mudou.

1. No bloco **Cronograma**, clique em **Editar**.
2. Altere o campo **Início planejado**.
3. Clique em **Salvar** — a janela **Remarcar o início da obra** abre automaticamente.
4. Escolha o **motivo** na lista (ou clique em **+ Cadastrar novo motivo** se o motivo
   não estiver lá).
5. Clique em **Remarcar e salvar**.

**Dica:** mudar a duração, a equipe, o responsável ou a prioridade não exige motivo —
só mudar a data de início. A lista de remarcações fica registrada na própria ficha.

### Evolução em fotos

**Para que serve:** ver a obra andando em fotos, sem precisar ir até a loja.

Enquanto a obra está em campo, cada resposta do Diário do dia pode levar uma foto. Elas
aparecem em sequência na ficha, em **Evolução em fotos**.

1. Abra a ficha de uma obra em campo (ou já cancelada, se tinha fotos).
2. Veja as fotos dos últimos dias, na ordem em que foram tiradas.
3. Dias sem foto aparecem marcados — a falta de foto também vira tarefa, do mesmo jeito
   que faltar material ou equipe.

A foto é anexada no próprio Diário do dia (ver seção seguinte), não nesta tela.

### Cancelar uma obra

**Para que serve:** encerrar uma obra que não vai ser executada — cliente desistiu, a
Manfac não vai executar, ou a OS foi aberta por engano.

1. Na ficha da obra, no fim do bloco **Ciclo de vida da obra**, clique no botão
   **Cancelar obra**.
2. Escolha **quem cancelou**: Cancelado pelo Cliente ou Cancelado pela Manfac.
3. Se quiser, escreva o que aconteceu (opcional).
4. Clique em **Cancelar obra** para confirmar.

**Atenção:** só é possível cancelar antes de a obra sair de campo (nas etapas
"Aguardando definição", "Levantamento", "Em andamento" ou "Paralisado"). Depois disso
ela segue até ser faturada — é decisão do cliente. Cancelar não apaga nada: diário,
fotos, tarefas e histórico continuam na ficha, e dá para desfazer a qualquer momento
com o botão **Desfazer cancelamento**, que aparece no selo "Cancelada" da própria
ficha.

---

## Diário do dia

**Para que serve:** responder, todo dia, se cada obra sob sua responsabilidade andou.

Cada analista vê só as obras das quais é responsável. Administradores veem todas, com
um seletor para escolher de quem é a fila.

1. Abra a aba **Diário do dia**.
2. Para cada obra da fila, responda **Andou hoje?** (Sim ou Não).
3. Se marcar **Não**, escolha **Por que não andou?** — esse é o único campo
   obrigatório além da primeira pergunta.
4. Se quiser, marque **Faltou algum item?**, escreva uma observação e anexe a **foto do
   dia** (obras em campo).
5. Clique em **Salvar e sair da fila**.

**Dica:** errou uma resposta? Na lista **Já respondidas**, use **Desfazer** — a obra
volta para a fila do dia.

---

## Tarefas

**Para que serve:** ver quem está com a bola quando alguma coisa falta numa obra.

Ninguém cria tarefa nesta tela. Toda tarefa nasce sozinha quando um analista salva o
Diário e marca que faltou material, ferramenta, equipe, documento — ou quando a foto do
dia não veio.

1. Abra a aba **Tarefas**.
2. As tarefas aparecem agrupadas por quem precisa resolver, com a mais antiga e a
   vencida (em vermelho) primeiro.
3. Para fechar uma tarefa, clique em **Marcar como respondida**, escreva em uma linha o
   que foi resolvido e confirme.

**Atenção:** o prazo padrão é até o fim do dia em que a tarefa foi aberta. Uma tarefa
vencida fica marcada em vermelho, mas não é cobrada automaticamente por outro canal —
quem acompanha é quem abre esta tela.

---

## Sincronização com o Field

Só administrador tem acesso a esta tela.

---

## Dúvidas frequentes

**A obra que acabei de ver no Field Control não apareceu na Base.**
O sistema busca as OS do Field automaticamente, a cada poucos minutos. Espere um pouco
e atualize a página.

**Não sei em que etapa colocar a obra.**
Abra a ficha e veja a esteira em "Ciclo de vida da obra" — ela mostra a etapa atual e
o que falta para avançar. Para avançar a obra, use **Mudar a etapa desta obra**. A única
exceção: se a obra está em "Executado - pendente aprovação OS" e você preenche **OS aprovada
em** no bloco Autorização, ela passa sozinha para "Fechar OS".

**Preciso mudar a data de início e não acho um botão "remarcar".**
É o próprio campo **Início planejado**, no bloco Cronograma. Mudar essa data já abre a
janela pedindo o motivo.

**Sou responsável por obras, mas o Diário do dia aparece vazio.**
Seu usuário pode não estar ligado ao seu nome de responsável. Avise um administrador para
conferir o seu cadastro.

**Respondi errado o Diário de hoje.**
Na lista **Já respondidas**, use **Desfazer** — a obra volta para a fila para você
responder de novo.

**Cancelei uma obra por engano.**
Abra a ficha dela e clique em **Desfazer cancelamento**, no selo "Cancelada". Nada foi
apagado.
