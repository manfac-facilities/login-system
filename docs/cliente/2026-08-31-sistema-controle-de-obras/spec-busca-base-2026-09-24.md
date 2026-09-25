# Spec — busca por loja ou OS na Base de obras — 24/09/2026

**Pedido (literal):** `docs/cliente/2026-09-24-pedido-busca-loja-base.md`.
**Mockup:** `mockup-busca-base-2026-09-24.html`, publicado em
https://claude.ai/artifact/AsLcotZL7wZ7g2xvxhV8S4 (versão 2, com o filtro de etapa completo).
**Aprovação do João, 24/09 (literal):** "busca aprovada, pode codar".

## O que muda

1. Campo de texto **"Buscar loja ou OS"** na barra de filtros da Base, acima dos cinco selects,
   ocupando a largura toda. Placeholder: `Ex.: DP Ipanema 3, 0926-010550`. Botão "×" para limpar
   quando houver texto.
2. A busca procura o texto como **trecho contido** em `loja`, `os` e `descricao`, ignorando
   maiúscula/minúscula e acento ("praca do o" acha "DP PRAÇA DO Ó"). Espaços nas pontas não contam.
   Texto vazio = sem busca.
3. **Soma com os outros filtros** (é mais um critério de `filtrar`). Vale para Tabela e Kanban,
   que já usam a mesma lista.
4. **Canceladas não mudam de regra:** "Todas" continua escondendo canceladas. O aviso existente
   "N obra(s) cancelada(s) fora desta lista · ver canceladas" já respeita a busca, porque
   `canceladasFora` reaproveita `filtrar` com os outros filtros. Buscar "TESTE D5" com etapa
   "Todas" mostra o aviso com 1.
5. **Vazio com busca:** quando a lista zera e há texto buscado, o estado vazio diz
   `Nenhuma obra com "<texto>" na loja, no Nº da OS ou na descrição.` e oferece o botão
   "Limpar busca". Sem texto buscado, o vazio atual fica como está.

## Fora do escopo (declarado)

- Realce (marca-texto) do trecho encontrado nas células da tabela, que aparecia no mockup: fica
  de fora nesta rodada para caber no prazo; é só visual.
- Guardar a busca na URL ou entre visitas.
- Sem mudança de banco.

## Critério de pronto

- Testes em `app/obras/__tests__/base.test.ts` cobrindo: loja, OS, descrição, acento/maiúscula,
  soma com outro filtro, cancelada fora de "Todas" mas contada em `canceladasFora`.
- Teste de componente (`app/obras/base/__tests__/_visao.test.tsx`) cobrindo o vazio com busca e o
  "Limpar busca".
- `npm test` (as suites do hub), `npm run lint` e `npm run build` limpos.
