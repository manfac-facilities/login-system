# Brief — mockup "Diário do dia liberado para todos" (27/10/2026)

Pedido do cliente (fonte, literal): `docs/cliente/2026-10-27-obras-diario-liberar-para-todos.md`.

## O que muda (decisões já tomadas — não reabrir)

1. **Quem vê o diário:** qualquer pessoa com acesso a Gestão de Obras (não só o responsável da obra
   nem só o administrador). Hoje o não-admin só vê obras em que ele é o `pcm`; quem não é `pcm` de
   nada cai na tela "Esta tela é de quem é responsável pelas obras" — é o que acontece com o rapaz
   que agora cuida do diário.
2. **Filtro por responsável para todo mundo** (hoje só o admin tem o seletor). Padrão:
   - quem é responsável de alguma obra abre vendo **as suas** (igual hoje), e pode trocar para
     "Todos os responsáveis" ou para outro responsável;
   - quem não é responsável de nenhuma (o rapaz do diário) abre em **"Todos os responsáveis"**.
3. **Rótulo de autoria no cartão já respondido:**
   - respondeu o próprio responsável → "Respondido por Yuri às 09:14" (como já é, só com o nome);
   - respondeu outra pessoa → **"Respondido por Marcos em nome de Yuri às 09:14"** — Marcos é quem
     clicou, Yuri é o responsável da obra.
   - Se a resposta foi corrigida por outra pessoa depois, vale o nome de quem salvou por último.
4. **Tela "sem permissão"** passa a ser só para quem não tem acesso ao módulo (texto novo, sem citar
   "responsável").

## Onde olhar antes de desenhar

- Tela real de hoje: `app/obras/diario/page.tsx`, `_cartoes.tsx`, `_cartao.tsx`. Reproduza a
  estrutura, os textos e os estados reais dela — o mockup mostra **a tela atual com a mudança**, não
  uma tela nova.
- Mockup aprovado do módulo (estilo e componentes): `docs/cliente/2026-08-31-sistema-controle-de-obras/mockup-01-v05-BACKUP-aprovado.html`
  (seção do diário). Copie dele a linguagem visual.
- Se a ficha da obra (`app/obras/obra/[id]/_historico.tsx` ou equivalente) mostra respostas do
  diário com autor, mostre lá também o "em nome de". Se não mostra autor hoje, não invente — anote.

## Visual

Tokens do hub: fundo `#0a1628`, navy `#0d2050`, laranja `#f05a28`, texto secundário `#94a3b8`,
bordas `#1e3a5f`. Nada de paleta nova.

## Interatividade obrigatória (arquivo HTML único, autocontido)

- **Alternador de "quem está logado"** no topo do mockup (fora da tela, como controle de demo):
  "Yuri (responsável)", "Marcos (cuida do diário, não é responsável)", "Admin", "Pessoa sem acesso
  ao módulo". Trocar reconfigura a tela: filtro padrão, obras listadas, tela sem permissão.
- Seletor de responsável funcionando (filtra os cartões).
- Responder um cartão como Marcos numa obra do Yuri e ver o rótulo "Respondido por Marcos em nome de
  Yuri às HH:MM" aparecer. Responder como Yuri e ver "Respondido por Yuri".
- Estados: com dados · **vazio** (nenhuma obra em campo para o filtro escolhido) · **erro de
  carregamento** (use o texto real do `Erro()` de `page.tsx`) · sem permissão. Vazio e erro
  visivelmente diferentes. Botões de demo para forçar vazio/erro.
- Dados plausíveis: obras de drogaria/loja (padrão das obras reais — veja nomes no mockup v05),
  responsáveis Yuri, Amanda, Luana.
- Mobile: a tela é usada no celular. Precisa funcionar a 375px.

## O que NÃO pôr

- **Sem campos de comentário/aprovação na página** — o feedback vem pelo WhatsApp, por seção.
  Numere as seções (1, 2, 3…) com título claro para o cliente citar.
- Nunca mencionar demissão ou saída de alguém.
- Não mudar perguntas, motivos ou tarefas do cartão: só quem vê e o rótulo de autoria.

## Entrega

Salve em `docs/cliente/2026-08-31-sistema-controle-de-obras/mockup-diario-para-todos-2026-10-27.html`.
**Não publique** (a sessão principal publica). Não faça commit. Responda com: o caminho, a lista de
seções, e qualquer coisa da tela real que você não conseguiu reproduzir ou que achou contraditória.
