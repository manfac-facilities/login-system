# Almoxarifado — ponto de parada (18/11/2026)

O João mandou parar ("pare o projeto, vamos voltar mais tarde" / "salve o chat agora e mais tarde
eu volto para operar"). Este arquivo é o que é preciso para retomar.

## O que foi decidido hoje

1. **MANFAC 23 fica fora** por enquanto. Ele chegou a autorizar o cadastro e suspendeu antes de
   qualquer escrita; nada foi gravado. Registro: `docs/cliente/2026-11-18-almoxarifado-autorizacao-cadastro-manfac-23.md`.
2. **Lançamento = piloto com 1 equipe** quando as telas restantes estiverem no ar: testar o acesso
   do pessoal e ver o que dá problema para alterar. Equipe ainda não escolhida (sugestão minha:
   MANFAC 3 ou 6, que já têm saldo copiado).
3. **Autorizados** (`docs/cliente/2026-11-18-almoxarifado-autorizacao-bucket-e-gravacao-omie.md`):
   - criar o bucket privado `almox-arquivos` no Storage;
   - ligar `GRAVACAO_OMIE_VALIDADA` (`lib/omie/movimentos.ts` do almox) **quando o piloto começar**.
4. Decisão minha: o documento de requisição sai como **página imprimível** (igual à folha de
   separação), sem biblioteca de PDF.

## Mensagem de status ao cliente

Rascunho pronto (feito no chat de 18/11), para ser enviado pelo WhatsApp: "Almoxarifado no ar,
só admin vê; pronto: cadastro/saldos, Colaboradores, Separação, testes de transferência; falta:
MANFAC 23, Retirada com assinatura, Falhas no Omie, ligar gravação; depois teste com 1 unidade".
Ao reenviar, **tirar o item da MANFAC 23**, que foi suspenso.

## O que falta, em ordem

1. **Tela de Retirada com assinatura** (Task 19) — `app/(modulo)/pedidos/[id]/retirada`, traço em
   `<canvas>`, requisição imprimível, SQL `024_alx_bucket_arquivos.sql` no formato que
   `tests/hub-install-safety.test.ts` aceita. O código por trás já existe (`010` aplicado,
   `lib/assinaturas/*`, `lib/pedidos/retirada.ts`, `registrarRetiradaAction`).
2. **Tela Falhas no Omie** (Task 18) — as actions `listarFalhasAction`/`tentarDeNovoAction` em
   `lib/fila/actions.ts` existem; falta a tela e a entrada no menu.
3. **Bug**: diálogo de Colaboradores mostra "Ninguém com esse nome entre os ativos do RH" antes
   de digitar.
4. **Conferir** se a fila do Omie roda sozinha (job `almox-*-omie`) ou depende do SQL 004 não
   aplicado — se depender, pedir autorização ao João antes do piloto.
5. Revisão independente → aplicar o SQL do bucket → merge na `fase-1` → push → Deploy → conferir
   no navegador (Chrome "Browser 1").

Referência visual: mockup 2A validado pelo Jose em 16/11 (`docs/almox/2026-11-12-mockup-almox-rodada-2a.html`,
seção 7 Retirada; fila/`s5-falhas`).

## Estado dos agentes

Dois agentes começaram (Retirada e Falhas) e foram **parados antes de produzir qualquer coisa**:
os worktrees `C:\Users\joao-\almox-wt-retirada` (branch `retirada`) e
`C:\Users\joao-\almox-wt-falhas` (branch `falhas-omie`) existem, sem commit e sem alteração. Na
volta, pode reaproveitá-los ou removê-los (`git -C C:\Users\joao-\almox worktree remove ...`).
Nada foi aplicado no banco nem gravado no Omie hoje.

Prazo dado ao João antes da parada: telas prontas no mesmo dia, deploy no dia seguinte. Com a
parada, o prazo conta a partir da retomada.
