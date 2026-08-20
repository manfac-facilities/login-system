# Manfac Site v04 — Frente A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplicar no `manfac-site` os 7 ajustes de interação e polimento aprovados no mockup — header flutuante, sublinhado animado, halo pulsante, botão de WhatsApp fixo, CTAs indo direto pro WhatsApp, rodapé expandido e scroll suave.

**Architecture:** Tudo frontend, nenhum acesso a banco. Header e Footer hoje são montados **página a página** (cada `page.tsx` importa os dois), então os elementos globais novos — botão flutuante e provider do Lenis — entram no `app/layout.tsx`, que é Server Component e precisa de wrappers `'use client'`. As animações são CSS puro em `globals.css`, controladas por classe, para não pagar custo de JS.

**Tech Stack:** Next 16.2.9 (custom), React 19.2.4, Tailwind v4, TypeScript, Vitest + Testing Library, `lenis@1.3.26` (dependência nova).

## Global Constraints

- **Este Next não é o Next padrão.** Ler o guia relevante em `node_modules/next/dist/docs/` antes de escrever código que toque em layout, fontes, metadata ou Client Components.
- **Quirk conhecido:** este Next descarta o espaço entre tag de fechamento e texto seguinte (`</strong> texto` vira `</strong>texto`). Usar `{' '}` explícito.
- Node 20 (`.nvmrc`). Idioma de toda a copy: **português do Brasil**.
- Paleta só via tokens de `app/globals.css`: `--ink #00345e`, `--orange #f85e0b`, `--orange-hover #d6520a`, `--muted #6e8894`, `--border #dadad8`, `--surface #f6f6f5`, `--background #ffffff`.
- Testes em `__tests__/` ao lado do código que testam.
- **`prefers-reduced-motion: reduce` desliga toda animação nova.** Sem exceção.
- ~~Flake do Vitest no Windows~~ **RESOLVIDO em 20/08 (commit `ef6ebee`).** A causa era o ambiente rodar Node 24 enquanto o `.nvmrc` pede Node 20; o pool de workers do Vitest 4 estoura nessa combinação. Corrigido em `vitest.config.mts` com thread única, então `npm test` funciona puro — **não passar mais flags de pool na linha de comando.**
- Copy dos CTAs: **"Solicitar atendimento"** (substitui "Falar com especialista").
- Número do WhatsApp: `WHATSAPP_COMERCIAL` em `lib/whatsapp.ts` = `5521984280058`. Nunca hardcodar.

## File Structure

| Arquivo | Responsabilidade | Ação |
|---|---|---|
| `lib/whatsapp.ts` | número + montagem de URL; ganha `buildDirectWhatsAppUrl` | Modificar |
| `components/WhatsAppIcon.tsx` | ícone SVG do WhatsApp, reusado em 4 lugares | Criar |
| `components/WhatsAppFloat.tsx` | botão flutuante fixo | Criar |
| `components/SmoothScroll.tsx` | provider do Lenis, `'use client'` | Criar |
| `components/Header.tsx` | pílula flutuante + sublinhado no hover + copy | Modificar |
| `components/Hero.tsx` | copy + destino + ícone do CTA | Modificar |
| `components/ServicePage.tsx` | destino + ícone do CTA | Modificar |
| `components/Footer.tsx` | 4 colunas | Modificar |
| `app/layout.tsx` | monta `SmoothScroll` e `WhatsAppFloat` | Modificar |
| `app/globals.css` | halo pulsante, remoção do `scroll-behavior` | Modificar |

**Ordem das tasks:** valor primeiro, risco por último. A Task 1 sozinha já melhora conversão. O Lenis (Task 6) é a única dependência nova e a única coisa capaz de quebrar o scroll do site inteiro — fica no fim, onde é barato desistir dele sem perder o resto.

---

### Task 1: CTAs indo direto pro WhatsApp

**Files:**
- Modify: `manfac-site/lib/whatsapp.ts`
- Create: `manfac-site/components/WhatsAppIcon.tsx`
- Modify: `manfac-site/components/Header.tsx:105-109`
- Modify: `manfac-site/components/Hero.tsx:41-45`
- Modify: `manfac-site/components/ServicePage.tsx:40-44`
- Test: `manfac-site/lib/__tests__/whatsapp.test.ts`

**Interfaces:**
- Consumes: `WHATSAPP_COMERCIAL` (já existe em `lib/whatsapp.ts`)
- Produces:
  - `buildDirectWhatsAppUrl(origem: string): string` — URL do `wa.me` com mensagem citando a origem
  - `WhatsAppIcon` — componente default de `components/WhatsAppIcon.tsx`, props `{ size?: number; className?: string }`, default `size = 17`

- [ ] **Step 1: Escrever o teste que falha**

Adicionar ao fim de `manfac-site/lib/__tests__/whatsapp.test.ts`:

```ts
import { buildDirectWhatsAppUrl } from '../whatsapp'

describe('buildDirectWhatsAppUrl', () => {
  it('monta URL wa.me com o número comercial', () => {
    const url = buildDirectWhatsAppUrl('Home')
    expect(url.startsWith(`https://wa.me/${WHATSAPP_COMERCIAL}?text=`)).toBe(true)
  })

  it('cita a origem na mensagem', () => {
    const url = buildDirectWhatsAppUrl('Manutenção Predial')
    expect(decodeURIComponent(url)).toContain('Manutenção Predial')
  })

  it('URL-encoda a mensagem', () => {
    const url = buildDirectWhatsAppUrl('Obras e Reformas')
    expect(url).not.toContain(' ')
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `cd manfac-site && npx vitest run --pool=threads --no-file-parallelism lib/__tests__/whatsapp.test.ts`
Expected: FAIL — `buildDirectWhatsAppUrl is not a function`

- [ ] **Step 3: Implementar a função**

Adicionar ao fim de `manfac-site/lib/whatsapp.ts`:

```ts
export function buildDirectWhatsAppUrl(origem: string): string {
  const texto = `Olá! Vim pelo site da Manfac (${origem}) e gostaria de solicitar atendimento.`
  return `https://wa.me/${WHATSAPP_COMERCIAL}?text=${encodeURIComponent(texto)}`
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `cd manfac-site && npx vitest run --pool=threads --no-file-parallelism lib/__tests__/whatsapp.test.ts`
Expected: PASS — 8 testes (5 antigos + 3 novos)

- [ ] **Step 5: Criar o ícone**

Criar `manfac-site/components/WhatsAppIcon.tsx`:

```tsx
export default function WhatsAppIcon({
  size = 17,
  className = '',
}: {
  size?: number
  className?: string
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 004.79 1.22c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2m0 18.15c-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 01-1.26-4.38c0-4.54 3.7-8.23 8.25-8.23 4.54 0 8.23 3.69 8.23 8.23 0 4.54-3.69 8.24-8.23 8.24m4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.78.97-.14.16-.29.18-.54.06-.25-.13-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.24-.01-.38.11-.5.11-.11.25-.29.37-.43.13-.15.17-.25.25-.41.08-.17.04-.31-.02-.44-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.42-.14 0-.3-.02-.47-.02-.16 0-.43.06-.66.31-.22.24-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.47-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.1-.22-.16-.47-.28" />
    </svg>
  )
}
```

- [ ] **Step 6: Trocar o CTA do Header**

Em `manfac-site/components/Header.tsx`, adicionar os imports no topo:

```tsx
import WhatsAppIcon from './WhatsAppIcon'
import { buildDirectWhatsAppUrl } from '@/lib/whatsapp'
```

Substituir o bloco `<Link href="/contato" className="hidden rounded-md ...">Falar com especialista</Link>` por:

```tsx
<a
  href={buildDirectWhatsAppUrl('Menu')}
  target="_blank"
  rel="noopener noreferrer"
  className="hidden items-center gap-2 rounded-full bg-[var(--orange)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--orange-hover)] md:inline-flex"
>
  <WhatsAppIcon size={16} />
  Solicitar atendimento
</a>
```

> Vira `<a>` e não `<Link>` porque o destino é externo. `rounded-md` vira `rounded-full` para casar com a pílula do header (Task 3).

- [ ] **Step 7: Trocar o CTA do Hero**

Em `manfac-site/components/Hero.tsx`, adicionar os mesmos dois imports e substituir o `<Link href="/contato">Falar com especialista</Link>` pelo equivalente, mantendo as classes de tamanho que já estão lá e acrescentando `inline-flex items-center gap-2`:

```tsx
<a
  href={buildDirectWhatsAppUrl('Home')}
  target="_blank"
  rel="noopener noreferrer"
  className="inline-flex items-center gap-2 rounded-full bg-[var(--orange)] px-6 py-3 font-medium text-white transition-colors hover:bg-[var(--orange-hover)]"
>
  <WhatsAppIcon />
  Solicitar atendimento
</a>
```

- [ ] **Step 8: Trocar o CTA do ServicePage**

Em `manfac-site/components/ServicePage.tsx`, mesma troca. **A copy aqui continua "Solicitar proposta técnica"** — decisão do João de manter a distinção nas páginas de serviço. Só o destino e o ícone mudam. A origem passa o nome do serviço:

```tsx
<a
  href={buildDirectWhatsAppUrl(servico.title)}
  target="_blank"
  rel="noopener noreferrer"
  className="inline-flex items-center gap-2 rounded-full bg-[var(--orange)] px-6 py-3 font-medium text-white transition-colors hover:bg-[var(--orange-hover)]"
>
  <WhatsAppIcon />
  Solicitar proposta técnica
</a>
```

> Conferir o nome real da variável do serviço no escopo do componente antes de usar `servico.title` — o arquivo pode chamá-la de outra coisa.

- [ ] **Step 9: Rodar build e testes**

Run: `cd manfac-site && npx tsc --noEmit && npm run build`
Expected: sem erros de tipo, build limpo

Run: `cd manfac-site && npx vitest run --pool=threads --no-file-parallelism`
Expected: todos os arquivos passando

- [ ] **Step 10: Commit**

```bash
git add manfac-site/lib/whatsapp.ts manfac-site/lib/__tests__/whatsapp.test.ts manfac-site/components/WhatsAppIcon.tsx manfac-site/components/Header.tsx manfac-site/components/Hero.tsx manfac-site/components/ServicePage.tsx
git commit -m "feat(manfac-site): CTAs vao direto pro WhatsApp com icone e copy nova"
```

---

### Task 2: Halo pulsante nos botões

**Files:**
- Modify: `manfac-site/app/globals.css`

**Interfaces:**
- Consumes: nada
- Produces: classe `.btn-pump`, aplicável a qualquer CTA primário

Sem teste unitário: animação CSS não é verificável de forma útil em jsdom. A verificação é visual, no Step 3.

- [ ] **Step 1: Adicionar o halo ao globals.css**

Adicionar ao fim de `manfac-site/app/globals.css`, antes do bloco `@media (prefers-reduced-motion: reduce)` que já existe:

```css
.btn-pump {
  animation: btn-pump 2.6s ease-in-out 0.6s infinite;
}

@keyframes btn-pump {
  0%, 100% {
    box-shadow: 0 0 11px 0px rgba(255, 150, 90, 0.49),
                0 0 20px 0px rgba(255, 150, 90, 0.20),
                0 4px 12px rgba(0, 0, 0, 0.12);
  }
  45% {
    box-shadow: 0 0 27px 12px rgba(255, 175, 120, 0.56),
                0 0 60px 24px rgba(248, 94, 11, 0.15),
                0 4px 12px rgba(0, 0, 0, 0.12);
  }
}

.btn-pump:hover {
  animation: none;
  box-shadow: 0 0 22px 4px rgba(255, 180, 130, 0.66),
              0 0 45px 10px rgba(248, 94, 11, 0.25),
              0 4px 12px rgba(0, 0, 0, 0.12);
}
```

**Três detalhes que fazem o efeito funcionar — não "simplificar" nenhum:**
1. O `spread` volta a **zero** no repouso. É o contraste entre encolher até colar no botão e disparar pra fora que o olho lê como pump.
2. Deslocamento vertical **zero** e blur muito maior que ele. É o que faz virar brilho em vez de sombra.
3. `animation: none` no hover. Sem isso o keyframe sobrescreve o `box-shadow` do hover e o botão parece não responder ao mouse.

- [ ] **Step 2: Estender o bloco de reduced-motion**

Dentro do `@media (prefers-reduced-motion: reduce)` já existente em `globals.css`, acrescentar:

```css
  .btn-pump { animation: none; }
```

- [ ] **Step 3: Aplicar a classe e verificar visualmente**

Acrescentar `btn-pump` ao `className` dos três CTAs primários alterados na Task 1 (Header, Hero, ServicePage).

Run: `cd manfac-site && npm run dev`
Abrir `http://localhost:3000` e confirmar: o halo laranja contrai e expande a cada 2,6s; ao passar o mouse ele congela e assume o brilho forte.

**Não aplicar** nos botões secundários (os com borda, tipo "Ver resultados") — se todos brilharem, nenhum é prioridade.

- [ ] **Step 4: Commit**

```bash
git add manfac-site/app/globals.css manfac-site/components/Header.tsx manfac-site/components/Hero.tsx manfac-site/components/ServicePage.tsx
git commit -m "feat(manfac-site): halo pulsante nos CTAs primarios"
```

---

### Task 3: Header flutuante e sublinhado animado

**Files:**
- Modify: `manfac-site/components/Header.tsx:23-25` (wrapper) e o bloco do `<nav>`
- Test: `manfac-site/components/__tests__/Header.test.tsx` (criar)

**Interfaces:**
- Consumes: `NAV_ITEMS` de `@/lib/content`, `isNavActive` de `@/lib/nav` (ambos já existem)
- Produces: nada consumido por outras tasks

- [ ] **Step 1: Escrever o teste que falha**

Criar `manfac-site/components/__tests__/Header.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import Header from '../Header'

vi.mock('next/navigation', () => ({ usePathname: () => '/' }))

describe('Header', () => {
  it('renderiza os 5 itens de navegação', () => {
    render(<Header />)
    ;['Início', 'Quem somos', 'Serviços', 'Resultados', 'Contato'].forEach((label) => {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0)
    })
  })

  it('marca a rota ativa', () => {
    render(<Header />)
    const inicio = screen.getAllByText('Início')[0].closest('a')
    expect(inicio?.className).toContain('text-[var(--ink)]')
  })

  it('o CTA aponta para o WhatsApp', () => {
    render(<Header />)
    const cta = screen.getByText('Solicitar atendimento').closest('a')
    expect(cta?.getAttribute('href')).toContain('wa.me')
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd manfac-site && npx vitest run --pool=threads --no-file-parallelism components/__tests__/Header.test.tsx`
Expected: FAIL na terceira asserção se a Task 1 não estiver feita; se estiver, as três passam e só falta o visual.

- [ ] **Step 3: Trocar o wrapper por pílula flutuante**

Em `manfac-site/components/Header.tsx`, adicionar `useEffect` ao import do React e um estado de scroll:

```tsx
const [scrolled, setScrolled] = useState(false)

useEffect(() => {
  const onScroll = () => setScrolled(window.scrollY > 20)
  onScroll()
  window.addEventListener('scroll', onScroll, { passive: true })
  return () => window.removeEventListener('scroll', onScroll)
}, [])
```

Substituir o `<header className="sticky top-0 z-50 border-b ...">` e a `<div className="mx-auto flex max-w-6xl ...">` por:

```tsx
<header
  className={`fixed inset-x-0 top-0 z-50 transition-[padding] duration-300 ${
    scrolled ? 'px-5 py-2' : 'px-5 py-4'
  }`}
>
  <div
    className={`mx-auto flex max-w-6xl items-center justify-between gap-5 rounded-full border border-[var(--border)]/75 bg-white/70 py-2.5 pl-5 pr-3 backdrop-blur-[10px] transition-shadow duration-300 ${
      scrolled ? 'shadow-lg shadow-[var(--ink)]/15' : 'shadow-sm'
    }`}
  >
```

> `bg-white/70` é a opacidade aprovada. **Não usar `/95`** — a 95% não há o que borrar e o `backdrop-blur` não aparece. E **não copiar o `0.30` do sblok**: aquele site é escuro, este é claro; a 30% o texto do menu fica ilegível sobre fotos claras.

O header vira `fixed`, então acrescentar `pt-24` (ou o padding equivalente) ao primeiro bloco de cada página, senão o conteúdo entra por baixo dele. Conferir página a página.

- [ ] **Step 4: Adicionar o sublinhado animado**

No `<nav>`, em cada `<Link>` de item, trocar o `{active && <span className="absolute -bottom-1 ..." />}` por um `<span>` sempre presente que anima por CSS:

```tsx
<span
  className={`absolute -bottom-1 left-0 h-0.5 w-full origin-left bg-[var(--orange)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
    active ? 'scale-x-100' : 'scale-x-0 group-hover/nav:scale-x-100'
  }`}
/>
```

E acrescentar `group/nav` ao `className` do `<Link>` que o contém. Fazer isso **nos dois casos**: no item de Serviços (que tem dropdown) e no `return` genérico dos demais itens.

- [ ] **Step 5: Rodar testes e build**

Run: `cd manfac-site && npx vitest run --pool=threads --no-file-parallelism components/__tests__/Header.test.tsx`
Expected: PASS, 3 testes

Run: `cd manfac-site && npx tsc --noEmit && npm run build`
Expected: limpo

- [ ] **Step 6: Verificar visualmente**

Run: `cd manfac-site && npm run dev`
Confirmar: pílula flutuante com vidro; ao rolar ela contrai e ganha sombra; ao passar o mouse nos itens o traço laranja cresce da esquerda; o dropdown de Serviços continua abrindo; o menu mobile continua funcionando.

- [ ] **Step 7: Commit**

```bash
git add manfac-site/components/Header.tsx manfac-site/components/__tests__/Header.test.tsx manfac-site/app
git commit -m "feat(manfac-site): header flutuante arredondado com sublinhado animado"
```

---

### Task 4: Botão flutuante de WhatsApp

**Files:**
- Create: `manfac-site/components/WhatsAppFloat.tsx`
- Modify: `manfac-site/app/layout.tsx`
- Modify: `manfac-site/app/globals.css`
- Test: `manfac-site/components/__tests__/WhatsAppFloat.test.tsx` (criar)

**Interfaces:**
- Consumes: `buildDirectWhatsAppUrl` (Task 1), `WhatsAppIcon` (Task 1)
- Produces: `WhatsAppFloat` — componente default, sem props

- [ ] **Step 1: Escrever o teste que falha**

Criar `manfac-site/components/__tests__/WhatsAppFloat.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import WhatsAppFloat from '../WhatsAppFloat'

describe('WhatsAppFloat', () => {
  it('aponta para o wa.me com o número comercial', () => {
    render(<WhatsAppFloat />)
    const link = screen.getByRole('link', { name: /whatsapp/i })
    expect(link.getAttribute('href')).toContain('wa.me/5521984280058')
  })

  it('abre em nova aba com rel seguro', () => {
    render(<WhatsAppFloat />)
    const link = screen.getByRole('link', { name: /whatsapp/i })
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toContain('noopener')
  })

  it('está visível desde o carregamento, sem depender de scroll', () => {
    render(<WhatsAppFloat />)
    const link = screen.getByRole('link', { name: /whatsapp/i })
    expect(link.className).not.toContain('opacity-0')
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd manfac-site && npx vitest run --pool=threads --no-file-parallelism components/__tests__/WhatsAppFloat.test.tsx`
Expected: FAIL — módulo não encontrado

- [ ] **Step 3: Criar o componente**

Criar `manfac-site/components/WhatsAppFloat.tsx`:

```tsx
import WhatsAppIcon from './WhatsAppIcon'
import { buildDirectWhatsAppUrl } from '@/lib/whatsapp'

export default function WhatsAppFloat() {
  return (
    <a
      href={buildDirectWhatsAppUrl('Botão flutuante')}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Falar no WhatsApp"
      className="wa-float group fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center overflow-hidden rounded-full bg-[#25d366] text-white transition-[width] duration-300 hover:w-[186px]"
    >
      <span className="grid h-14 w-14 flex-none place-items-center">
        <WhatsAppIcon size={26} />
      </span>
      <span className="whitespace-nowrap pr-5 text-sm font-semibold opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        Falar no WhatsApp
      </span>
    </a>
  )
}
```

> Sem `'use client'` — é link estático, não tem estado nem efeito. **Não** adicionar limiar de scroll: o botão fica visível 100% do tempo, por decisão do João em 20/08. Esconder até rolar perde quem entra e decide na hora.

- [ ] **Step 4: Adicionar o halo verde ao CSS**

Adicionar em `manfac-site/app/globals.css`, antes do bloco de reduced-motion:

```css
.wa-float {
  box-shadow: 0 0 18px 1px rgba(94, 246, 150, 0.49),
              0 0 36px 4px rgba(94, 246, 150, 0.24),
              0 5px 14px rgba(0, 0, 0, 0.16);
  animation: wa-pump 2.6s ease-in-out 0.6s infinite;
}

@keyframes wa-pump {
  0%, 100% {
    box-shadow: 0 0 13px 0px rgba(94, 246, 150, 0.52),
                0 0 22px 0px rgba(94, 246, 150, 0.21),
                0 5px 14px rgba(0, 0, 0, 0.16);
  }
  45% {
    box-shadow: 0 0 29px 14px rgba(140, 255, 185, 0.60),
                0 0 67px 28px rgba(94, 246, 150, 0.20),
                0 5px 14px rgba(0, 0, 0, 0.16);
  }
}

.wa-float:hover {
  animation: none;
  box-shadow: 0 0 24px 4px rgba(140, 255, 190, 0.66),
              0 0 49px 11px rgba(94, 246, 150, 0.32),
              0 5px 14px rgba(0, 0, 0, 0.16);
}
```

E no bloco de reduced-motion: `.wa-float { animation: none; }`

> O halo usa verde claro `rgb(94,246,150)`, não o `#25d366` do botão — o verde oficial é escuro e some contra o fundo branco. O botão continua no verde oficial; só o brilho clareia.

- [ ] **Step 5: Montar no layout**

Em `manfac-site/app/layout.tsx`, importar e renderizar dentro do `<body>`, depois de `{children}`:

```tsx
import WhatsAppFloat from '@/components/WhatsAppFloat'
```

```tsx
<body className={`${inter.variable} ${plexMono.variable} font-sans antialiased`}>
  {children}
  <WhatsAppFloat />
</body>
```

> Vai no layout, e não nas páginas, porque Header e Footer neste projeto são montados página a página — repetir o flutuante em 7 arquivos seria erro esperando acontecer.

- [ ] **Step 6: Rodar testes e build**

Run: `cd manfac-site && npx vitest run --pool=threads --no-file-parallelism components/__tests__/WhatsAppFloat.test.tsx`
Expected: PASS, 3 testes

Run: `cd manfac-site && npx tsc --noEmit && npm run build`
Expected: limpo

- [ ] **Step 7: Commit**

```bash
git add manfac-site/components/WhatsAppFloat.tsx manfac-site/components/__tests__/WhatsAppFloat.test.tsx manfac-site/app/layout.tsx manfac-site/app/globals.css
git commit -m "feat(manfac-site): botao flutuante de WhatsApp sempre visivel"
```

---

### Task 5: Rodapé expandido

**Files:**
- Modify: `manfac-site/components/Footer.tsx`
- Test: `manfac-site/components/__tests__/Footer.test.tsx` (criar)

**Interfaces:**
- Consumes: `SERVICOS` de `@/lib/servicos` (slugs `obras-e-reformas`, `novas-construcoes`, `manutencao-predial`, `hvac`), `WhatsAppIcon` e `buildDirectWhatsAppUrl` (Task 1)
- Produces: nada

- [ ] **Step 1: Escrever o teste que falha**

Criar `manfac-site/components/__tests__/Footer.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import Footer from '../Footer'

describe('Footer', () => {
  it('linka as 4 subpáginas de serviço', () => {
    render(<Footer />)
    ;['obras-e-reformas', 'novas-construcoes', 'manutencao-predial', 'hvac'].forEach((slug) => {
      const link = document.querySelector(`a[href="/servicos/${slug}"]`)
      expect(link).not.toBeNull()
    })
  })

  it('mostra os canais de contato', () => {
    render(<Footer />)
    expect(screen.getByText(/contato@manfac\.com\.br/)).toBeTruthy()
    expect(screen.getByText(/98428-0058/)).toBeTruthy()
  })

  it('linka as páginas institucionais', () => {
    render(<Footer />)
    ;['/', '/quem-somos', '/resultados'].forEach((href) => {
      expect(document.querySelector(`a[href="${href}"]`)).not.toBeNull()
    })
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd manfac-site && npx vitest run --pool=threads --no-file-parallelism components/__tests__/Footer.test.tsx`
Expected: FAIL — o rodapé atual só tem logo e copyright

- [ ] **Step 3: Reescrever o Footer**

Substituir o conteúdo de `manfac-site/components/Footer.tsx` por 4 colunas: marca (logo + tagline + botão "Falar agora"), Serviços (hub + 4 subpáginas), Institucional (Início, Quem somos, Resultados) e Contato (WhatsApp, e-mail, endereço).

Estrutura: `<footer className="bg-[var(--ink)] text-[#b9cfe0]">` com um grid `md:grid-cols-[1.6fr_repeat(3,1fr)]` e a linha de copyright separada por `border-t`. Ler os slugs de `SERVICOS` em vez de hardcodar a lista, para não divergir do resto do site.

> **Placeholders a marcar com comentário `{/* TODO: dado do cliente */}`:** tagline e endereço ainda não vieram do João. Usar texto provisório visível, não string vazia — assim ninguém publica sem perceber.

- [ ] **Step 4: Rodar testes e build**

Run: `cd manfac-site && npx vitest run --pool=threads --no-file-parallelism components/__tests__/Footer.test.tsx`
Expected: PASS, 3 testes

Run: `cd manfac-site && npx tsc --noEmit && npm run build`
Expected: limpo

- [ ] **Step 5: Commit**

```bash
git add manfac-site/components/Footer.tsx manfac-site/components/__tests__/Footer.test.tsx
git commit -m "feat(manfac-site): rodape em 4 colunas com subpaginas e contato"
```

---

### Task 6: Scroll suave com Lenis

**Files:**
- Modify: `manfac-site/package.json` (dependência)
- Create: `manfac-site/components/SmoothScroll.tsx`
- Modify: `manfac-site/app/layout.tsx`
- Modify: `manfac-site/app/globals.css:20`

**Interfaces:**
- Consumes: nada
- Produces: `SmoothScroll` — componente default `'use client'`, props `{ children?: never }`, renderiza `null`

**Esta é a task mais arriscada do plano.** É a única dependência nova e a única capaz de quebrar o scroll do site inteiro. Se qualquer verificação do Step 5 falhar e não houver correção rápida, **reverter esta task e entregar as outras cinco** — o site fica melhor mesmo sem ela.

- [ ] **Step 1: Instalar a dependência**

Run: `cd manfac-site && npm install lenis@1.3.26`
Expected: instala sem erro de peer dependency com React 19

- [ ] **Step 2: Criar o provider**

Criar `manfac-site/components/SmoothScroll.tsx`:

```tsx
'use client'

import { useEffect } from 'react'
import Lenis from 'lenis'

export default function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const lenis = new Lenis({ duration: 1.1, smoothWheel: true })
    let id = 0

    function raf(time: number) {
      lenis.raf(time)
      id = requestAnimationFrame(raf)
    }
    id = requestAnimationFrame(raf)

    return () => {
      cancelAnimationFrame(id)
      lenis.destroy()
    }
  }, [])

  return null
}
```

> Conferir a API da 1.3.26 antes de assumir os nomes `raf` e `destroy` — ler o `README.md` ou os tipos em `node_modules/lenis/`. O `useEffect` com cleanup é obrigatório: sem `destroy()`, navegar entre páginas empilha instâncias.

- [ ] **Step 3: Remover o scroll-behavior nativo**

Em `manfac-site/app/globals.css`, no bloco `html, body`, **apagar a linha** `scroll-behavior: smooth;`.

> Se ficar, os dois competem em clique de âncora e o resultado é um salto seco no meio da animação.

- [ ] **Step 4: Montar no layout**

Em `manfac-site/app/layout.tsx`, importar e renderizar dentro do `<body>`, antes de `{children}`:

```tsx
import SmoothScroll from '@/components/SmoothScroll'
```

```tsx
<body className={...}>
  <SmoothScroll />
  {children}
  <WhatsAppFloat />
</body>
```

- [ ] **Step 5: Verificação manual — critérios de aceite**

Run: `cd manfac-site && npm run dev`

Confirmar **todos** os itens. Qualquer falha sem correção rápida = reverter a task:

- [ ] Rolar com a roda do mouse na home inteira, do topo ao rodapé, **sem travar**
- [ ] Continuar rolando depois de **redimensionar a janela** (o bug de altura desatualizada)
- [ ] Rolar em página curta (`/contato`) sem comportamento estranho
- [ ] O dropdown de Serviços abre e fecha normalmente
- [ ] O menu mobile abre, rola e fecha
- [ ] Navegar entre páginas e rolar de novo (teste do cleanup)
- [ ] Testar no celular ou no modo dispositivo do DevTools — **toque não pode ficar preso**
- [ ] Com `prefers-reduced-motion` ligado no SO, o scroll volta ao nativo

- [ ] **Step 6: Rodar testes e build**

Run: `cd manfac-site && npx tsc --noEmit && npm run build`
Expected: limpo

Run: `cd manfac-site && npx vitest run --pool=threads --no-file-parallelism`
Expected: tudo passando

- [ ] **Step 7: Commit**

```bash
git add manfac-site/package.json manfac-site/package-lock.json manfac-site/components/SmoothScroll.tsx manfac-site/app/layout.tsx manfac-site/app/globals.css
git commit -m "feat(manfac-site): scroll suave com Lenis"
```

---

## Encerramento da frente A

Depois da Task 6:

1. **Code review** — usar `superpowers:requesting-code-review`
2. **Push** — pedir autorização ao João antes (ele já autorizou commit direto no master; push é ação separada)
3. **Deploy** — João clica Deploy no app **`manfac-site`** do EasyPanel (**não** o `manfac-login-system`). Confirmar o build comparando o `Last-Modified` dos `/_next/static/chunks/*.js` de `https://manfac.com.br`: todos têm que ter o mesmo timestamp, posterior ao push. O baseline anterior é `Thu, 16 Jul 2026 20:54:57 GMT`.
4. **Registrar no `AGENTS.md`** o nome exato do app do site no EasyPanel — hoje o arquivo documenta o caminho do hub mas não o do site, lacuna que já causou confusão em 09/08.

A frente B entra depois, em plano próprio, e depende de dois acessos que só o João tem: o segredo no painel do EasyPanel e a aplicação do SQL no Supabase.

---

## Status: frente A implementada e revisada (20/08/2026)

As 6 tasks foram executadas e commitadas (`80ba34a`..`1ddf44b`), mais o code review
(`d70d553`). `tsc --noEmit` limpo, `next build` limpo, **38/38 testes passando**.
Ainda **não pushado nem deployado**.

### Desvios conscientes em relação ao texto do plano

Registrados aqui para que ninguém os leia como bug mais tarde:

1. **`autoRaf: true` em vez do loop manual de `requestAnimationFrame`.** A opção existe
   na 1.3.26 e elimina o `id` mutável que o plano pedia — um estado a menos para errar.
   O `destroy()` no cleanup continua.
2. **Sublinhado animado só no menu desktop.** A spec (A2) pedia também no mobile; em
   touch não há hover, e o item ativo no mobile já se distingue por peso e cor.
3. **Sem fade-in de entrada do botão flutuante** (spec A4). Ele aparece direto. Menos
   uma animação para o `prefers-reduced-motion` cobrir.
4. **`Contato.tsx` continua apontando para `/contato`**, não para o WhatsApp. O
   formulário de qualificação é o destino certo desse CTA, e é ele que a frente B
   transforma em captura de lead.

### O que o code review pegou e foi corrigido em `d70d553`

- **Crítico:** o hero de `/quem-somos` centraliza verticalmente em vez de usar `py`, e
  com o header `fixed` (80px) o eyebrow ficava a 6px da pílula em 360px de largura.
  Medido no navegador antes e depois: 6px → 46px de folga.
- Contraste do menu: `--muted` sobre a pílula a 70% em cima dos heros escuros dava
  ~2:1. Passou para `--ink/70` (~6:1). **A opacidade aprovada de 70% não foi tocada.**
- `prefers-reduced-motion` não cobria as *transições* novas (a query não separa
  `animation` de `transition`) — pílula, sublinhado e a expansão do flutuante.
- O halo não estava no maior CTA do site ("Agendar conversa técnica"); a spec A5 pedia
  todos os primários e o plano tinha estreitado para três sem dizer por quê.
- Foco por teclado não revelava nem o sublinhado nem o rótulo do flutuante; falta de
  `scroll-padding-top` deixava âncora parar embaixo do header.
- Número do rodapé era literal; virou `WHATSAPP_COMERCIAL_DISPLAY`, e o teste passou a
  assertar sobre a constante em vez de proteger a divergência.

### Verificação no navegador (a etapa que o plano pedia e faltava)

Medida com `getBoundingClientRect`, não a olho — folga entre a base da pílula e o
primeiro conteúdo, em viewport estreito:

| Rota | Folga |
|---|---|
| `/` | 54px |
| `/quem-somos` | 46px (a 360px de largura simulada) |
| `/servicos` | 54px |
| `/servicos/[slug]` | 54px |
| `/resultados` | 54px |
| `/contato` | 80px |

Também confirmado: scroll do Lenis continua funcionando **depois de navegar entre
páginas** (`html.lenis` presente, `scrollY` respondendo), header contrai e ganha sombra
ao rolar, menu desktop legível sobre o hero, e nenhum erro de console além de um aviso
de hidratação causado por extensão do navegador (`data-lt-installed`), não pelo código.

### Pendências que não são de código

- **Dados que faltam do cliente:** tagline e endereço reais (hoje há texto provisório em
  `Footer.tsx`, marcado com `TODO`), telefone fixo e Instagram.
- Sobre o `.wa-float` e o `.btn-pump` animarem `box-shadow` a cada frame: se aparecer
  queixa de bateria em celular fraco, a saída é mover o halo para um pseudo-elemento
  animando `opacity`/`transform`. Não foi feito porque o efeito aprovado é este.
