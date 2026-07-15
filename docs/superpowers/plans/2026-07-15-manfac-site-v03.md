# Manfac Site v03 (Entrega Final) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar a v03 do site manfac.com.br conforme a spec `docs/superpowers/specs/2026-07-14-manfac-site-v03-design.md` — entrega final do contrato.

**Architecture:** Site Next.js App Router em `manfac-site/` (projeto independente dentro do monorepo, com `node_modules` e `tsconfig` próprios). Conteúdo centralizado em `manfac-site/lib/*.ts`, componentes de seção em `manfac-site/components/`, uma page por rota em `manfac-site/app/`. Lógica pura (mensagem de WhatsApp, parse do Counter, estado ativo de nav) extraída para `lib/` e testada com o Jest da **raiz do repo**.

**Tech Stack:** Next.js 16.2.9 (versão custom — ver Global Constraints), React 19, Tailwind v4 (tokens CSS em `globals.css`), TypeScript. Jest 30 + Testing Library (instalados na raiz do repo, não no manfac-site).

**Referência visual:** mockup aprovado — https://claude.ai/code/artifact/40fd1f09-00be-4e89-8b46-9e5ede917b13. Onde mockup e site atual divergirem, o mockup manda.

## Global Constraints

- **Next.js custom:** `AGENTS.md` do repo avisa que esta versão de Next tem breaking changes. Antes de usar qualquer API de Next que não esteja já em uso no manfac-site, leia o guia em `manfac-site/node_modules/next/dist/docs/`. As pages/metadata/sitemap existentes são padrões comprovados — siga-os.
- **Testes rodam da RAIZ do repo:** `npm test -- manfac-site` (o Jest da raiz descobre testes em `manfac-site/`). Nos arquivos de teste use **imports relativos** (`../Counter`), nunca `@/` (o alias `@/` do Jest da raiz aponta pra raiz do repo, não pro manfac-site).
- **Lint/build rodam DENTRO de manfac-site:** `cd manfac-site && npm run lint && npm run build`.
- **Copy em pt-BR, strings exatas da spec.** Termos banidos (critério de aceite 6): "diagnóstico gratuito", "qualquer escala", "Zero intermediário", "sem surpresas no final do mês", "Zero chamado sem resposta".
- **Ícones:** SVG inline nas cores da marca (`#00345e`, `#1a4873`, `#f85e0b`, `#cc4d09`), animação via classe `icon-float` existente (desligada sob `prefers-reduced-motion` em `globals.css`). Nenhuma lib externa de ícones.
- **Tokens de cor:** usar sempre `var(--ink)`, `var(--orange)`, `var(--surface)`, `var(--border)`, `var(--muted)`, `var(--body-text)` — nunca hex solto em componente (exceto dentro de SVGs e o navy do case `#0b1e30`).
- **Commits frequentes:** um commit ao fim de cada task, mensagem em `feat(manfac-site):` / `fix(manfac-site):` / `test(manfac-site):`, com `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: Counter renderiza valor final por padrão (fix indicadores zerados)

**Files:**
- Modify: `manfac-site/components/Counter.tsx`
- Test: `manfac-site/components/__tests__/Counter.test.tsx` (criar)

**Interfaces:**
- Consumes: nada.
- Produces: `Counter({ value: string, duration?: number })` — mesmo contrato de hoje; muda só o comportamento (estado inicial = valor final).

- [ ] **Step 1: Write the failing test**

Criar `manfac-site/components/__tests__/Counter.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import Counter from '../Counter'

// jsdom não tem IntersectionObserver nem matchMedia — exatamente o cenário
// "JS de animação indisponível". O Counter deve mostrar o valor final assim mesmo.

describe('Counter', () => {
  it('renderiza "+R$800 mil" imediatamente, sem animação', () => {
    render(<Counter value="+R$800 mil" />)
    expect(screen.getByText('+R$800 mil')).toBeInTheDocument()
  })

  it('renderiza "400+" imediatamente', () => {
    render(<Counter value="400+" />)
    expect(screen.getByText('400+')).toBeInTheDocument()
  })

  it('renderiza "+1.000" com separador pt-BR imediatamente', () => {
    render(<Counter value="+1.000" />)
    expect(screen.getByText('+1.000')).toBeInTheDocument()
  })

  it('renderiza "100%" imediatamente', () => {
    render(<Counter value="100%" />)
    expect(screen.getByText('100%')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Na **raiz do repo**: `npm test -- Counter`
Expected: FAIL — os 4 testes encontram `+R$0 mil`, `0+`, `0`, `0%` em vez dos valores finais (o componente atual inicia `count` em 0).

- [ ] **Step 3: Write minimal implementation**

Substituir o conteúdo de `manfac-site/components/Counter.tsx` por:

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'

function parseValue(raw: string): { prefix: string; target: number; suffix: string; ptbr: boolean } {
  const m = raw.match(/^([^0-9]*)([0-9][0-9.]*[0-9]|[0-9])([^0-9]*)$/)
  if (!m) return { prefix: '', target: 0, suffix: raw, ptbr: false }
  const ptbr = m[2].includes('.')
  const target = parseInt(m[2].replace(/\./g, ''), 10)
  return { prefix: m[1], target, suffix: m[3], ptbr }
}

function easeOut(t: number) {
  return 1 - Math.pow(1 - t, 3)
}

export default function Counter({ value, duration = 1800 }: { value: string; duration?: number }) {
  const { prefix, target, suffix, ptbr } = parseValue(value)
  // O valor final é o estado inicial: SSR, JS lento, JS desabilitado e
  // reduced-motion sempre veem o número real. A contagem é só enfeite.
  const [count, setCount] = useState(target)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') return
    if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let raf = 0
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        observer.disconnect()
        const start = performance.now()
        const tick = (now: number) => {
          const t = Math.min((now - start) / duration, 1)
          setCount(Math.round(easeOut(t) * target))
          if (t < 1) raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
      },
      { threshold: 0.3 }
    )
    observer.observe(el)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [target, duration])

  const display = ptbr ? count.toLocaleString('pt-BR') : count.toString()

  return (
    <span ref={ref}>
      {prefix}{display}{suffix}
    </span>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Na raiz: `npm test -- Counter`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add manfac-site/components/Counter.tsx manfac-site/components/__tests__/Counter.test.tsx
git commit -m "fix(manfac-site): Counter renderiza valor final por padrão; animação vira enfeite progressivo

Corrige os indicadores zerados apontados no relatório de avaliação do cliente.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: lib de WhatsApp (mensagem estruturada + URL)

**Files:**
- Create: `manfac-site/lib/whatsapp.ts`
- Test: `manfac-site/lib/__tests__/whatsapp.test.ts` (criar)

**Interfaces:**
- Consumes: nada.
- Produces (usados pela Task 9 — formulário de contato):
  - `WHATSAPP_COMERCIAL: string`
  - `type DemandPath = 'Manutenção recorrente' | 'Obra ou reforma' | 'Avaliação técnica'`
  - `type ContactFormData = { path: DemandPath; nome: string; empresa: string; email: string; telefone: string; cargo?: string; localidade: string; unidades?: string; resumo?: string }`
  - `buildWhatsAppMessage(d: ContactFormData): string`
  - `buildWhatsAppUrl(d: ContactFormData): string`

- [ ] **Step 1: Write the failing test**

Criar `manfac-site/lib/__tests__/whatsapp.test.ts`:

```ts
import { buildWhatsAppMessage, buildWhatsAppUrl, WHATSAPP_COMERCIAL, type ContactFormData } from '../whatsapp'

const base: ContactFormData = {
  path: 'Obra ou reforma',
  nome: 'Maria Silva',
  empresa: 'Rede XYZ',
  email: 'maria@xyz.com.br',
  telefone: '(21) 99999-0000',
  localidade: 'RJ capital',
}

describe('buildWhatsAppMessage', () => {
  it('monta a mensagem com os campos obrigatórios na ordem', () => {
    expect(buildWhatsAppMessage(base)).toBe(
      [
        'Olá! Vim pelo site da Manfac.',
        'Tipo de demanda: Obra ou reforma',
        'Nome: Maria Silva',
        'Empresa: Rede XYZ',
        'E-mail: maria@xyz.com.br',
        'Telefone: (21) 99999-0000',
        'Localidade: RJ capital',
      ].join('\n')
    )
  })

  it('inclui cargo entre parênteses quando informado', () => {
    const msg = buildWhatsAppMessage({ ...base, cargo: 'Gerente de Facilities' })
    expect(msg).toContain('Nome: Maria Silva (Gerente de Facilities)')
  })

  it('inclui unidades apenas no caminho de manutenção recorrente', () => {
    const rec = buildWhatsAppMessage({ ...base, path: 'Manutenção recorrente', unidades: '51 a 200' })
    expect(rec).toContain('Unidades: 51 a 200')
    const spot = buildWhatsAppMessage({ ...base, unidades: '51 a 200' })
    expect(spot).not.toContain('Unidades:')
  })

  it('inclui resumo quando informado', () => {
    const msg = buildWhatsAppMessage({ ...base, resumo: 'rede com 30 lojas' })
    expect(msg).toContain('Resumo: rede com 30 lojas')
  })
})

describe('buildWhatsAppUrl', () => {
  it('gera URL wa.me com texto URL-encoded', () => {
    const url = buildWhatsAppUrl(base)
    expect(url.startsWith(`https://wa.me/${WHATSAPP_COMERCIAL}?text=`)).toBe(true)
    expect(url).toContain(encodeURIComponent('Olá! Vim pelo site da Manfac.'))
    expect(url).not.toContain('\n')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Na raiz: `npm test -- whatsapp`
Expected: FAIL — "Cannot find module '../whatsapp'".

- [ ] **Step 3: Write minimal implementation**

Criar `manfac-site/lib/whatsapp.ts`:

```ts
// Número do WhatsApp comercial da Manfac.
// TODO: trocar pelo número real quando o cliente informar (formato: 55 + DDD + número, só dígitos).
export const WHATSAPP_COMERCIAL = '5521999999999'

export type DemandPath = 'Manutenção recorrente' | 'Obra ou reforma' | 'Avaliação técnica'

export type ContactFormData = {
  path: DemandPath
  nome: string
  empresa: string
  email: string
  telefone: string
  cargo?: string
  localidade: string
  unidades?: string
  resumo?: string
}

export function buildWhatsAppMessage(d: ContactFormData): string {
  const linhas = [
    'Olá! Vim pelo site da Manfac.',
    `Tipo de demanda: ${d.path}`,
    `Nome: ${d.nome}${d.cargo ? ` (${d.cargo})` : ''}`,
    `Empresa: ${d.empresa}`,
    `E-mail: ${d.email}`,
    `Telefone: ${d.telefone}`,
    `Localidade: ${d.localidade}`,
  ]
  if (d.path === 'Manutenção recorrente' && d.unidades) linhas.push(`Unidades: ${d.unidades}`)
  if (d.resumo) linhas.push(`Resumo: ${d.resumo}`)
  return linhas.join('\n')
}

export function buildWhatsAppUrl(d: ContactFormData): string {
  return `https://wa.me/${WHATSAPP_COMERCIAL}?text=${encodeURIComponent(buildWhatsAppMessage(d))}`
}
```

- [ ] **Step 4: Run test to verify it passes**

Na raiz: `npm test -- whatsapp`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add manfac-site/lib/whatsapp.ts manfac-site/lib/__tests__/whatsapp.test.ts
git commit -m "feat(manfac-site): lib de mensagem/URL de WhatsApp para o formulário de contato

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Navegação — "Início" no menu + estado ativo correto

**Files:**
- Create: `manfac-site/lib/nav.ts`
- Test: `manfac-site/lib/__tests__/nav.test.ts` (criar)
- Modify: `manfac-site/lib/content.ts` (NAV_ITEMS, linhas 3–8)
- Modify: `manfac-site/components/Header.tsx` (usar `isNavActive`; CTA "Falar com especialista")

**Interfaces:**
- Consumes: nada.
- Produces: `isNavActive(pathname: string, href: string): boolean` em `manfac-site/lib/nav.ts`.

- [ ] **Step 1: Write the failing test**

Criar `manfac-site/lib/__tests__/nav.test.ts`:

```ts
import { isNavActive } from '../nav'

describe('isNavActive', () => {
  it('"Início" ativo somente na home', () => {
    expect(isNavActive('/', '/')).toBe(true)
    expect(isNavActive('/servicos', '/')).toBe(false)
    expect(isNavActive('/contato', '/')).toBe(false)
  })

  it('rota exata ativa', () => {
    expect(isNavActive('/servicos', '/servicos')).toBe(true)
  })

  it('sub-rota ativa o item pai', () => {
    expect(isNavActive('/servicos/hvac', '/servicos')).toBe(true)
  })

  it('prefixo parcial não ativa', () => {
    expect(isNavActive('/servicos-outra', '/servicos')).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Na raiz: `npm test -- nav`
Expected: FAIL — "Cannot find module '../nav'".

- [ ] **Step 3: Write minimal implementation**

Criar `manfac-site/lib/nav.ts`:

```ts
export function isNavActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(href + '/')
}
```

- [ ] **Step 4: Run test to verify it passes**

Na raiz: `npm test -- nav`
Expected: PASS.

- [ ] **Step 5: Adicionar "Início" ao NAV_ITEMS**

Em `manfac-site/lib/content.ts`, substituir o bloco `NAV_ITEMS`:

```ts
export const NAV_ITEMS = [
  { href: '/', label: 'Início' },
  { href: '/quem-somos', label: 'Quem somos' },
  { href: '/servicos', label: 'Serviços' },
  { href: '/resultados', label: 'Resultados' },
  { href: '/contato', label: 'Contato' },
]
```

- [ ] **Step 6: Header usa isNavActive e CTA executivo**

Em `manfac-site/components/Header.tsx`:

1. Adicionar import: `import { isNavActive } from '@/lib/nav'` (dentro do manfac-site o alias `@/` funciona).
2. Trocar a linha `const active = pathname === item.href || pathname.startsWith(item.href + '/')` por `const active = isNavActive(pathname, item.href)`.
3. Trocar o texto do CTA `Fale com a gente` por `Falar com especialista`.

O menu mobile itera o mesmo `NAV_ITEMS`, então "Início" entra automaticamente nos dois menus.

- [ ] **Step 7: Verificar lint e commit**

```bash
cd manfac-site && npm run lint && cd ..
git add manfac-site/lib/nav.ts manfac-site/lib/__tests__/nav.test.ts manfac-site/lib/content.ts manfac-site/components/Header.tsx
git commit -m "feat(manfac-site): item Início no menu com estado ativo correto e CTA executivo no header

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Fotos reais de obra (Unsplash/Pexels)

**Files:**
- Create: `manfac-site/public/media/v03-obra-corporativa.jpg`
- Create: `manfac-site/public/media/v03-tecnico-campo.jpg`
- Create: `manfac-site/public/media/v03-equipe-obra.jpg`
- Create: `manfac-site/public/media/v03-hvac.jpg`
- Create: `manfac-site/public/media/v03-fachada-comercial.jpg`
- Create: `docs/superpowers/specs/2026-07-15-manfac-v03-photo-credits.md`

**Interfaces:**
- Consumes: nada.
- Produces: os 5 arquivos de imagem acima, usados nas Tasks 6, 8 e 10 pelos paths exatos listados.

- [ ] **Step 1: Selecionar e baixar as 5 fotos**

Buscar em unsplash.com e/ou pexels.com (licenças permitem uso comercial sem atribuição) fotos **realistas** — canteiro/estrutura, técnico com EPI, equipe em obra, casa de máquinas/HVAC, fachada comercial. Critérios: parecer obra/manutenção real (não foto de banco “posada”), resolução mínima 1600px de largura, orientação paisagem.

Baixar com largura limitada (Unsplash aceita parâmetros na URL do CDN):

```bash
curl -L "https://images.unsplash.com/photo-<ID>?w=1920&q=80&fm=jpg" -o manfac-site/public/media/v03-obra-corporativa.jpg
# repetir para cada uma das 5 fotos, com o nome de arquivo correspondente
```

Verificar tamanho e dimensões (cada arquivo idealmente < 500KB; se maior, baixar com `q=70`):

```bash
ls -la manfac-site/public/media/v03-*.jpg
```

- [ ] **Step 2: Registrar créditos**

Criar `docs/superpowers/specs/2026-07-15-manfac-v03-photo-credits.md` com uma linha por foto:

```markdown
# Créditos das fotos v03 (rastreabilidade de licença)

| Arquivo | Fonte (URL da página da foto) | Autor | Licença |
|---|---|---|---|
| v03-obra-corporativa.jpg | https://unsplash.com/photos/<slug> | <nome> | Unsplash License |
| v03-tecnico-campo.jpg | ... | ... | ... |
| v03-equipe-obra.jpg | ... | ... | ... |
| v03-hvac.jpg | ... | ... | ... |
| v03-fachada-comercial.jpg | ... | ... | ... |
```

(preencher com os dados reais das fotos escolhidas — a tabela não pode ficar com `<slug>`/`...` no commit)

- [ ] **Step 3: Commit**

```bash
git add manfac-site/public/media/v03-*.jpg docs/superpowers/specs/2026-07-15-manfac-v03-photo-credits.md
git commit -m "feat(manfac-site): fotos reais de obra/manutenção (Unsplash/Pexels) com créditos registrados

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Dados novos e copy calibrada em content.ts

**Files:**
- Modify: `manfac-site/lib/content.ts`

**Interfaces:**
- Consumes: nada.
- Produces (usados pelas Tasks 6–8):
  - `DORES: { dor: string; resposta: string }[]` (5 itens)
  - `COMO_FUNCIONA: { n: string; title: string; description: string }[]` (5 itens)
  - `RECORRENTE_SPOT: { recorrente: { tagline: string; title: string; items: string[] }; spot: { tagline: string; title: string; items: string[] } }`
  - `DIFERENCIAIS_HOME: string[]` (5 itens)
  - `PILARES` e `IMPACTO` com copy calibrada (mesmos nomes já existentes)

- [ ] **Step 1: Adicionar os novos blocos de dados**

Em `manfac-site/lib/content.ts`, adicionar após `PROBLEMAS`:

```ts
// Home v03 — seção "O problema que resolvemos" (tabela 2.2-B do relatório)
export const DORES = [
  { dor: 'Muitos fornecedores', resposta: 'Ponto único de responsabilidade e comunicação.' },
  { dor: 'Falta de padrão', resposta: 'Equipe própria treinada, rotina técnica e supervisão operacional.' },
  { dor: 'Baixa visibilidade', resposta: 'Relatórios, cronogramas, status recorrente e evidências em campo.' },
  { dor: 'Chamados recorrentes', resposta: 'Análise de causa, priorização e plano de redução de reincidência.' },
  { dor: 'Dificuldade de cobrança', resposta: 'Gestão ativa com responsável técnico e acompanhamento de ponta a ponta.' },
]

// Home v03 — seção "Como funciona na prática" (seção 3.2-D do relatório)
export const COMO_FUNCIONA = [
  { n: '01', title: 'Mapeamento inicial', description: 'Unidades, histórico, volume, SLA, criticidade e prioridades.' },
  { n: '02', title: 'Plano operacional', description: 'Equipe, rotina, fluxo de chamados, relatórios e indicadores.' },
  { n: '03', title: 'Execução em campo', description: 'Técnicos, supervisão, materiais, fotos, evidências e qualidade.' },
  { n: '04', title: 'Gestão e comunicação', description: 'Status recorrente, cronograma, dashboard, reuniões e pendências.' },
  { n: '05', title: 'Melhoria contínua', description: 'Recorrências, redução de emergências e plano de evolução.' },
]

// Home v03 — contrato recorrente vs. demandas spot (seção 4.3 do relatório)
export const RECORRENTE_SPOT = {
  recorrente: {
    tagline: 'Contrato recorrente',
    title: 'Sua operação, sob gestão contínua',
    items: [
      'Manutenção preventiva, corretiva e emergencial',
      'SLA, equipe dedicada, rotina de chamados e relatórios',
      'Gestão mensal, redução de emergências e padronização',
    ],
  },
  spot: {
    tagline: 'Demandas spot',
    title: 'Projetos pontuais, entrega técnica',
    items: [
      'Reformas, adequações e obras pontuais',
      'Escopo fechado, cronograma e orçamento definidos',
      'Expansões, retrofit, obras em loja e melhorias estruturais',
    ],
  },
}

// Home v03 — seção "Por que a Manfac"
export const DIFERENCIAIS_HOME = [
  'Equipe própria treinada',
  'Gestão ativa com responsável técnico',
  'Relatórios e evidências em campo',
  'Ponto focal único',
  'Capacidade de escala comprovada',
]
```

- [ ] **Step 2: Calibrar copy existente no mesmo arquivo**

No mesmo `content.ts`:

1. Em `PILARES[1].description`, trocar
   `'Relatórios claros, cronogramas atualizados e comunicação direta — sem ruído, sem surpresas no final do mês.'`
   por
   `'Relatórios claros, cronogramas atualizados e comunicação recorrente — para reduzir desvios e antecipar decisões.'`
2. Em `IMPACTO`, trocar
   `'Prazo e custo sob controle, sem surpresas'` por `'Prazo e custo sob controle, com comunicação recorrente'`
   e `'Zero chamado sem resposta'` por `'Todo chamado com registro, prazo e responsável definidos'`.

- [ ] **Step 3: Verificar que não sobrou termo banido no arquivo**

```bash
grep -inE "diagnóstico gratuito|qualquer escala|zero intermediário|sem surpresas|zero chamado" manfac-site/lib/content.ts
```
Expected: nenhuma linha.

- [ ] **Step 4: Lint e commit**

```bash
cd manfac-site && npm run lint && cd ..
git add manfac-site/lib/content.ts
git commit -m "feat(manfac-site): dados das novas seções da home e copy calibrada em content.ts

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Home parte 1 — Hero novo + Stats em banda escura

**Files:**
- Modify: `manfac-site/components/Hero.tsx`
- Modify: `manfac-site/components/Stats.tsx`

**Interfaces:**
- Consumes: `Counter` (Task 1), `STATS` de `@/lib/content`.
- Produces: `Hero()` e `Stats()` sem props (Stats perde a prop `index`, que ninguém mais usa na home v03).

- [ ] **Step 1: Hero com a copy nova**

Substituir em `manfac-site/components/Hero.tsx` apenas os textos (estrutura/vídeo/classes ficam):

- Eyebrow: `Engenharia para grandes operações` → `Engenharia · Manutenção · Obras corporativas`
- H1: `Mais que obras.<br />Estrutura e visibilidade para sua operação.` → `Engenharia, manutenção predial e obras corporativas<br />para operações que não podem parar.` (manter o `<br />` entre as duas linhas como no mockup)
- Parágrafo: `A Manfac assume obras, reformas e manutenção predial com equipe própria, cronograma real e visibilidade diária — do início ao fim.` → `A Manfac atende empresas com múltiplas unidades, alto volume de demandas e necessidade de controle, padronização e visibilidade em campo — da manutenção recorrente às obras e reformas spot.`
- CTA 1: `Falar com um especialista` → `Falar com especialista` (href `/contato` mantém)
- CTA 2: `Ver case de sucesso` → `Ver case de 400+ unidades` (href `/resultados` mantém)

- [ ] **Step 2: Stats vira banda escura (mockup)**

Substituir o conteúdo de `manfac-site/components/Stats.tsx` por:

```tsx
import Reveal from './Reveal'
import Counter from './Counter'
import { STATS } from '@/lib/content'

export default function Stats() {
  return (
    <section aria-label="Manfac em números" style={{ backgroundColor: 'var(--ink)' }}>
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-white/[0.09] md:grid-cols-4">
          {STATS.map((s, i) => (
            <Reveal key={s.label} delay={i * 120}>
              <div
                className="flex h-full flex-col items-center justify-center px-4 py-8 text-center"
                style={{ backgroundColor: 'var(--ink)' }}
              >
                <p className="text-3xl font-extrabold text-[var(--orange)] md:text-4xl">
                  <Counter value={s.value} />
                </p>
                <p className="mt-2 text-sm leading-snug text-white/65">{s.label}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
```

Nota: `Stats` era usado com prop `index` (`<Stats index="01" />`) em outras páginas — buscar usos com `grep -rn "Stats" manfac-site/app manfac-site/components --include=*.tsx` e remover a prop `index` de todos os call sites (a prop deixou de existir).

- [ ] **Step 3: Verificação visual rápida**

```bash
cd manfac-site && npm run dev
```
Abrir http://localhost:3000 — hero com headline nova; (Stats ainda não está na home — só confere que nada quebrou). Ctrl+C.

- [ ] **Step 4: Lint e commit**

```bash
cd manfac-site && npm run lint && cd ..
git add manfac-site/components/Hero.tsx manfac-site/components/Stats.tsx
git commit -m "feat(manfac-site): hero com copy do relatório e stats em banda escura

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Home parte 2 — seções Dores e Como Funciona (ícones animados)

**Files:**
- Create: `manfac-site/components/home/Dores.tsx`
- Create: `manfac-site/components/home/ComoFunciona.tsx`

**Interfaces:**
- Consumes: `DORES`, `COMO_FUNCIONA` de `@/lib/content` (Task 5); `Reveal`.
- Produces: `Dores()` e `ComoFunciona()` sem props, usados na Task 8 (montagem da home).

- [ ] **Step 1: Criar Dores.tsx**

```tsx
import Reveal from '../Reveal'
import { DORES } from '@/lib/content'

export default function Dores() {
  return (
    <section className="border-b border-[var(--border)]">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <Reveal>
          <p className="font-mono text-xs uppercase tracking-widest text-[var(--orange)]">
            O problema que resolvemos
          </p>
          <h2 className="mt-3 max-w-3xl text-2xl font-bold leading-snug text-[var(--ink)] md:text-3xl">
            Para quem gerencia muitas unidades, cada fornecedor desalinhado vira custo, ruído e
            perda de controle.
          </h2>
        </Reveal>
        <div className="mt-10 overflow-x-auto">
          <table className="w-full border-collapse text-sm md:text-[15px]">
            <thead>
              <tr>
                <th className="border-b-2 border-[var(--ink)] px-4 py-3 text-left font-mono text-xs uppercase tracking-widest text-[var(--muted)]">
                  Sua dor hoje
                </th>
                <th className="border-b-2 border-[var(--ink)] px-4 py-3 text-left font-mono text-xs uppercase tracking-widest text-[var(--muted)]">
                  Como a Manfac responde
                </th>
              </tr>
            </thead>
            <tbody>
              {DORES.map((d) => (
                <tr key={d.dor}>
                  <td className="w-[38%] border-b border-[var(--border)] px-4 py-4 align-top font-semibold text-[var(--ink)]">
                    {d.dor}
                  </td>
                  <td className="border-b border-[var(--border)] px-4 py-4 align-top text-[var(--body-text)]">
                    {d.resposta}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Criar ComoFunciona.tsx (com ícones animados)**

Cada passo tem um ícone SVG customizado com a classe `icon-float` (delay escalonado, como o ServicosTeaser já faz):

```tsx
import Reveal from '../Reveal'
import { COMO_FUNCIONA } from '@/lib/content'

// Ícones por passo: mapa, prancheta, capacete, monitor, gráfico — linha laranja/azul da marca.
const ICONS = [
  // 01 Mapeamento inicial — pino de mapa sobre grade
  <svg key="i0" viewBox="0 0 32 32" fill="none" className="h-8 w-8">
    <rect x="4" y="6" width="24" height="20" rx="2" stroke="#00345e" strokeWidth="1.8" />
    <line x1="12" y1="6" x2="12" y2="26" stroke="#00345e" strokeWidth="1" opacity="0.4" />
    <line x1="20" y1="6" x2="20" y2="26" stroke="#00345e" strokeWidth="1" opacity="0.4" />
    <path d="M16 10c2.5 0 4.5 2 4.5 4.4 0 3.3-4.5 7.6-4.5 7.6s-4.5-4.3-4.5-7.6C11.5 12 13.5 10 16 10Z" fill="#f85e0b" />
    <circle cx="16" cy="14.4" r="1.6" fill="white" />
  </svg>,
  // 02 Plano operacional — prancheta com checks
  <svg key="i1" viewBox="0 0 32 32" fill="none" className="h-8 w-8">
    <rect x="7" y="5" width="18" height="23" rx="2" stroke="#00345e" strokeWidth="1.8" />
    <rect x="12" y="2.5" width="8" height="5" rx="1.5" fill="#1a4873" />
    <path d="M10.5 13l2 2 3.5-3.5" stroke="#f85e0b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="18" y1="13" x2="22" y2="13" stroke="#00345e" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M10.5 20l2 2 3.5-3.5" stroke="#f85e0b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="18" y1="20" x2="22" y2="20" stroke="#00345e" strokeWidth="1.5" strokeLinecap="round" />
  </svg>,
  // 03 Execução em campo — capacete
  <svg key="i2" viewBox="0 0 32 32" fill="none" className="h-8 w-8">
    <path d="M5 21a11 11 0 0 1 22 0" stroke="#00345e" strokeWidth="1.8" />
    <rect x="3" y="21" width="26" height="4" rx="2" fill="#f85e0b" />
    <rect x="14" y="8" width="4" height="7" rx="1.5" fill="#1a4873" />
  </svg>,
  // 04 Gestão e comunicação — monitor com barras
  <svg key="i3" viewBox="0 0 32 32" fill="none" className="h-8 w-8">
    <rect x="4" y="6" width="24" height="16" rx="2" stroke="#00345e" strokeWidth="1.8" />
    <rect x="9" y="14" width="3" height="5" rx="1" fill="#f85e0b" />
    <rect x="14.5" y="11" width="3" height="8" rx="1" fill="#f85e0b" opacity="0.7" />
    <rect x="20" y="9" width="3" height="10" rx="1" fill="#f85e0b" />
    <line x1="12" y1="27" x2="20" y2="27" stroke="#00345e" strokeWidth="1.8" strokeLinecap="round" />
    <line x1="16" y1="22" x2="16" y2="27" stroke="#00345e" strokeWidth="1.8" />
  </svg>,
  // 05 Melhoria contínua — setas em ciclo
  <svg key="i4" viewBox="0 0 32 32" fill="none" className="h-8 w-8">
    <path d="M25 16a9 9 0 1 1-3-6.7" stroke="#00345e" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M22 4l1 5.5L17.5 9" stroke="#f85e0b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <path d="M12.5 16.5l2.5 2.5 4.5-5" stroke="#f85e0b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>,
]

export default function ComoFunciona() {
  return (
    <section className="border-b border-[var(--border)] bg-[var(--surface)]">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <Reveal>
          <p className="text-center font-mono text-xs uppercase tracking-widest text-[var(--orange)]">
            Como funciona na prática
          </p>
          <h2 className="mt-3 text-center text-2xl font-bold leading-snug text-[var(--ink)] md:text-3xl">
            A operação Manfac, do diagnóstico à melhoria contínua.
          </h2>
        </Reveal>
        <div className="mx-auto mt-12 grid max-w-4xl gap-4">
          {COMO_FUNCIONA.map((p, i) => (
            <Reveal key={p.n} delay={i * 100}>
              <div className="flex items-start gap-5 rounded-2xl border border-[var(--border)] bg-[var(--background)] p-5 md:items-center">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--orange)] text-xs font-bold text-white">
                  {p.n}
                </span>
                <div className="icon-float shrink-0" style={{ animationDelay: `${i * 350}ms` }}>
                  {ICONS[i]}
                </div>
                <div>
                  <p className="font-semibold text-[var(--ink)]">{p.title}</p>
                  <p className="mt-0.5 text-sm text-[var(--muted)]">{p.description}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Lint e commit**

```bash
cd manfac-site && npm run lint && cd ..
git add manfac-site/components/home/Dores.tsx manfac-site/components/home/ComoFunciona.tsx
git commit -m "feat(manfac-site): seções Dores e Como Funciona da home v03 com ícones animados

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: Home parte 3 — Soluções/RecorrenteSpot, Diferenciais, Case, CTA final e montagem

**Files:**
- Create: `manfac-site/components/home/RecorrenteSpot.tsx`
- Create: `manfac-site/components/home/Diferenciais.tsx`
- Modify: `manfac-site/components/home/ServicosTeaser.tsx` (copy calibrada + links para rotas novas)
- Modify: `manfac-site/components/home/CaseTeaser.tsx` (título/CTA da spec, remover crítica a fornecedores)
- Modify: `manfac-site/components/Contato.tsx` (copy executiva do CTA final)
- Modify: `manfac-site/app/page.tsx` (ordem da seção 7 do relatório)

**Interfaces:**
- Consumes: `RECORRENTE_SPOT`, `DIFERENCIAIS_HOME` (Task 5); `Stats`, `Hero` (Task 6); `Dores`, `ComoFunciona` (Task 7). Links de serviço apontam para as rotas da Task 10 (`/servicos/obras-e-reformas`, `/servicos/novas-construcoes`, `/servicos/manutencao-predial`, `/servicos/hvac`) — 404 temporário até a Task 10, aceitável dentro do branch.
- Produces: home completa na ordem do relatório.

- [ ] **Step 1: Criar RecorrenteSpot.tsx (ícones animados próprios)**

```tsx
import Reveal from '../Reveal'
import { RECORRENTE_SPOT } from '@/lib/content'

// Ícone do recorrente: calendário com seta cíclica. Ícone do spot: raio/alvo pontual.
function RecorrenteIcon() {
  return (
    <svg viewBox="0 0 32 32" fill="none" className="h-9 w-9">
      <rect x="4" y="7" width="24" height="20" rx="2" stroke="#f85e0b" strokeWidth="1.8" />
      <line x1="4" y1="12.5" x2="28" y2="12.5" stroke="#f85e0b" strokeWidth="1.5" />
      <line x1="10" y1="4.5" x2="10" y2="9" stroke="#f85e0b" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="22" y1="4.5" x2="22" y2="9" stroke="#f85e0b" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M20.5 19.5a4.5 4.5 0 1 1-1.4-3.2" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M20.5 14.5v2.3h-2.3" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SpotIcon() {
  return (
    <svg viewBox="0 0 32 32" fill="none" className="h-9 w-9">
      <circle cx="16" cy="16" r="11" stroke="#00345e" strokeWidth="1.8" />
      <circle cx="16" cy="16" r="6.5" stroke="#00345e" strokeWidth="1.5" opacity="0.5" />
      <circle cx="16" cy="16" r="2.5" fill="#f85e0b" />
      <line x1="16" y1="2" x2="16" y2="7" stroke="#f85e0b" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="30" y1="16" x2="25" y2="16" stroke="#f85e0b" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function Item({ children, dark }: { children: string; dark?: boolean }) {
  return (
    <li className="flex items-start gap-3 text-sm">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--orange)]/15">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="#f85e0b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className={dark ? 'text-white/85' : 'text-[var(--body-text)]'}>{children}</span>
    </li>
  )
}

export default function RecorrenteSpot() {
  const { recorrente, spot } = RECORRENTE_SPOT
  return (
    <div className="mx-auto mt-10 grid max-w-6xl gap-5 px-6 pb-20 md:grid-cols-2">
      <Reveal>
        <div className="h-full rounded-2xl p-8" style={{ backgroundColor: 'var(--ink)' }}>
          <div className="icon-float inline-block"><RecorrenteIcon /></div>
          <p className="mt-4 font-mono text-xs uppercase tracking-widest text-[var(--orange)]">
            {recorrente.tagline}
          </p>
          <h3 className="mt-2 text-lg font-bold text-white">{recorrente.title}</h3>
          <ul className="mt-4 space-y-3">
            {recorrente.items.map((item) => (
              <Item key={item} dark>{item}</Item>
            ))}
          </ul>
        </div>
      </Reveal>
      <Reveal delay={140}>
        <div className="h-full rounded-2xl border border-[var(--border)] bg-[var(--background)] p-8">
          <div className="icon-float inline-block" style={{ animationDelay: '350ms' }}><SpotIcon /></div>
          <p className="mt-4 font-mono text-xs uppercase tracking-widest text-[var(--muted)]">
            {spot.tagline}
          </p>
          <h3 className="mt-2 text-lg font-bold text-[var(--ink)]">{spot.title}</h3>
          <ul className="mt-4 space-y-3">
            {spot.items.map((item) => (
              <Item key={item}>{item}</Item>
            ))}
          </ul>
        </div>
      </Reveal>
    </div>
  )
}
```

- [ ] **Step 2: Criar Diferenciais.tsx (pills com ícone animado)**

```tsx
import Reveal from '../Reveal'
import { DIFERENCIAIS_HOME } from '@/lib/content'

// Um ícone pequeno por diferencial: capacete, escudo, documento, alvo, prédios.
const ICONS = [
  <svg key="d0" viewBox="0 0 20 20" fill="none" className="h-5 w-5">
    <path d="M3.5 13a6.5 6.5 0 0 1 13 0" stroke="#f85e0b" strokeWidth="1.6" />
    <rect x="2" y="13" width="16" height="2.6" rx="1.3" fill="#f85e0b" />
    <rect x="8.7" y="5" width="2.6" height="4.5" rx="1" fill="#00345e" />
  </svg>,
  <svg key="d1" viewBox="0 0 20 20" fill="none" className="h-5 w-5">
    <path d="M10 2.5l6 2.2v4.5c0 3.7-2.6 6.6-6 8.3-3.4-1.7-6-4.6-6-8.3V4.7l6-2.2Z" stroke="#00345e" strokeWidth="1.6" strokeLinejoin="round" />
    <path d="M7 10l2 2 4-4.5" stroke="#f85e0b" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>,
  <svg key="d2" viewBox="0 0 20 20" fill="none" className="h-5 w-5">
    <rect x="4" y="2.5" width="12" height="15" rx="1.5" stroke="#00345e" strokeWidth="1.6" />
    <line x1="7" y1="7" x2="13" y2="7" stroke="#f85e0b" strokeWidth="1.4" strokeLinecap="round" />
    <line x1="7" y1="10.5" x2="13" y2="10.5" stroke="#f85e0b" strokeWidth="1.4" strokeLinecap="round" />
    <line x1="7" y1="14" x2="10.5" y2="14" stroke="#f85e0b" strokeWidth="1.4" strokeLinecap="round" />
  </svg>,
  <svg key="d3" viewBox="0 0 20 20" fill="none" className="h-5 w-5">
    <circle cx="10" cy="10" r="7" stroke="#00345e" strokeWidth="1.6" />
    <circle cx="10" cy="10" r="2" fill="#f85e0b" />
    <line x1="10" y1="1.5" x2="10" y2="4.5" stroke="#f85e0b" strokeWidth="1.6" strokeLinecap="round" />
  </svg>,
  <svg key="d4" viewBox="0 0 20 20" fill="none" className="h-5 w-5">
    <rect x="2.5" y="8" width="6.5" height="9.5" rx="1" stroke="#00345e" strokeWidth="1.6" />
    <rect x="11" y="4" width="6.5" height="13.5" rx="1" stroke="#f85e0b" strokeWidth="1.6" />
    <line x1="5.75" y1="11" x2="5.75" y2="14" stroke="#f85e0b" strokeWidth="1.4" strokeLinecap="round" />
    <line x1="14.25" y1="8" x2="14.25" y2="14" stroke="#00345e" strokeWidth="1.4" strokeLinecap="round" />
  </svg>,
]

export default function Diferenciais() {
  return (
    <section className="border-y border-[var(--border)]">
      <div className="mx-auto max-w-6xl px-6 py-20 text-center">
        <Reveal>
          <p className="font-mono text-xs uppercase tracking-widest text-[var(--orange)]">
            Por que a Manfac
          </p>
          <h2 className="mt-3 text-2xl font-bold leading-snug text-[var(--ink)] md:text-3xl">
            Equipe própria. Ponto único de responsabilidade.
          </h2>
        </Reveal>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          {DIFERENCIAIS_HOME.map((d, i) => (
            <Reveal key={d} delay={i * 80}>
              <span className="inline-flex items-center gap-2.5 rounded-full border border-[var(--border)] bg-[var(--background)] px-5 py-2.5 text-sm font-semibold text-[var(--ink)]">
                <span className="icon-float inline-flex" style={{ animationDelay: `${i * 300}ms` }}>
                  {ICONS[i]}
                </span>
                {d}
              </span>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Atualizar ServicosTeaser.tsx**

No array `SERVICOS_HOME` (os 4 ícones grandes existentes ficam intocados):

1. Descrição de "Obras e Reformas Corporativas" → `'Reformas corporativas de diferentes portes, com planejamento, equipe técnica e gestão próxima — sem paralisar sua operação.'`
2. Descrição de "Novas Construções" → `'Do projeto à entrega das chaves com cronograma real, custo sob controle e comunicação recorrente em cada etapa.'` (remove "Sem surpresas no meio do caminho")
3. Links: trocar `href={`/servicos#${servico.slug}`}` por `href={`/servicos/${servico.slug}`}` e atualizar os slugs no array para os das rotas novas: `obras-e-reformas`, `novas-construcoes`, `manutencao-predial`, `hvac`.
4. Título da seção → `Da manutenção recorrente às obras spot. Um único ponto de responsabilidade.`

- [ ] **Step 4: Atualizar CaseTeaser.tsx**

1. H2: `De Ponto Crítico à Operação Referência` → `400+ unidades de um dos maiores varejistas farmacêuticos do Brasil, sob gestão Manfac.`
2. O parágrafo `Após 7 anos com fornecedores sem padrão, a Manfac assumiu a operação do Rio de Janeiro e virou referência reconhecida no estado.` → `Uma operação fragmentada transformada em referência: +1.000 OS/mês com 100% das demandas concluídas mensalmente.`
3. Link final: `Ver o case completo →` → botão CTA (mesmas classes do link atual, texto novo): `Ver como estruturamos essa operação →`

- [ ] **Step 5: Atualizar Contato.tsx (CTA final executivo)**

1. H2: `Pronto para ter sua operação<br /><span ...>sob controle?</span>` → `Vamos entender<br /><span className="text-[var(--orange)]">sua operação?</span>`
2. Parágrafo: `Fale com a gente e descubra como a Manfac transforma sua gestão predial em vantagem competitiva.` → `Conte como funciona sua operação hoje — unidades, volume de demandas e principais dores. Retornamos com uma leitura técnica.`
3. Texto do botão não-standalone: `FALE COM A GENTE` → `AGENDAR CONVERSA TÉCNICA`. (O modo `standalone` deixa de ser usado após a Task 9 — não mexer nele aqui.)

- [ ] **Step 6: Montar a home na ordem do relatório**

Substituir `manfac-site/app/page.tsx`:

```tsx
import Header from '@/components/Header'
import Hero from '@/components/Hero'
import Stats from '@/components/Stats'
import Dores from '@/components/home/Dores'
import ComoFunciona from '@/components/home/ComoFunciona'
import ServicosTeaser from '@/components/home/ServicosTeaser'
import RecorrenteSpot from '@/components/home/RecorrenteSpot'
import CaseTeaser from '@/components/home/CaseTeaser'
import Diferenciais from '@/components/home/Diferenciais'
import Contato from '@/components/Contato'
import Footer from '@/components/Footer'

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Stats />
        <Dores />
        <ComoFunciona />
        <ServicosTeaser />
        <RecorrenteSpot />
        <CaseTeaser />
        <Diferenciais />
        <Contato />
      </main>
      <Footer />
    </>
  )
}
```

`QuemSomosTeaser` sai da home (arquivo permanece, sem import morto). Nota: `RecorrenteSpot` renderiza logo após `ServicosTeaser` — como o ServicosTeaser fecha com fundo `--surface`, envolver o `RecorrenteSpot` numa `<section className="bg-[var(--surface)] border-b border-[var(--border)]">` na própria page OU dar esse fundo no componente; conferir visualmente que não há "quebra" de fundo entre as duas partes da seção Soluções.

- [ ] **Step 7: Verificação visual completa da home**

```bash
cd manfac-site && npm run dev
```
Conferir contra o mockup: ordem das 8 seções, ícones flutuando, tabela de dores, cards recorrente/spot (escuro/claro), case teaser com título novo, pills de diferenciais, CTA final "Vamos entender sua operação?". Testar largura mobile (DevTools). Ctrl+C.

- [ ] **Step 8: Lint, testes e commit**

```bash
cd manfac-site && npm run lint && cd ..
npm test -- manfac-site
git add manfac-site/components/home/ manfac-site/components/Contato.tsx manfac-site/app/page.tsx
git commit -m "feat(manfac-site): home v03 na ordem do relatório com seções novas e ícones animados

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: Página de contato — formulário de qualificação em 2 etapas → WhatsApp

**Files:**
- Create: `manfac-site/components/ContactForm.tsx`
- Modify: `manfac-site/app/contato/page.tsx`
- Test: `manfac-site/components/__tests__/ContactForm.test.tsx` (criar)

**Interfaces:**
- Consumes: `buildWhatsAppUrl`, `type DemandPath` de `@/lib/whatsapp` (Task 2).
- Produces: `ContactForm()` client component sem props.

- [ ] **Step 1: Write the failing test**

Criar `manfac-site/components/__tests__/ContactForm.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ContactForm from '../ContactForm'

describe('ContactForm', () => {
  it('mostra os 3 caminhos e esconde o formulário até escolher', () => {
    render(<ContactForm />)
    expect(screen.getByRole('button', { name: /manutenção recorrente/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /obra ou reforma/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /avaliação técnica/i })).toBeInTheDocument()
    expect(screen.queryByLabelText(/nome/i)).not.toBeInTheDocument()
  })

  it('mostra o formulário após escolher caminho; nº de unidades só no recorrente', async () => {
    const user = userEvent.setup()
    render(<ContactForm />)
    await user.click(screen.getByRole('button', { name: /obra ou reforma/i }))
    expect(screen.getByLabelText(/^nome$/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/unidades/i)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /manutenção recorrente/i }))
    expect(screen.getByLabelText(/nº de unidades/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Na raiz: `npm test -- ContactForm`
Expected: FAIL — "Cannot find module '../ContactForm'".

- [ ] **Step 3: Write implementation**

Criar `manfac-site/components/ContactForm.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { buildWhatsAppUrl, type DemandPath } from '@/lib/whatsapp'

const PATHS: { path: DemandPath; description: string }[] = [
  {
    path: 'Manutenção recorrente',
    description: 'Contrato mensal com SLA, equipe, rotina de chamados e relatórios para suas unidades.',
  },
  {
    path: 'Obra ou reforma',
    description: 'Projeto pontual com escopo fechado, cronograma, orçamento e entrega técnica.',
  },
  {
    path: 'Avaliação técnica',
    description: 'Leitura técnica da sua operação atual para identificar riscos e oportunidades.',
  },
]

const inputCls =
  'min-h-11 rounded-lg border border-[var(--border)] bg-white px-3.5 py-3 text-[15px] text-[var(--body-text)] outline-none focus:border-[var(--orange)] focus:ring-2 focus:ring-[var(--orange)]/30'
const labelCls = 'text-[13px] font-semibold text-[var(--ink)]'

export default function ContactForm() {
  const [path, setPath] = useState<DemandPath | null>(null)

  function handleSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault()
    if (!path) return
    const f = new FormData(ev.currentTarget)
    const url = buildWhatsAppUrl({
      path,
      nome: String(f.get('nome') ?? ''),
      empresa: String(f.get('empresa') ?? ''),
      email: String(f.get('email') ?? ''),
      telefone: String(f.get('telefone') ?? ''),
      cargo: String(f.get('cargo') ?? '') || undefined,
      localidade: String(f.get('localidade') ?? ''),
      unidades: String(f.get('unidades') ?? '') || undefined,
      resumo: String(f.get('resumo') ?? '') || undefined,
    })
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <section className="border-b border-[var(--border)]">
      <div className="mx-auto max-w-4xl px-6 py-20 text-center md:py-28">
        <p className="font-mono text-xs uppercase tracking-widest text-[var(--orange)]">Contato</p>
        <h1 className="mt-3 text-3xl font-bold leading-tight text-[var(--ink)] md:text-4xl">
          Qual é a sua demanda?
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-[var(--muted)]">
          Escolha o caminho — leva menos de 1 minuto e sua mensagem já chega qualificada.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-3" role="group" aria-label="Tipo de demanda">
          {PATHS.map((p) => (
            <button
              key={p.path}
              type="button"
              aria-pressed={path === p.path}
              onClick={() => setPath(p.path)}
              className={`rounded-2xl border-2 p-5 text-left transition-shadow ${
                path === p.path
                  ? 'border-[var(--orange)] shadow-[0_0_0_3px_rgba(248,94,11,0.15)]'
                  : 'border-[var(--border)] hover:shadow-md'
              }`}
            >
              <span className="block font-bold text-[var(--ink)]">{p.path}</span>
              <span className="mt-1.5 block text-[13px] leading-relaxed text-[var(--muted)]">
                {p.description}
              </span>
            </button>
          ))}
        </div>

        {path && (
          <form onSubmit={handleSubmit} className="mt-8 grid gap-4 text-left md:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ct-nome" className={labelCls}>Nome</label>
              <input id="ct-nome" name="nome" required placeholder="Seu nome" className={inputCls} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ct-empresa" className={labelCls}>Empresa</label>
              <input id="ct-empresa" name="empresa" required placeholder="Nome da empresa" className={inputCls} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ct-email" className={labelCls}>E-mail corporativo</label>
              <input id="ct-email" name="email" type="email" required placeholder="nome@empresa.com.br" className={inputCls} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ct-telefone" className={labelCls}>Telefone / WhatsApp</label>
              <input id="ct-telefone" name="telefone" type="tel" required placeholder="(21) 9 9999-9999" className={inputCls} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ct-cargo" className={labelCls}>
                Cargo <span className="font-normal text-[var(--muted)]">(opcional)</span>
              </label>
              <input id="ct-cargo" name="cargo" placeholder="Ex.: Gerente de Facilities" className={inputCls} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ct-localidade" className={labelCls}>Localidade das unidades</label>
              <input id="ct-localidade" name="localidade" required placeholder="Ex.: RJ capital e Baixada" className={inputCls} />
            </div>
            {path === 'Manutenção recorrente' && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="ct-unidades" className={labelCls}>Nº de unidades</label>
                <select id="ct-unidades" name="unidades" className={inputCls} defaultValue="">
                  <option value="" disabled>Selecione…</option>
                  <option>1 a 10</option>
                  <option>11 a 50</option>
                  <option>51 a 200</option>
                  <option>200+</option>
                </select>
              </div>
            )}
            <div className="flex flex-col gap-1.5 md:col-span-2">
              <label htmlFor="ct-resumo" className={labelCls}>
                Resumo da demanda <span className="font-normal text-[var(--muted)]">(opcional)</span>
              </label>
              <textarea
                id="ct-resumo"
                name="resumo"
                rows={3}
                placeholder="Ex.: rede com 30 lojas, manutenção fragmentada em 4 fornecedores…"
                className={inputCls}
              />
            </div>
            <div className="flex flex-wrap items-center gap-5 md:col-span-2">
              <button
                type="submit"
                className="rounded-full bg-[var(--orange)] px-8 py-3.5 font-semibold uppercase tracking-wider text-white transition-colors hover:bg-[var(--orange-hover)]"
              >
                Agendar conversa técnica
              </button>
              <p className="text-xs leading-relaxed text-[var(--muted)]">
                Abre no seu WhatsApp · Resposta em até 1 dia útil
                <br />
                Prefere e-mail?{' '}
                <a href="mailto:contato@manfac.com.br" className="underline">contato@manfac.com.br</a>
              </p>
            </div>
          </form>
        )}
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Na raiz: `npm test -- ContactForm`
Expected: PASS (2 testes).

- [ ] **Step 5: Usar na página de contato**

Substituir `manfac-site/app/contato/page.tsx`:

```tsx
// manfac-site/app/contato/page.tsx
import type { Metadata } from 'next'
import Header from '@/components/Header'
import ContactForm from '@/components/ContactForm'
import Footer from '@/components/Footer'

export const metadata: Metadata = {
  title: 'Contato — Manfac Engenharia',
  description:
    'Agende uma conversa técnica com a Manfac: manutenção predial recorrente, obras e reformas corporativas ou avaliação técnica da sua operação.',
}

export default function ContatoPage() {
  return (
    <>
      <Header />
      <main>
        <ContactForm />
      </main>
      <Footer />
    </>
  )
}
```

- [ ] **Step 6: Verificação manual do fluxo**

`cd manfac-site && npm run dev` → http://localhost:3000/contato → escolher "Manutenção recorrente", preencher, enviar → deve abrir nova aba `wa.me/5521999999999?text=...` com a mensagem estruturada legível. Ctrl+C.

- [ ] **Step 7: Lint e commit**

```bash
cd manfac-site && npm run lint && cd ..
git add manfac-site/components/ContactForm.tsx manfac-site/components/__tests__/ContactForm.test.tsx manfac-site/app/contato/page.tsx
git commit -m "feat(manfac-site): formulário de qualificação em 2 etapas com envio via WhatsApp

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 10: Quatro páginas de serviço + hub /servicos + dropdown do Header

**Files:**
- Create: `manfac-site/lib/servicos.ts`
- Create: `manfac-site/components/ServicePage.tsx`
- Create: `manfac-site/app/servicos/[slug]/page.tsx`
- Modify: `manfac-site/components/Servicos.tsx` (vira hub; remove seções longas)
- Modify: `manfac-site/components/Header.tsx` (dropdown → rotas novas)

**Interfaces:**
- Consumes: `Counter` (Task 1), `Contato` (CTA), fotos `v03-*` (Task 4).
- Produces:
  - `SERVICOS_DATA: ServicoData[]` e `getServico(slug: string): ServicoData | undefined` em `lib/servicos.ts`, com `type ServicoData = { slug: string; nome: string; headline: string; sub: string; paraQuem: string; dores: string; escopo: string[]; comoExecutamos: string; indicadores: { value: string; label: string }[]; recorrente: string; spot: string; foto: string; fotoAlt: string; metaTitle: string; metaDescription: string }`
  - Rotas `/servicos/obras-e-reformas`, `/servicos/novas-construcoes`, `/servicos/manutencao-predial`, `/servicos/hvac`.

- [ ] **Step 1: Criar lib/servicos.ts com o conteúdo completo dos 4 serviços**

```ts
export type ServicoData = {
  slug: string
  nome: string
  headline: string
  sub: string
  paraQuem: string
  dores: string
  escopo: string[]
  comoExecutamos: string
  indicadores: { value: string; label: string }[]
  recorrente: string
  spot: string
  foto: string
  fotoAlt: string
  metaTitle: string
  metaDescription: string
}

export const SERVICOS_DATA: ServicoData[] = [
  {
    slug: 'obras-e-reformas',
    nome: 'Obras e Reformas Corporativas',
    headline: 'Obras e reformas corporativas com escopo, cronograma, equipe própria e acompanhamento de ponta a ponta.',
    sub: 'Reformas corporativas de diferentes portes, com planejamento, equipe técnica e gestão próxima — sem paralisar a operação do cliente.',
    paraQuem: 'Empresas com unidades corporativas, redes de varejo, escritórios, galpões e hospitais que precisam reformar, adequar ou expandir sem interromper a operação.',
    dores: 'Obra atrasada sem explicação · custo que estoura sem aviso · operação paralisada durante a execução · vários responsáveis e nenhum dono do resultado.',
    escopo: [
      'Reformas de layout, fachada e adequação civil',
      'Expansão de unidades e retrofit predial',
      'Cumprimento de normas técnicas e exigências legais',
      'Relatório semanal de andamento — sem precisar pedir',
      'Um ponto de contato responsável do início à entrega',
    ],
    comoExecutamos: 'Planejamento com escopo fechado, cronograma real e orçamento definido; execução com equipe própria e supervisão técnica; comunicação recorrente com registro fotográfico até a entrega.',
    indicadores: [
      { value: '+R$800 mil', label: 'em obras e reformas por mês' },
      { value: '400+', label: 'unidades atendidas no RJ' },
    ],
    recorrente: 'Pequenas adequações e reparos contínuos podem entrar na rotina do contrato mensal de manutenção.',
    spot: 'Reformas, expansões e adequações maiores viram proposta técnica avulsa, com escopo, cronograma e orçamento fechados.',
    foto: '/media/v03-obra-corporativa.jpg',
    fotoAlt: 'Obra corporativa em execução com estrutura e andaimes',
    metaTitle: 'Obras e Reformas Corporativas — Manfac Engenharia',
    metaDescription: 'Obras e reformas corporativas com escopo fechado, cronograma, equipe própria e acompanhamento de ponta a ponta, sem paralisar sua operação.',
  },
  {
    slug: 'novas-construcoes',
    nome: 'Novas Construções',
    headline: 'Do zero à entrega das chaves — prazo e custo sob controle.',
    sub: 'Gestão completa de novas construções: do planejamento à entrega, com equipe técnica própria em campo, cronograma real e comunicação recorrente.',
    paraQuem: 'Empresas que precisam construir novas unidades, centros de distribuição ou instalações corporativas com um único responsável técnico do projeto à entrega.',
    dores: 'Projetos que mudam de mão no meio do caminho · orçamento sem dono · cronograma que ninguém audita · entrega sem documentação.',
    escopo: [
      'Gestão completa do projeto de engenharia',
      'Equipe técnica própria com gestão centralizada',
      'Controle rigoroso de cronograma e custo',
      'Visibilidade do andamento em tempo real',
      'Entrega com documentação e comissionamento',
    ],
    comoExecutamos: 'Planejamento executivo com marcos de entrega; execução com equipe própria e supervisão de engenharia; reuniões de status, cronograma atualizado e evidências de campo em cada fase.',
    indicadores: [
      { value: '+R$800 mil', label: 'em obras executadas por mês' },
      { value: '100%', label: 'das demandas concluídas no mês' },
    ],
    recorrente: 'Após a entrega, a manutenção preventiva da nova unidade pode entrar direto no contrato mensal.',
    spot: 'A construção em si é sempre um projeto spot: escopo fechado, cronograma, orçamento e entrega técnica documentada.',
    foto: '/media/v03-equipe-obra.jpg',
    fotoAlt: 'Equipe de construção trabalhando em estrutura de edifício',
    metaTitle: 'Novas Construções — Manfac Engenharia',
    metaDescription: 'Gestão e execução de novas construções do planejamento à entrega das chaves, com equipe própria, cronograma real e custo sob controle.',
  },
  {
    slug: 'manutencao-predial',
    nome: 'Manutenção Predial Preventiva e Corretiva',
    headline: 'Manutenção predial para redes e grandes operações, com SLA, equipe técnica e visibilidade mensal dos chamados.',
    sub: 'Menos emergências, mais previsibilidade — equipe técnica própria, rotina de chamados e relatório mensal de cada demanda.',
    paraQuem: 'Redes varejistas, operações corporativas e ambientes críticos com múltiplas unidades que precisam de previsibilidade, padrão técnico e um único responsável pela manutenção.',
    dores: 'Emergências recorrentes · fornecedores sem padrão · falta de visibilidade sobre chamados · custo imprevisível mês a mês.',
    escopo: [
      'Plano de manutenção preventiva customizado',
      'Atendimento corretivo com SLA definido em contrato',
      'Cobertura de elétrica, hidráulica, civil e pequenos reparos',
      'Registro fotográfico e evidência por chamado',
      'Relatório mensal de demandas e status de cada chamado',
    ],
    comoExecutamos: 'Mapeamento das unidades e histórico; rotina preventiva programada; corretiva com SLA e priorização por criticidade; relatório mensal com análise de recorrência para reduzir emergências.',
    indicadores: [
      { value: '+1.000', label: 'ordens de serviço por mês' },
      { value: '100%', label: 'das demandas concluídas no mês' },
      { value: '400+', label: 'unidades sob gestão no RJ' },
    ],
    recorrente: 'É o coração do contrato mensal: preventiva, corretiva e emergencial com SLA, equipe e relatórios.',
    spot: 'Intervenções fora do escopo contratual — trocas de grande porte, adequações — viram proposta técnica específica.',
    foto: '/media/v03-tecnico-campo.jpg',
    fotoAlt: 'Técnico de manutenção uniformizado trabalhando em campo',
    metaTitle: 'Manutenção Predial para Redes e Grandes Operações — Manfac Engenharia',
    metaDescription: 'Manutenção predial preventiva e corretiva com SLA, equipe técnica própria e visibilidade mensal dos chamados para redes e grandes operações.',
  },
  {
    slug: 'hvac',
    nome: 'Sistemas de Climatização (HVAC)',
    headline: 'Climatização funcionando. Energia dentro do orçamento.',
    sub: 'Instalação, manutenção e gestão de sistemas HVAC com plano preventivo dedicado e técnicos especializados.',
    paraQuem: 'Operações onde climatização parada significa perda direta: lojas, escritórios, ambientes técnicos e áreas de atendimento ao público.',
    dores: 'Sistema parado em horário de pico · conta de energia fora do controle · manutenção só quando quebra · fornecedor sem especialização.',
    escopo: [
      'Instalação de sistemas split, VRF e centrais de ar',
      'Manutenção preventiva com periodicidade definida',
      'Higienização e limpeza técnica',
      'Monitoramento de performance e consumo',
      'Atendimento de urgência com SLA garantido',
    ],
    comoExecutamos: 'Diagnóstico do parque instalado; plano preventivo com periodicidade por equipamento; execução por técnicos especializados com registro por visita; acompanhamento de consumo e performance.',
    indicadores: [
      { value: '400+', label: 'unidades atendidas no RJ' },
      { value: '100%', label: 'das demandas concluídas no mês' },
    ],
    recorrente: 'Plano preventivo de HVAC entra no contrato mensal com periodicidade e SLA definidos.',
    spot: 'Instalações novas, substituição de equipamentos e retrofits de climatização viram proposta técnica avulsa.',
    foto: '/media/v03-hvac.jpg',
    fotoAlt: 'Equipamentos de climatização em casa de máquinas',
    metaTitle: 'Sistemas de Climatização HVAC — Manfac Engenharia',
    metaDescription: 'Instalação, manutenção e gestão de sistemas de climatização HVAC com plano preventivo dedicado, técnicos especializados e SLA garantido.',
  },
]

export function getServico(slug: string): ServicoData | undefined {
  return SERVICOS_DATA.find((s) => s.slug === slug)
}
```

- [ ] **Step 2: Criar o template ServicePage.tsx**

```tsx
import Image from 'next/image'
import Reveal from './Reveal'
import Contato from './Contato'
import type { ServicoData } from '@/lib/servicos'

function Check() {
  return (
    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--orange)]/10">
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
        <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="#f85e0b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}

export default function ServicePage({ servico }: { servico: ServicoData }) {
  return (
    <>
      {/* Hero */}
      <section className="relative isolate overflow-hidden border-b border-[var(--border)] text-white">
        <Image
          src={servico.foto}
          alt={servico.fotoAlt}
          fill
          priority
          className="object-cover object-center"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-[var(--ink)]/78" />
        <div className="relative mx-auto max-w-5xl px-6 py-24 text-center md:py-32">
          <Reveal>
            <p className="mb-4 font-mono text-xs uppercase tracking-widest text-[var(--orange)]">
              Serviços · {servico.nome}
            </p>
            <h1 className="mx-auto max-w-3xl text-3xl font-bold leading-tight tracking-tight md:text-5xl">
              {servico.headline}
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-white/85">{servico.sub}</p>
            <a
              href="/contato"
              className="mt-9 inline-flex items-center gap-2 rounded-full bg-[var(--orange)] px-7 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--orange-hover)]"
            >
              Solicitar proposta técnica
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3 7h8M7.5 4l3.5 3-3.5 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          </Reveal>
        </div>
      </section>

      {/* Para quem é / dores / escopo */}
      <section className="border-b border-[var(--border)]">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="grid gap-12 md:grid-cols-2">
            <Reveal>
              <p className="font-mono text-xs uppercase tracking-widest text-[var(--orange)]">Para quem é</p>
              <h2 className="mt-3 text-2xl font-bold leading-snug text-[var(--ink)]">{servico.paraQuem}</h2>
              <p className="mt-6 font-mono text-xs uppercase tracking-widest text-[var(--orange)]">Dores que resolve</p>
              <p className="mt-3 text-[var(--body-text)]">{servico.dores}</p>
            </Reveal>
            <Reveal delay={140}>
              <p className="font-mono text-xs uppercase tracking-widest text-[var(--orange)]">Escopo</p>
              <ul className="mt-4 space-y-3">
                {servico.escopo.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <Check />
                    <span className="text-sm text-[var(--body-text)]">{item}</span>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Como executamos + indicadores */}
      <section className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="grid gap-12 md:grid-cols-2 md:items-center">
            <Reveal>
              <p className="font-mono text-xs uppercase tracking-widest text-[var(--orange)]">Como executamos</p>
              <p className="mt-4 text-lg leading-relaxed text-[var(--body-text)]">{servico.comoExecutamos}</p>
              <div className="mt-8 flex flex-wrap gap-8">
                {servico.indicadores.map((ind) => (
                  <div key={ind.label}>
                    <p className="text-2xl font-bold text-[var(--orange)]">{ind.value}</p>
                    <p className="mt-0.5 text-xs text-[var(--muted)]">{ind.label}</p>
                  </div>
                ))}
              </div>
            </Reveal>
            <Reveal delay={140}>
              <div className="relative aspect-[4/3] overflow-hidden rounded-2xl">
                <Image
                  src={servico.foto}
                  alt={servico.fotoAlt}
                  fill
                  className="object-cover object-center"
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Contrato vs. spot */}
      <section className="border-b border-[var(--border)]">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <Reveal>
            <p className="text-center font-mono text-xs uppercase tracking-widest text-[var(--orange)]">
              Como contratar
            </p>
          </Reveal>
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            <Reveal>
              <div className="h-full rounded-2xl p-7" style={{ backgroundColor: 'var(--ink)' }}>
                <p className="font-mono text-xs uppercase tracking-widest text-[var(--orange)]">Contrato recorrente</p>
                <p className="mt-3 text-white/85">{servico.recorrente}</p>
              </div>
            </Reveal>
            <Reveal delay={140}>
              <div className="h-full rounded-2xl border border-[var(--border)] p-7">
                <p className="font-mono text-xs uppercase tracking-widest text-[var(--muted)]">Demanda spot</p>
                <p className="mt-3 text-[var(--body-text)]">{servico.spot}</p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <Contato />
    </>
  )
}
```

- [ ] **Step 3: Criar a rota dinâmica**

Antes de criar, conferir a assinatura de `generateStaticParams`/`params` para esta versão de Next em `manfac-site/node_modules/next/dist/docs/` (em Next 15+ `params` é Promise — validar no doc local). Criar `manfac-site/app/servicos/[slug]/page.tsx`:

```tsx
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import ServicePage from '@/components/ServicePage'
import { SERVICOS_DATA, getServico } from '@/lib/servicos'

export function generateStaticParams() {
  return SERVICOS_DATA.map((s) => ({ slug: s.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const servico = getServico(slug)
  if (!servico) return {}
  return {
    title: servico.metaTitle,
    description: servico.metaDescription,
    openGraph: { title: servico.metaTitle, description: servico.metaDescription },
  }
}

export default async function ServicoRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const servico = getServico(slug)
  if (!servico) notFound()
  return (
    <>
      <Header />
      <main>
        <ServicePage servico={servico} />
      </main>
      <Footer />
    </>
  )
}
```

(Se o doc local mostrar `params` síncrono nesta versão custom, ajustar para a assinatura documentada.)

- [ ] **Step 4: /servicos vira hub**

Reescrever `manfac-site/components/Servicos.tsx`: manter o hero atual (imagem, título — trocando `Uma equipe. Zero intermediário.` por `Uma equipe. Um único ponto de responsabilidade.`) e substituir as 4 seções longas por um grid de 4 cards-resumo. Cada card: `id` igual ao slug antigo da âncora (`obras-reformas`, `novas-construcoes`, `manutencao-predial`, `hvac` — para links `#hash` antigos não quebrarem), nome, uma frase (usar `sub` de `SERVICOS_DATA`), e link `Conhecer o serviço →` para `/servicos/<slug>`. As pílulas do hero passam a linkar direto para as rotas novas. Importar `SERVICOS_DATA` de `@/lib/servicos` como fonte única (remover o array local `SERVICOS_PAGE`).

- [ ] **Step 5: Dropdown do Header → rotas novas**

Em `manfac-site/components/Header.tsx`, atualizar `SERVICOS_DROPDOWN`:

```tsx
const SERVICOS_DROPDOWN = [
  { href: '/servicos/obras-e-reformas', label: 'Obras e Reformas Corporativas' },
  { href: '/servicos/novas-construcoes', label: 'Novas Construções' },
  { href: '/servicos/manutencao-predial', label: 'Manutenção Predial' },
  { href: '/servicos/hvac', label: 'Sistemas de Climatização (HVAC)' },
]
```

Verificar que não sobrou nenhum link interno com `#`: `grep -rn "servicos#" manfac-site --include=*.tsx` → esperado: nenhuma linha.

- [ ] **Step 6: Verificação manual**

`cd manfac-site && npm run dev` → visitar as 4 rotas + /servicos; conferir hero, checklist, indicadores, cards de contratação, CTA. Ctrl+C.

- [ ] **Step 7: Lint, testes e commit**

```bash
cd manfac-site && npm run lint && npm run build && cd ..
npm test -- manfac-site
git add manfac-site/lib/servicos.ts manfac-site/components/ServicePage.tsx manfac-site/app/servicos/ manfac-site/components/Servicos.tsx manfac-site/components/Header.tsx
git commit -m "feat(manfac-site): páginas individuais de serviço com hub e dropdown atualizado

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 11: Página Resultados — copy suavizada

**Files:**
- Modify: `manfac-site/components/Resultados.tsx`

**Interfaces:**
- Consumes: `Counter` já corrigido (Task 1) — nenhuma mudança de contador aqui.
- Produces: página Resultados com tom factual.

- [ ] **Step 1: Suavizar as frases sobre fornecedores**

Em `manfac-site/components/Resultados.tsx`:

1. H2 do Desafio: `7 anos com fornecedores sem padrão. Isso tinha que mudar.` → `Uma operação fragmentada que precisava de estrutura — e ganhou.`
2. No card "Escala da operação", o item `{ value: '7 anos', label: 'de histórico com fornecedores sem padrão' }` → `{ value: '7 anos', label: 'de operação fragmentada antes da Manfac' }`
3. No parágrafo do Desafio, manter a descrição factual (a frase atual já usa "fragmentada" — revisar que nada soe como crítica direta a fornecedores nomeáveis; trocar `sem padronização, sem comunicação e sem rastreabilidade` por `sem padronização de processos, comunicação centralizada ou rastreabilidade` se necessário para suavizar).

- [ ] **Step 2: Verificação e commit**

```bash
grep -n "tinha que mudar" manfac-site/components/Resultados.tsx
```
Expected: nenhuma linha.

```bash
cd manfac-site && npm run lint && cd ..
git add manfac-site/components/Resultados.tsx
git commit -m "fix(manfac-site): tom factual na página Resultados, sem crítica a fornecedores anteriores

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 12: Quem Somos (posicionamento 8.1) + varredura global de copy

**Files:**
- Modify: `manfac-site/components/QuemSomos.tsx`
- Modify: quaisquer arquivos que o grep do Step 2 apontar

**Interfaces:**
- Consumes: nada novo.
- Produces: posicionamento institucional aplicado; zero ocorrência dos termos banidos.

- [ ] **Step 1: Posicionamento institucional no Quem Somos**

Em `manfac-site/components/QuemSomos.tsx`, inserir (ou substituir o parágrafo de abertura por) o posicionamento da seção 8.1 do relatório, como primeiro parágrafo do bloco inicial:

```
A Manfac é uma empresa de engenharia especializada em manutenção predial, obras e reformas corporativas para grandes operações. Atuamos com equipe própria, gestão ativa e visibilidade em campo para empresas que precisam de previsibilidade, padrão técnico e resposta rápida em múltiplas unidades.
```

Ajustar o parágrafo seguinte se ficar redundante (evitar repetir "equipe própria" duas vezes em sequência).

- [ ] **Step 2: Varredura global dos termos banidos**

```bash
grep -rinE "diagnóstico gratuito|qualquer escala|zero intermediário|sem surpresas|zero chamado|sem subempreiteiros" manfac-site --include=*.tsx --include=*.ts | grep -v node_modules | grep -v __tests__
```

Para cada ocorrência, aplicar a substituição da tabela da spec (frente 7):
- `Solicitar diagnóstico gratuito` → conforme contexto: `Agendar conversa técnica` (contato) / `Falar com especialista` (home/header) / `Solicitar proposta técnica` (serviços)
- `qualquer escala de reforma` → `reformas corporativas de diferentes portes, com planejamento, equipe técnica e gestão próxima`
- `Zero intermediário` → `Um único ponto de responsabilidade` (títulos) ou `Ponto único de responsabilidade, com gestão técnica centralizada` (corpo)
- `sem surpresas...` → `com controle de cronograma, custos e comunicação recorrente`
- `Zero chamado sem resposta` → `Todo chamado com registro, prazo e responsável definidos`
- `sem subempreiteiros` → `com gestão técnica centralizada`

Repetir o grep até retornar vazio.

- [ ] **Step 3: Atualizar metadata global se necessário**

Conferir `manfac-site/app/layout.tsx` (`metadata.description`, JSON-LD `description`): se contiver algum termo banido, alinhar com o posicionamento 8.1. Caso já esteja ok, não mexer.

- [ ] **Step 4: Lint, teste e commit**

```bash
cd manfac-site && npm run lint && cd ..
npm test -- manfac-site
git add -A manfac-site
git commit -m "feat(manfac-site): posicionamento institucional no Quem Somos e varredura global de copy calibrada

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 13: Sitemap, build final e verificação completa

**Files:**
- Modify: `manfac-site/app/sitemap.ts`

**Interfaces:**
- Consumes: `SERVICOS_DATA` (Task 10).
- Produces: sitemap completo; entrega verificada contra os critérios de aceite da spec.

- [ ] **Step 1: Sitemap com as rotas novas**

Substituir `manfac-site/app/sitemap.ts`:

```ts
import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'
import { SERVICOS_DATA } from '@/lib/servicos'

const LAST_CONTENT_UPDATE = new Date('2026-07-15')

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    '',
    '/quem-somos',
    '/servicos',
    ...SERVICOS_DATA.map((s) => `/servicos/${s.slug}`),
    '/resultados',
    '/contato',
  ]

  return routes.map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: LAST_CONTENT_UPDATE,
    changeFrequency: 'monthly',
    priority: route === '' ? 1 : 0.8,
  }))
}
```

- [ ] **Step 2: Build de produção e suíte completa**

```bash
cd manfac-site && npm run lint && npm run build && cd ..
npm test -- manfac-site
```
Expected: build sem erros; todos os testes PASS.

- [ ] **Step 3: Checklist dos critérios de aceite (manual, com dev server)**

`cd manfac-site && npm run dev` e conferir um a um:

1. **Indicador zerado:** DevTools → Command Menu → "Disable JavaScript" → recarregar `/` e `/resultados` → todos os números aparecem com valor final.
2. **Menu:** "Início" primeiro item (desktop e mobile), ativo só na home.
3. **Ordem da home:** hero → números → dores → como funciona → soluções + recorrente/spot → case → diferenciais → CTA final.
4. **Formulário:** 3 caminhos; campo unidades só no recorrente; submit abre `wa.me/5521999999999?text=...` com mensagem estruturada.
5. **Rotas de serviço:** as 4 respondem, título da aba correto, e `curl -s http://localhost:3000/sitemap.xml` lista as 9 URLs.
6. **Termos banidos:** `grep -rinE "diagnóstico gratuito|qualquer escala|zero intermediário|sem surpresas|zero chamado" manfac-site --include=*.tsx --include=*.ts | grep -v node_modules | grep -v __tests__` → vazio.
7. **Vazamento:** `grep -rin "sofia" manfac-site --include=*.tsx --include=*.ts | grep -v node_modules` → vazio.
8. **Visual vs. mockup:** comparar cada seção da home, contato e uma página de serviço com o mockup aprovado.

- [ ] **Step 4: Commit final**

```bash
git add manfac-site/app/sitemap.ts
git commit -m "feat(manfac-site): sitemap com as páginas de serviço da v03

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Self-Review (executado na escrita do plano)

- **Cobertura da spec:** frente 1 → Task 3; frente 2 → Task 1; frente 3 → Tasks 5–8; frente 4 → Tasks 1 e 11; frente 5 → Tasks 2 e 9; frente 6 → Task 10; frente 7 → Tasks 5, 6, 8, 10 e 12; frente 8 → Task 4; frente 9 → Tasks 10 e 13. Fora do escopo da spec respeitado (sem GA4, sem número real de WhatsApp).
- **Placeholders:** o único `TODO` é o número de WhatsApp, exigido pela própria spec. A tabela de créditos das fotos exige preenchimento real antes do commit (instruído no passo).
- **Consistência de tipos:** `ContactFormData`/`DemandPath` (Task 2) usados na Task 9; `ServicoData`/`SERVICOS_DATA`/`getServico` (Task 10) usados nas Tasks 10 e 13; `isNavActive` (Task 3) usado no Header; `Counter({ value })` inalterado.
