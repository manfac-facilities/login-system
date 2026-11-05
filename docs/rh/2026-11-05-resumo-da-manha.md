# RH: resumo da manhã (05/11/2026)

**Atualização da tarde:** o cliente respondeu às 6 perguntas. Retome por `docs/rh/2026-11-05-impacto-respostas-do-cliente.md`.
O mockup abaixo ainda não reflete as respostas.

## O que ficou pronto de madrugada

- **Pedido salvo na íntegra:** `docs/cliente/2026-11-05-rh-atividades-rh-dp.md` (com o `.docx`) e suas mensagens em
  `docs/cliente/2026-11-05-rh-direcao-do-joao.md`.
- **Levantamento:** o que o RH tem hoje (`descoberta-estado-atual-2026-11-05.md`) e como ele se liga aos outros sistemas
  (`descoberta-integracoes-2026-11-05.md`).
- **Proposta de fases e decisões:** `2026-11-05-proposta-fases-e-decisoes.md`, já corrigida depois da revisão independente
  (`revisao-proposta-2026-11-05.md`).
- **Mockup interativo, com dados fictícios:** https://claude.ai/artifact/9v9QS6z3F7sveGy992sCZL

Não houve código de produto, migration nem escrita em produção. A única consulta ao banco foi de leitura: estrutura e
contagens, sem dado de pessoa.

## O que mudou no caminho

**A folha não cabe no Financeiro como eu pensei.** Uma solicitação paga um favorecido só, e a folha paga várias pessoas. A
revisão pegou isso e eu conferi no código. VR, VT, seguro e celular (boleto de um fornecedor) cabem como estão. **A folha
depende de sabermos como o dinheiro sai hoje**, por isso a primeira pergunta ao cliente é essa.

**Regra de obra obrigatória.** O Financeiro trava a validação de centro de custo com OBRAS ou SPOT no nome, se a categoria
não estiver na lista de fixas. VR e seguro estão; folha CLT, VT, ajuda de custo e celular não. O José precisa incluir essas
categorias antes da fase 2, ou o custo de pessoal corre o risco de cair na obra errada.

## Ordem sugerida para a manhã

1. **Mandar as 6 perguntas ao cliente.** Estão prontas para colar na proposta. É a resposta da pergunta 1 que destrava a folha.
2. **Julgar o mockup,** por seção (lista abaixo).
3. **Tomar as 8 decisões da proposta.** As que mais moldam o trabalho: 2 (valor da folha), 3 (PJ), 5 (repositórios) e 7 (quem
   autoriza mexer no Financeiro). A 1 depende da resposta do cliente.

Com o mockup aprovado e as decisões tomadas, sigo para spec, plano e código.

## O que julgar no mockup

| Seção | Pergunta | O que a resposta muda |
|---|---|---|
| 1. Mapa | A divisão e a ordem das fases estão certas? | A ordem de todo o projeto |
| 2. Competência | O painel de um cartão por pagamento é como vocês pensam o mês? | A estrutura central da fase 2 |
| 3. VR/VA | O caminho quem entra > boleto > rateio > Financeiro reflete o trabalho real? | O modelo que os outros boletos repetem |
| 3.1 | Marcar à mão quem fica de fora serve até existir controle de férias? | Se o controle de férias precisa vir antes |
| 3.2 | O boleto mandar no total, com bloqueio acima de uma tolerância, é o certo? | A regra de dinheiro, e o valor da tolerância (R$ 10,00 é inventado) |
| 4. Folha | A conferência por pessoa pega as divergências que importam? | O que bloqueia e o que só avisa |
| 4.5 | Qual dos 4 caminhos faz sentido? | A decisão 1, depois da resposta do cliente |
| 5. Ficha | Falta ou sobra algum campo? | Schema da fase 2 |
| 6. Suposições | Alguma está errada? | O que precisa ser redesenhado |

Para testar, use "Ver como" no topo (RH, Diretoria, Sem papel) e "Demonstrar estado da tela" em cada tela. O botão
"Reiniciar demonstração" volta tudo ao início.

**Pode ignorar:** cor, tipografia e espaçamento fino. Usei os tokens do hub, sem proposta visual. Valores e nomes são de exemplo.

## O que eu mesmo reprovaria

- **VT, seguro e celular** só mostram o resultado num diálogo, sem passo a passo. Decisão minha: repetem o VR, e a rodada ficou menor.
- **Faltam desenhar:** falha no envio ao Financeiro e férias que pegam só parte do mês.
- **Colaborador ausente do arquivo** só se resolve informando o valor. Falta a saída "não deveria receber neste mês".
- **Colaborador sem salário bloqueia a folha,** mesmo com valor vindo do arquivo. Pode ser mais rígido do que vocês querem.
- **Reabrir e cancelar supõem uma porta que não existe:** hoje outro sistema não cancela solicitação no Financeiro.

## Antes de mandar o mockup ao cliente

- **O link é privado.** O cliente só abre depois que você compartilhar pelo menu Share da página.
- **A palavra "Desligamento" aparece** no campo vazio da ficha (que já existe no sistema) e no nome da área 11 do Mapa (do
  documento do cliente). Nenhuma pessoa de exemplo aparece saindo. Como a regra é nunca citar saída de alguém, deixei para
  você decidir se fica.

## O que testei e o que não testei

**Testado por mim no navegador,** depois do agente que construiu: estados Carregando, Vazio e Erro nas 4 telas de dados;
cancelar envio; reabertura bloqueada de pagamento pago; devolvida e nova revisão; bloqueio de centro de custo inativo; soma do
rateio fechando no centavo; o Financeiro sem nome de pessoa; papéis Diretoria e Sem papel.

**Testado só pelo agente que construiu:** largura de celular (385 px, sem rolagem horizontal da página).

**Não verificado:** como a folha e o VR entram hoje no Omie; se a regularização serve à folha; quantos centros de custo há no
rateio real (limite de 20 por solicitação); categorias de pessoal no Omie; se o RH publicado é a `main`; build e testes do RH.

## Outros pontos que encontrei

- **O PC estava no limite:** 0,8 GB de RAM livre e disco C com 96% de uso.
- **4 atualizações de dependência abertas no repositório do RH** (PRs #2 a #5), incluindo `next` 16.3.8 → 16.4.1. Não mexi.
- **Commits locais sem push no `master` do hub:** os meus desta frente e 4 anteriores de outras sessões (a partir de `9a9fbfb`).
  Não fiz push, para não publicar o trabalho de outra sessão sem você saber.
