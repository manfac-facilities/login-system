# Gestão de Frotas — Identidade & Navegação

**Data:** 2026-06-23
**Status:** Aprovado

---

## Contexto

O cliente aprovou o sistema de operação de frota (até então chamado "Sofia" internamente), mas levantou ressalvas de usabilidade. Esta spec cobre a primeira frente: identidade visual e navegação. As demais frentes (Multas + módulo de Descontos, Checklist, exclusão com auditoria) têm specs próprias.

Esta é uma mudança de **exibição apenas** — rotas (`/sofia/*`), nomes de pasta (`components/sofia`, `lib/sofia`) e identificadores internos (`SofiaPage`) não mudam. Decisão tomada para minimizar risco no prazo de hoje: zero impacto em links/bookmarks existentes.

---

## 1. Nome do sistema

"Sofia" → **"Gestão de Frotas"**, abreviado **"GF"** onde o nome completo não cabe.

| Local | Hoje | Depois |
|---|---|---|
| `app/(dashboard)/dashboard/page.tsx:54` | "Sistema Sofia" | "Gestão de Frotas" (subtítulo inalterado) |
| `components/sofia/Sidebar.tsx:92` (header do menu desktop) | "Sofia" | "Gestão de Frotas" |
| `components/sofia/Sidebar.tsx:67` (topo mobile, compacto) | "Sofia" | "GF" |

## 2. Logo legível em fundo navy

O logo atual (`/logo.png`) é navy sobre fundo navy no header do Hub — ilegível. Já existe `/logo-white.png` (elementos navy convertidos para branco, "engenharia" continua laranja).

- `components/ui/Logo.tsx`: nova prop `variant?: 'navy' | 'white'`, default `'navy'` (comportamento atual preservado em todas as telas de auth, que têm fundo claro)
- `app/(dashboard)/dashboard/page.tsx`: passa a usar `<Logo size="sm" variant="white" />` — único local com fundo navy que renderiza `<Logo>`

## 3. Navegação "Voltar ao Hub"

Hoje, dentro do módulo de frotas não existe forma de voltar ao Hub sem usar o botão "voltar" do navegador.

- `components/sofia/Sidebar.tsx`: adicionar link **"← Voltar ao Hub"** (`href="/dashboard"`), posicionado imediatamente abaixo do título, tanto na barra mobile quanto no header do menu desktop

## 4. Bug: contadores de CNH na tela de Motoristas

Achado durante a investigação desta frente (mesma área de código, mesmo tema de usabilidade que o cliente reportou: *"CNH não é VENCIDA, é VENCE EM 30 DIAS"*).

**Causa:** em `lib/sofia/motoristas.ts`, `classificarCnh` agrupa "já venceu" e "vence em até 30 dias" na mesma categoria `'vencidas'`. Isso propaga dois problemas em `app/(operacoes)/sofia/motoristas/page.tsx`:
- Card **"CNHs Vencidas"** (`sub="Ação imediata necessária"`) conta motoristas cuja CNH ainda é válida
- Card **"Vencem em 30 dias"** está, por causa do mesmo bug, ligado à variável `atencao` — que na verdade representa a janela de 31-60 dias, não 0-30

**Correção:** `ClasseCnh` passa de `'sem_cnh' | 'vencidas' | 'atencao' | 'regulares'` para `'sem_cnh' | 'vencidas' | 'urgente' | 'atencao' | 'regulares'`:

| Categoria | Faixa |
|---|---|
| `vencidas` | dias < 0 (já venceu) |
| `urgente` | 0 ≤ dias ≤ 30 |
| `atencao` | 31 ≤ dias ≤ 60 |
| `regulares` | dias > 60 |

- Card "CNHs Vencidas" passa a usar a contagem de `vencidas` (agora correta — só quem já venceu)
- Card "Vencem em 30 dias" passa a usar a contagem de `urgente` (em vez de `atencao`)
- Filtro de pills da listagem ganha a opção "Vence em 30 dias" (`urgente`), mantendo "Atenção" (`atencao`, 31-60) como categoria própria — nada do que já existe é removido, só fica correto
- `cnhStatus` (rótulo por linha — "VENCIDA" / "Vence em Xd") não muda, já estava correto
- Teste `lib/sofia/__tests__/motoristas.test.ts:14` ("classifies a date within 30 days as vencidas (urgent)") é reescrito para refletir a nova categoria `urgente`

---

## Fora de escopo (combinado com o usuário)

- Criação do subdomínio `hub.manfac.com.br` — fica para a etapa de domínios, depois desta frente
- Renomear rotas/pastas/identificadores internos de `sofia` para algo alinhado a "Gestão de Frotas"
- Logo dentro do `Sidebar.tsx` do módulo de frotas (cliente reportou apenas o logo do Hub)

---

## Testes

- `lib/sofia/__tests__/motoristas.test.ts`: atualizar caso de 0-30 dias para esperar `'urgente'`, adicionar caso cobrindo a nova faixa
- Sem testes automatizados para os componentes visuais (Sidebar, Logo, dashboard) — verificação manual no navegador (responsivo mobile/desktop) antes do deploy
