# Revisão do PR #3: menu lateral com grupos recolhidos (manfac-facilities/fornecedores)

- Branch: `feat/menu-lateral` (commits e5f9de1 e b5617d0), comparada com `origin/main`
- Revisor independente, em modo só leitura. Data: 10/10/2026
- Especificação usada: `D:/fornecedores-work/mockup-menu-aprovado.html`. Referência visual: `components/sofia/Sidebar.tsx`
- **Limite da revisão:** a análise foi por leitura de código e do CSS gerado pelas classes. Não rodei testes nem navegador, porque a cópia não tem `node_modules` e o pedido proibia `npm install`.

## Veredito: BLOQUEADO por 1 regressão, de correção trivial

Tirando esse ponto, o PR está correto e segue o mockup.

## Bloqueante

### B1. O "Baixar PDF" do contrato passa a imprimir o menu junto com o documento
- `components/app/menu-lateral.tsx:50` (barra de topo do celular) e `:82-87` (`<aside>`)
- `components/app/app-shell.tsx:19` (padding e largura máxima saíram do `<main>` e foram para uma `<div>` interna)
- Regra de impressão afetada: `app/(modulo)/contratos/novo/_contrato.css:43-47`, importada por `contratos/[numero]/documento/page.tsx`

O CSS de impressão esconde `header, nav, .no-print` e zera o padding e o max-width de `main`. O menu antigo era um `<header>` e sumia por inteiro no papel. O novo não é `<header>`:
- **No layout de celular** (a largura de impressão de A4/Carta com margens costuma ficar abaixo de 768px): a barra de topo é uma `<div>` sem `no-print`, então o hambúrguer e o título "Gestão de Fornecedores" saem impressos no topo do contrato.
- **No layout de computador** (≥ md): o `<aside>` fica visível. Só o `<nav>` interno some; o título, o "← Voltar ao Hub", o nome da pessoa e o botão "Sair" saem numa coluna de 256px à esquerda, espremendo o documento.
- Nos dois casos, o `p-6 pb-24` e o `max-w-6xl` agora estão na `<div>` interna, então `main{padding:0;max-width:none}` deixou de ter efeito e a margem extra vai para o PDF.

O PDF é o documento do contrato, então a regressão atinge uma funcionalidade em uso.
**Correção sugerida:** acrescentar `no-print` na barra de topo, no fundo escurecido e no `<aside>`. Depois, ou devolver `p-6 pb-24 mx-auto max-w-6xl` ao `<main>`, ou incluir a `<div>` interna na regra de impressão. Antes de aprovar, conferir com Ctrl+P em `/contratos/<n>/documento`.

## Itens pedidos, conferidos

1. **A lateral fica sempre visível no computador: OK.** No Tailwind 4.3.3, as utilidades com variante (`md:visible`, `md:translate-x-0`, `md:sticky`) entram no CSS depois das utilidades sem variante, então vencem `invisible` e `-translate-x-full`. Os itens de grupo aberto recebem `visible`, e os de grupo fechado ficam `invisible`, como deveria ser. Ressalva (S1): com a gaveta fechada no celular, o `visible` explícito do grupo aberto passa por cima do `invisible` herdado do `<aside>`.
2. **Item ativo: OK.** A regra é "casa por igualdade ou pelo prefixo `href/`, e ganha o href mais longo". Resultado: `/medicoes` → Acompanhamento; `/medicoes/nova` → Nova medição; `/medicoes/aprovacao` → Fila; `/medicoes/<uuid>` → Acompanhamento; `/contratos/<n>`, `/contratos/novo` e `/contratos/<n>/editar|documento` → Contratos; `/aprovacoes/...` → Aprovações; `/medicoesx` → nenhum. **basePath:** conferi em `next@16.3.5` (`dist/client/components/app-router.js:121`) que o `usePathname` devolve o caminho **sem** `/fornecedores` (`removeBasePath`). O cálculo é o mesmo no servidor e no cliente.
3. **Hub, Sair e AppShell: OK.** "← Voltar ao Hub" continua `<a href="/dashboard">` (menu-lateral.tsx:93). "Sair" continua `<form action={signOutAction}>` (:181). O AppShell só é usado em `app/(modulo)/layout.tsx:52`, com a mesma assinatura (`nome`, `contadores`, `children`), e `ITENS_MENU` continua sendo reexportado. `/` redireciona para `/contratos`, então perder o link do título para `/` não deixa nada sem acesso. `/sem-acesso` fica fora do shell.
4. **Grupos: OK.** O estado inicial vem de `useState(() => gruposIniciais(pathname))`, que é determinístico, então não há divergência entre servidor e cliente. Ao carregar, só o grupo da página atual abre. O selo com a soma aparece só no grupo fechado e só quando a soma é maior que 0. O `useEffect` abre o grupo de destino quando a navegação vem de um link no conteúdo, o que é aceitável.
5. **Celular: OK.** Hambúrguer, ×, clique no fundo, Esc e escolha de item fecham a gaveta. A gaveta fica fora da tela à esquerda, o que não gera rolagem horizontal, e o `<main>` tem `min-w-0`. Os z-index são 30, 40 e 50, e o único diálogo das telas (`components/ui/dialogo-confirmacao.tsx`) usa `showModal()`, que abre na camada superior, acima de qualquer z-index. Não há outro elemento `fixed` ou `sticky` nas telas.
6. **Outras telas:** fora o B1, não encontrei nada que quebre.

## Sugestões (não bloqueiam)

- S1. Grupo aberto: trocar `visible` por nada (herdar), em menu-lateral.tsx:141. Hoje, com a gaveta fechada no celular, os links do grupo aberto continuam focáveis pelo Tab e lidos pelo leitor de tela, mesmo fora da tela. O teste de `\bvisible\b` precisa acompanhar a troca.
- S2. O mockup mostra o e-mail embaixo do nome no rodapé, e a implementação mostra só o nome (menu-lateral.tsx:180). Para o mockup, falta passar `sessao.email`.
- S3. Com a gaveta aberta no celular, a página de trás continua rolando. Dá para travar a rolagem do body enquanto a gaveta estiver aberta.
- S4. Ao abrir a gaveta, o foco fica no hambúrguer, que está atrás do fundo escurecido. Mover o foco para o × e devolvê-lo ao hambúrguer ao fechar.
- S5. Se a janela for redimensionada de md para celular com `gaveta=true`, a gaveta reaparece aberta. É cosmético.
