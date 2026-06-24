# Redesign do site Manfac — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Converter `manfac-site` de landing page única (scroll) para um site multi-página com tema claro (cores oficiais da marca), linguagem visual "blueprint" e um hero 3D interativo (wireframe → sólido conforme rola a página).

**Architecture:** Next.js 16 App Router. Cada seção de conteúdo vira uma rota própria; o Header passa de links de âncora para links de rota com indicador de página ativa. Um componente de layout reutilizável (`BlueprintSection`) aplica a textura de grid + label de anotação em todas as seções, substituindo o padrão repetido de card-com-borda. O hero 3D é um componente client-only carregado via `next/dynamic` e montado só depois que o conteúdo principal já pintou na tela, para não pesar no carregamento inicial.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind CSS v4, TypeScript, Three.js + @react-three/fiber + @react-three/drei (hero 3D).

## Global Constraints

- Diretório do projeto: `manfac-site/` (subprojeto dentro do monorepo — não tocar no app "hub" na raiz)
- Sem framework de testes no projeto (não há Jest/Vitest/Playwright em `package.json`) — cada task verifica com `npm run build` (typecheck + build de produção) e `npm run lint`, seguido de checagem visual manual no navegador via `npm run dev`. Não introduzir um test runner novo só para este trabalho — não foi pedido e o site não tem lógica além do hero 3D.
- Cores oficiais da marca (de `material manfac/logos/Arquivos Logo/Manual de Uso Identidade Visual.pdf`): Berkeley Blue `#00345e`, Orange Pantone `#f85e0b`, Yellow Jonquil `#f7cb15`, Timberwolf `#dadad8`, Slate gray `#6e8894`, Jet `#333336`
- Tema claro (fundo branco/Timberwolf) — não dark navy. O cliente pediu explicitamente uma cor mais clara.
- Sem fotografia real disponível — layout não pode depender de fotos nesta entrega
- Não criar formulário de contato com backend — `Contato` continua `mailto:`
- Logo do cliente farmacêutico (case) NÃO pode ser usado sem aprovação — não adicionar
- `npm install` deve ser executado dentro de `manfac-site/`, não na raiz do monorepo

---

## Task 1: Dados centralizados do site (`lib/content.ts`)

**Files:**
- Create: `manfac-site/lib/content.ts`

**Interfaces:**
- Produces: `NAV_ITEMS: { href: string; label: string }[]`, `STATS: { value: string; label: string }[]`, `PROBLEMAS: string[]`, `PILARES: { title: string; description: string }[]`, `PASSOS: { n: string; title: string }[]`, `BANNERS: string[]`, `SERVICOS: { title: string; description: string }[]`, `RESULTADOS: { value: string; label: string }[]`, `DIFERENCIAIS: string[]`, `IMPACTO: string[]`. Todas as tasks seguintes (Header, Stats, Problema, QuemSomos, Abordagem, Servicos, Case, Diferencial, Time, teasers) importam destas constantes em vez de repetir os arrays localmente.

- [ ] **Step 1: Criar o arquivo de dados**

```typescript
// manfac-site/lib/content.ts

export const NAV_ITEMS = [
  { href: '/quem-somos', label: 'Quem somos' },
  { href: '/servicos', label: 'Serviços' },
  { href: '/resultados', label: 'Resultados' },
  { href: '/contato', label: 'Contato' },
]

export const STATS = [
  { value: '400+', label: 'unidades sob gestão no RJ' },
  { value: '+1.000', label: 'ordens de serviço/mês' },
  { value: '100%', label: 'das demandas concluídas no mês' },
  { value: '+R$800 mil', label: 'em obras e reformas/mês' },
]

export const PROBLEMAS = [
  'Falta de visibilidade sobre o andamento das demandas',
  'Dificuldade de controle de prazos e custos',
  'Comunicação descentralizada',
  'Atuação reativa e sem padronização',
]

export const PILARES = [
  {
    title: 'Gestão ativa e estruturada da operação',
    description:
      'Não tratamos obras e manutenção como demandas isoladas — estruturamos a operação como um sistema integrado.',
  },
  {
    title: 'Visibilidade e controle em tempo real',
    description:
      'Comunicação clara e recorrente, com transparência total sobre prazos, custos e andamento de cada demanda.',
  },
]

export const PASSOS = [
  { n: '01', title: 'Diagnóstico e priorização' },
  { n: '02', title: 'Estruturação da operação' },
  { n: '03', title: 'Execução com alto padrão técnico' },
  { n: '04', title: 'Comunicação e visibilidade contínua' },
  { n: '05', title: 'Evolução constante da operação' },
]

export const BANNERS = ['Simples na execução', 'Forte na gestão', 'Consistente no resultado']

export const SERVICOS = [
  {
    title: 'Obras e reformas corporativas',
    description:
      'Execução de obras e reformas em unidades corporativas com padrão técnico, cronograma definido e acompanhamento contínuo — sem paralisar a operação do cliente durante a obra.',
  },
  {
    title: 'Novas construções',
    description:
      'Gestão e execução de novas construções do planejamento à entrega, com um único ponto de contato responsável por prazo, custo e qualidade em cada etapa.',
  },
  {
    title: 'Manutenção predial preventiva e corretiva',
    description:
      'Rotinas programadas que evitam falhas antes que aconteçam, reduzindo custo recorrente e chamados de emergência ao longo do tempo.',
  },
  {
    title: 'Sistemas de Climatização (HVAC)',
    description:
      'Instalação, manutenção e gestão de sistemas de climatização, com monitoramento de desempenho e plano de manutenção preventiva dedicado.',
  },
]

export const RESULTADOS = [
  { value: '+1.000', label: 'ordens de serviço por mês' },
  { value: '100%', label: 'das demandas concluídas mensalmente' },
  { value: '400+', label: 'unidades sob gestão da Manfac no RJ' },
  { value: '+R$800 mil', label: 'em obras e reformas por mês' },
]

export const DIFERENCIAIS = [
  'Gestão ativa e estruturada',
  'Transparência total',
  'Comunicação clara e recorrente',
  'Uso de tecnologia e dados',
  'Proatividade na resolução de problemas',
]

export const IMPACTO = [
  'Mais previsibilidade',
  'Mais controle',
  'Mais eficiência',
  'Menos retrabalho',
  'Melhor tomada de decisão',
]
```

- [ ] **Step 2: Verificar que o projeto ainda compila**

Run: `cd manfac-site && npm run build`
Expected: build de produção conclui sem erros (o arquivo novo não é usado por ninguém ainda, então só precisa compilar)

- [ ] **Step 3: Commit**

```bash
git add manfac-site/lib/content.ts
git commit -m "feat(manfac-site): centralize site copy/data in lib/content.ts"
```

---

## Task 2: Tema claro com as cores oficiais da marca (`globals.css`)

**Files:**
- Modify: `manfac-site/app/globals.css` (rewrite completo)

**Interfaces:**
- Produces: CSS custom properties consumidas por todos os componentes via classes Tailwind arbitrárias (`text-[var(--orange)]`, `bg-[var(--surface)]`, etc.) e a classe utilitária `.blueprint-grid` usada pelo `BlueprintSection` (Task 3).

- [ ] **Step 1: Substituir o conteúdo do arquivo**

```css
/* manfac-site/app/globals.css */
@import "tailwindcss";

:root {
  --background: #ffffff;
  --surface: #f6f6f5;
  --ink: #00345e;
  --body-text: #333336;
  --orange: #f85e0b;
  --orange-hover: #d6520a;
  --yellow: #f7cb15;
  --muted: #6e8894;
  --border: #dadad8;
  --grid-line: rgba(110, 136, 148, 0.18);
}

html,
body {
  background-color: var(--background);
  color: var(--body-text);
  scroll-behavior: smooth;
}

* {
  box-sizing: border-box;
}

.blueprint-grid {
  background-image:
    linear-gradient(var(--grid-line) 1px, transparent 1px),
    linear-gradient(90deg, var(--grid-line) 1px, transparent 1px);
  background-size: 32px 32px;
}
```

- [ ] **Step 2: Build e checagem visual**

Run: `cd manfac-site && npm run build && npm run dev`

Abrir `http://localhost:3000` — a página ainda usa as classes antigas (`var(--navy)`, `var(--orange-hover)` com valor antigo etc.) então o visual vai ficar quebrado/misto até as próximas tasks substituírem cada componente. Isso é esperado: confirme só que **não há erro de build** e que o fundo já mudou para branco. Pare o dev server (Ctrl+C) depois de confirmar.

- [ ] **Step 3: Commit**

```bash
git add manfac-site/app/globals.css
git commit -m "feat(manfac-site): switch to light theme with official brand colors"
```

---

## Task 3: Primitivo de layout "blueprint" + Stats

**Files:**
- Create: `manfac-site/components/BlueprintSection.tsx`
- Modify: `manfac-site/components/Stats.tsx` (rewrite completo)

**Interfaces:**
- Consumes: `STATS` de `@/lib/content` (Task 1)
- Produces: `BlueprintSection` — componente `{ index: string; label: string; tone?: 'default' | 'alt'; className?: string; children: React.ReactNode }` usado por Problema, QuemSomos, Abordagem, Servicos, Case, Diferencial, Time (Tasks 8-11)

- [ ] **Step 1: Criar o componente `BlueprintSection`**

```tsx
// manfac-site/components/BlueprintSection.tsx
import type { ReactNode } from 'react'

type BlueprintSectionProps = {
  index: string
  label: string
  tone?: 'default' | 'alt'
  className?: string
  children: ReactNode
}

export default function BlueprintSection({
  index,
  label,
  tone = 'default',
  className = '',
  children,
}: BlueprintSectionProps) {
  return (
    <section
      className={`blueprint-grid border-y border-[var(--border)] ${
        tone === 'alt' ? 'bg-[var(--surface)]' : 'bg-[var(--background)]'
      } ${className}`}
    >
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="mb-6 flex items-center gap-2">
          <span className="h-px w-4 bg-[var(--orange)]" />
          <p className="font-mono text-xs tracking-wide text-[var(--orange)]">
            {index} — {label}
          </p>
        </div>
        {children}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Reescrever `Stats.tsx` usando o primitivo**

```tsx
// manfac-site/components/Stats.tsx
import BlueprintSection from './BlueprintSection'
import { STATS } from '@/lib/content'

export default function Stats() {
  return (
    <BlueprintSection index="00" label="Em números" tone="alt">
      <div className="grid grid-cols-2 gap-6 text-center md:grid-cols-4">
        {STATS.map((s) => (
          <div key={s.label}>
            <p className="text-2xl font-bold text-[var(--orange)] md:text-3xl">{s.value}</p>
            <p className="mt-1 text-xs text-[var(--muted)] md:text-sm">{s.label}</p>
          </div>
        ))}
      </div>
    </BlueprintSection>
  )
}
```

- [ ] **Step 3: Build e checagem visual**

Run: `cd manfac-site && npm run build && npm run dev`

Em `http://localhost:3000`, confirme que a seção de números (segunda seção da home) mostra fundo claro com grid sutil, label "00 — Em números" com uma linha laranja antes, e os 4 números em laranja. Pare o dev server.

- [ ] **Step 4: Commit**

```bash
git add manfac-site/components/BlueprintSection.tsx manfac-site/components/Stats.tsx
git commit -m "feat(manfac-site): add BlueprintSection layout primitive, migrate Stats"
```

---

## Task 4: Fontes self-hosted (Inter + IBM Plex Mono)

**Files:**
- Modify: `manfac-site/app/layout.tsx`

**Interfaces:**
- Produces: classes globais `font-sans` (Inter, já é o default do Tailwind, mas agora self-hosted com peso/tracking maior nos headings via utilitária) e `font-mono` (IBM Plex Mono, usada pelo `BlueprintSection` e por qualquer label técnico)

- [ ] **Step 1: Atualizar o import de fontes em `layout.tsx`**

Substituir as linhas 1-6 (imports + declaração da fonte Inter) por:

```tsx
import type { Metadata } from 'next'
import { Inter, IBM_Plex_Mono } from 'next/font/google'
import { SITE_URL } from '@/lib/site'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })
const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
})
```

E trocar a linha do `<body>` (atualmente `<body className={inter.className}>{children}</body>`) por:

```tsx
<body className={`${inter.variable} ${plexMono.variable} font-sans antialiased`}>
  {children}
</body>
```

- [ ] **Step 2: Mapear as variáveis de fonte no Tailwind**

Adicionar ao final de `manfac-site/app/globals.css` (depois do bloco `.blueprint-grid`):

```css
@theme inline {
  --font-sans: var(--font-sans);
  --font-mono: var(--font-mono);
}
```

- [ ] **Step 3: Build**

Run: `cd manfac-site && npm run build`
Expected: build conclui sem erros. (Verificação visual da fonte mono acontece na Task 3 já aplicada ao label do `BlueprintSection`, que usa `font-mono` — re-rodar `npm run dev` e confirmar que o label "00 — Em números" está em fonte monoespaçada é suficiente aqui.)

- [ ] **Step 4: Commit**

```bash
git add manfac-site/app/layout.tsx manfac-site/app/globals.css
git commit -m "feat(manfac-site): self-host Inter + IBM Plex Mono via next/font"
```

---

## Task 5: Header e Footer — navegação multi-página, tema claro

**Files:**
- Modify: `manfac-site/components/Header.tsx` (rewrite completo)
- Modify: `manfac-site/components/Footer.tsx` (rewrite completo)

**Interfaces:**
- Consumes: `NAV_ITEMS` de `@/lib/content` (Task 1)
- Produces: nada consumido por outras tasks — Header/Footer são montados pelo `RootLayout`, que já os usa via `app/page.tsx` hoje (ver Task 14).

- [ ] **Step 1: Reescrever `Header.tsx`**

```tsx
// manfac-site/components/Header.tsx
'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { NAV_ITEMS } from '@/lib/content'

export default function Header() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--background)]/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="shrink-0" onClick={() => setOpen(false)}>
          <Image src="/logo.png" alt="Manfac Engenharia" width={154} height={42} priority />
        </Link>

        <nav className="hidden gap-8 text-sm text-[var(--muted)] md:flex">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative pb-1 transition-colors hover:text-[var(--ink)] ${
                  active ? 'text-[var(--ink)]' : ''
                }`}
              >
                {item.label}
                {active && (
                  <span className="absolute -bottom-1 left-0 h-px w-full bg-[var(--orange)]" />
                )}
              </Link>
            )
          })}
        </nav>

        <Link
          href="/contato"
          className="hidden rounded-md bg-[var(--orange)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--orange-hover)] md:inline-block"
        >
          Fale com a gente
        </Link>

        <button
          type="button"
          aria-label="Abrir menu"
          aria-expanded={open}
          className="text-[var(--ink)] md:hidden"
          onClick={() => setOpen((v) => !v)}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {open ? (
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </div>

      {open && (
        <nav className="flex flex-col gap-1 border-t border-[var(--border)] px-6 py-4 text-sm md:hidden">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded px-2 py-2 text-[var(--ink)] hover:bg-[var(--surface)]"
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  )
}
```

- [ ] **Step 2: Reescrever `Footer.tsx`**

```tsx
// manfac-site/components/Footer.tsx
import Image from 'next/image'

export default function Footer() {
  return (
    <footer className="border-t border-[var(--border)] bg-[var(--surface)]">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-[var(--muted)] md:flex-row">
        <Image src="/logo.png" alt="Manfac Engenharia" width={121} height={33} />
        <p>© {new Date().getFullYear()} Manfac Engenharia. Todos os direitos reservados.</p>
      </div>
    </footer>
  )
}
```

- [ ] **Step 3: Build e checagem visual**

Run: `cd manfac-site && npm run build && npm run dev`

Em `http://localhost:3000`: o header deve mostrar a logo colorida (não mais branca), os 4 links de `NAV_ITEMS`, e o botão laranja "Fale com a gente". Encolha a janela pra largura mobile e confirme que o hambúrguer abre/fecha o menu. Os links ainda vão dar 404 (as páginas só existem a partir da Task 15) — isso é esperado nesta task. Pare o dev server.

- [ ] **Step 4: Commit**

```bash
git add manfac-site/components/Header.tsx manfac-site/components/Footer.tsx
git commit -m "feat(manfac-site): multi-page nav with active state, light theme header/footer"
```

---

## Task 6: Hero 3D — estrutura "blueprint que se materializa"

**Files:**
- Create: `manfac-site/components/Hero3D.tsx`

**Interfaces:**
- Consumes: nada de tasks anteriores (componente autocontido)
- Produces: `Hero3D({ progress, simplified }: { progress: number; simplified?: boolean })` — `progress` é um número 0–1 controlado pelo pai (Task 7) que dirige a interpolação wireframe→sólido; `simplified` reduz a cena para mobile/low-power.

- [ ] **Step 1: Instalar as dependências de 3D**

Run: `cd manfac-site && npm install three@^0.184.0 @react-three/fiber@^9.6.1 @react-three/drei@^10.7.7 && npm install -D @types/three@^0.184.1`

Expected: instala sem erro de peer dependency (já validado: resolve para `three@0.184.0`, `@react-three/fiber@9.6.1`, `@react-three/drei@10.7.7`, compatíveis com React 19.2.4 / Next 16.2.9 já usados no projeto).

- [ ] **Step 2: Criar o componente**

```tsx
// manfac-site/components/Hero3D.tsx
'use client'

import { Suspense, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Edges } from '@react-three/drei'
import * as THREE from 'three'

type Volume = { position: [number, number, number]; size: [number, number, number] }

const VOLUMES_FULL: Volume[] = [
  { position: [-1.6, -0.3, 0], size: [0.7, 1.4, 0.7] },
  { position: [-0.7, 0.1, 0.3], size: [0.6, 2.2, 0.6] },
  { position: [0.2, -0.5, -0.2], size: [0.8, 1.0, 0.8] },
  { position: [1.1, 0.3, 0.1], size: [0.6, 2.6, 0.6] },
  { position: [1.9, -0.4, 0.4], size: [0.55, 1.2, 0.55] },
]

const VOLUMES_SIMPLIFIED: Volume[] = [
  { position: [-1.0, -0.2, 0], size: [0.7, 1.6, 0.7] },
  { position: [0.2, 0.2, 0.1], size: [0.65, 2.4, 0.65] },
  { position: [1.2, -0.3, -0.1], size: [0.6, 1.3, 0.6] },
]

function BlueprintStructure({ progress, simplified }: { progress: number; simplified: boolean }) {
  const groupRef = useRef<THREE.Group>(null)
  const targetRotation = useRef({ x: 0, y: 0 })
  const { pointer } = useThree()
  const volumes = simplified ? VOLUMES_SIMPLIFIED : VOLUMES_FULL

  useFrame((_, delta) => {
    if (!groupRef.current) return

    if (!simplified) {
      targetRotation.current.y = pointer.x * 0.35
      targetRotation.current.x = -pointer.y * 0.2
    } else {
      targetRotation.current.y += delta * 0.15
    }

    groupRef.current.rotation.y += (targetRotation.current.y - groupRef.current.rotation.y) * 0.05
    groupRef.current.rotation.x += (targetRotation.current.x - groupRef.current.rotation.x) * 0.05
  })

  const solidOpacity = THREE.MathUtils.clamp(progress, 0, 1)

  return (
    <group ref={groupRef} rotation={[0.15, -0.3, 0]}>
      {volumes.map((volume, i) => (
        <mesh key={i} position={volume.position}>
          <boxGeometry args={volume.size} />
          <meshStandardMaterial
            color="#00345e"
            transparent
            opacity={solidOpacity * 0.92}
            roughness={0.45}
            metalness={0.1}
          />
          <Edges color={i % 2 === 0 ? '#f85e0b' : '#00345e'} linewidth={1.25} />
        </mesh>
      ))}
    </group>
  )
}

export default function Hero3D({ progress, simplified = false }: { progress: number; simplified?: boolean }) {
  const dpr = useMemo<[number, number]>(() => (simplified ? [1, 1] : [1, 1.5]), [simplified])

  return (
    <Canvas
      dpr={dpr}
      gl={{ antialias: true, alpha: true }}
      camera={{ position: [0, 0.4, 6], fov: 38 }}
    >
      <ambientLight intensity={0.7} />
      <directionalLight position={[3, 4, 5]} intensity={1.1} />
      <Suspense fallback={null}>
        <BlueprintStructure progress={progress} simplified={simplified} />
      </Suspense>
    </Canvas>
  )
}
```

- [ ] **Step 3: Verificar build**

Run: `cd manfac-site && npm run build`
Expected: build conclui sem erros de tipo (o componente ainda não é importado por nenhuma página, então isso só confirma que o TypeScript/JSX do Three.js está correto)

- [ ] **Step 4: Commit**

```bash
git add manfac-site/package.json manfac-site/package-lock.json manfac-site/components/Hero3D.tsx
git commit -m "feat(manfac-site): procedural Hero3D blueprint-to-solid scene"
```

---

## Task 7: Hero.tsx — montagem adiada do 3D, tema claro

**Files:**
- Modify: `manfac-site/components/Hero.tsx` (rewrite completo)

**Interfaces:**
- Consumes: `Hero3D` (Task 6) via `next/dynamic`
- Produces: nada — `Hero` é consumido por `app/page.tsx` (Task 14), que já o importa hoje.

- [ ] **Step 1: Reescrever `Hero.tsx`**

```tsx
// manfac-site/components/Hero.tsx
'use client'

import dynamic from 'next/dynamic'
import { useEffect, useRef, useState } from 'react'

const Hero3D = dynamic(() => import('./Hero3D'), { ssr: false })

export default function Hero() {
  const sectionRef = useRef<HTMLElement>(null)
  const [ready, setReady] = useState(false)
  const [simplified, setSimplified] = useState(false)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    setSimplified(window.innerWidth < 768)

    const idle = (cb: () => void) =>
      'requestIdleCallback' in window
        ? window.requestIdleCallback(cb)
        : window.setTimeout(cb, 200)
    idle(() => setReady(true))
  }, [])

  useEffect(() => {
    if (!ready) return

    const onScroll = () => {
      const el = sectionRef.current
      if (!el) return
      const height = el.offsetHeight || 1
      const p = 1 - Math.min(Math.max(window.scrollY / height, 0), 1)
      setProgress(1 - p)
    }

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [ready])

  return (
    <section
      ref={sectionRef}
      className="blueprint-grid relative overflow-hidden border-b border-[var(--border)]"
    >
      <div className="absolute inset-0 -z-10">
        {ready && <Hero3D progress={progress} simplified={simplified} />}
      </div>

      <div className="relative mx-auto max-w-6xl px-6 py-24 text-center md:py-32">
        <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-[var(--orange)]">
          Engenharia para grandes operações
        </p>
        <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-tight tracking-tight text-[var(--ink)] md:text-6xl">
          Mais do que executar obras.
          <br />
          Estruturamos e damos visibilidade à sua operação.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-[var(--muted)]">
          Gestão e execução de obras, reformas e manutenção predial para grandes operações —
          com controle, transparência e resultado.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <a
            href="/contato"
            className="rounded-md bg-[var(--orange)] px-6 py-3 font-medium text-white transition-colors hover:bg-[var(--orange-hover)]"
          >
            Fale com a gente
          </a>
          <a
            href="/resultados"
            className="rounded-md border border-[var(--border)] px-6 py-3 font-medium text-[var(--ink)] transition-colors hover:bg-[var(--surface)]"
          >
            Ver resultados
          </a>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Build e checagem visual**

Run: `cd manfac-site && npm run build && npm run dev`

Em `http://localhost:3000`: o hero deve mostrar texto + botões imediatamente (sem esperar o 3D). Depois de um instante, a estrutura geométrica 3D aparece atrás do texto, começando mais transparente/contornada e ficando mais sólida conforme você rola a página pra baixo dentro do hero. Mova o mouse sobre o hero em desktop e confirme que a estrutura gira sutilmente seguindo o cursor. Redimensione pra largura mobile, recarregue, e confirme que a versão simplificada (3 volumes, rotação automática lenta) aparece sem travar o scroll. Pare o dev server.

- [ ] **Step 3: Commit**

```bash
git add manfac-site/components/Hero.tsx
git commit -m "feat(manfac-site): wire Hero3D into Hero with deferred mount and scroll progress"
```

---

## Task 8: Problema — tema claro

**Files:**
- Modify: `manfac-site/components/Problema.tsx` (rewrite completo)

**Interfaces:**
- Consumes: `PROBLEMAS` de `@/lib/content` (Task 1), `BlueprintSection` (Task 3)

- [ ] **Step 1: Reescrever o componente**

```tsx
// manfac-site/components/Problema.tsx
import BlueprintSection from './BlueprintSection'
import { PROBLEMAS } from '@/lib/content'

export default function Problema() {
  return (
    <BlueprintSection index="01" label="O problema" tone="alt">
      <h2 className="max-w-2xl text-2xl font-semibold leading-snug text-[var(--ink)] md:text-3xl">
        Sem gestão estruturada, obras e manutenção predial geram mais custo do que deveriam.
      </h2>
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {PROBLEMAS.map((problema) => (
          <div key={problema} className="flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--background)] p-4">
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[var(--orange)]" />
            <p className="text-[var(--muted)]">{problema}</p>
          </div>
        ))}
      </div>
      <p className="mt-8 text-[var(--muted)]">
        Com o tempo, isso gera perda de eficiência, aumento de custos e desgaste com as
        unidades operacionais.
      </p>
    </BlueprintSection>
  )
}
```

- [ ] **Step 2: Build**

Run: `cd manfac-site && npm run build`
Expected: build sem erros

- [ ] **Step 3: Commit**

```bash
git add manfac-site/components/Problema.tsx
git commit -m "feat(manfac-site): migrate Problema to light theme + BlueprintSection"
```

---

## Task 9: Página Quem Somos — QuemSomos, Abordagem, Diferencial, Time

**Files:**
- Modify: `manfac-site/components/QuemSomos.tsx` (rewrite completo)
- Modify: `manfac-site/components/Abordagem.tsx` (rewrite completo)
- Modify: `manfac-site/components/Diferencial.tsx` (rewrite completo)
- Modify: `manfac-site/components/Time.tsx` (rewrite completo)

**Interfaces:**
- Consumes: `PILARES`, `PASSOS`, `BANNERS`, `DIFERENCIAIS`, `IMPACTO` de `@/lib/content` (Task 1), `BlueprintSection` (Task 3)

- [ ] **Step 1: Reescrever `QuemSomos.tsx`**

```tsx
// manfac-site/components/QuemSomos.tsx
import BlueprintSection from './BlueprintSection'
import { PILARES } from '@/lib/content'

export default function QuemSomos() {
  return (
    <BlueprintSection index="02" label="Quem somos">
      <div className="grid gap-12 md:grid-cols-2 md:items-start">
        <div>
          <h2 className="text-2xl font-semibold leading-snug text-[var(--ink)] md:text-3xl">
            A Manfac é uma empresa de Engenharia especializada na gestão e execução de obras,
            reformas e manutenção predial para grandes operações.
          </h2>
          <p className="mt-4 text-[var(--muted)]">
            Nosso compromisso é impulsionar o sucesso dos nossos clientes através de operações
            mais organizadas, eficientes e transparentes.
          </p>
        </div>
        <div className="space-y-6">
          {PILARES.map((pilar) => (
            <div key={pilar.title} className="rounded-lg border-l-2 border-[var(--orange)] bg-[var(--surface)] p-6">
              <h3 className="font-semibold text-[var(--ink)]">{pilar.title}</h3>
              <p className="mt-2 text-sm text-[var(--muted)]">{pilar.description}</p>
            </div>
          ))}
        </div>
      </div>
    </BlueprintSection>
  )
}
```

- [ ] **Step 2: Reescrever `Abordagem.tsx`**

```tsx
// manfac-site/components/Abordagem.tsx
import BlueprintSection from './BlueprintSection'
import { PASSOS, BANNERS } from '@/lib/content'

export default function Abordagem() {
  return (
    <BlueprintSection index="03" label="Nossa abordagem" tone="alt">
      <h2 className="max-w-3xl text-2xl font-semibold leading-snug text-[var(--ink)] md:text-3xl">
        Estruturamos a operação como um sistema integrado, conectando pessoas, processos e
        informações. Executamos com excelência técnica e gerenciamos com inteligência,
        transparência e foco em resultado.
      </h2>

      <h3 className="mt-14 text-lg font-semibold text-[var(--ink)]">Como atuamos</h3>
      <div className="mt-6 grid gap-6 md:grid-cols-5">
        {PASSOS.map((passo) => (
          <div key={passo.n} className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-5">
            <span className="font-mono text-2xl font-bold text-[var(--orange)]">{passo.n}</span>
            <p className="mt-3 text-sm text-[var(--muted)]">{passo.title}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 flex flex-wrap justify-center gap-3 text-center">
        {BANNERS.map((b) => (
          <span
            key={b}
            className="rounded-full border border-[var(--border)] bg-[var(--background)] px-5 py-2 text-sm text-[var(--muted)]"
          >
            {b}
          </span>
        ))}
      </div>
    </BlueprintSection>
  )
}
```

- [ ] **Step 3: Reescrever `Diferencial.tsx`**

```tsx
// manfac-site/components/Diferencial.tsx
import BlueprintSection from './BlueprintSection'
import { DIFERENCIAIS } from '@/lib/content'

export default function Diferencial() {
  return (
    <BlueprintSection index="04" label="Diferencial">
      <div className="flex flex-wrap gap-3">
        {DIFERENCIAIS.map((d) => (
          <span
            key={d}
            className="rounded-full border border-[var(--border)] px-5 py-2 text-sm text-[var(--ink)]"
          >
            {d}
          </span>
        ))}
      </div>
      <p className="mt-10 max-w-2xl text-xl font-semibold leading-snug text-[var(--ink)]">
        &ldquo;Não escondemos problemas. Assumimos, tratamos e evoluímos continuamente.&rdquo;
      </p>
    </BlueprintSection>
  )
}
```

- [ ] **Step 4: Reescrever `Time.tsx`**

```tsx
// manfac-site/components/Time.tsx
import BlueprintSection from './BlueprintSection'
import { IMPACTO } from '@/lib/content'

export default function Time() {
  return (
    <BlueprintSection index="05" label="Nosso time" tone="alt">
      <div className="grid gap-12 md:grid-cols-2">
        <div>
          <p className="text-xl font-semibold leading-snug text-[var(--ink)]">
            Senso de urgência, responsabilidade e foco em resultado.
          </p>
          <p className="mt-4 text-[var(--muted)]">
            Proximidade com o cliente e comunicação direta em cada etapa da operação.
          </p>
        </div>
        <div>
          <h3 className="font-mono text-xs uppercase tracking-wide text-[var(--orange)]">
            Impacto desejado
          </h3>
          <ul className="mt-4 space-y-2">
            {IMPACTO.map((i) => (
              <li key={i} className="flex items-center gap-3 text-[var(--muted)]">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--orange)]" />
                {i}
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-[var(--muted)]">
            Resultado não é discurso — é consistência ao longo do tempo.
          </p>
        </div>
      </div>
    </BlueprintSection>
  )
}
```

- [ ] **Step 5: Build**

Run: `cd manfac-site && npm run build`
Expected: build sem erros

- [ ] **Step 6: Commit**

```bash
git add manfac-site/components/QuemSomos.tsx manfac-site/components/Abordagem.tsx manfac-site/components/Diferencial.tsx manfac-site/components/Time.tsx
git commit -m "feat(manfac-site): migrate Quem Somos page cluster to light theme + BlueprintSection"
```

---

## Task 10: Página Serviços — conteúdo expandido

**Files:**
- Modify: `manfac-site/components/Servicos.tsx` (rewrite completo)

**Interfaces:**
- Consumes: `SERVICOS` de `@/lib/content` (Task 1, já com descrições expandidas), `BlueprintSection` (Task 3)

- [ ] **Step 1: Reescrever o componente**

```tsx
// manfac-site/components/Servicos.tsx
import BlueprintSection from './BlueprintSection'
import { SERVICOS } from '@/lib/content'

export default function Servicos() {
  return (
    <BlueprintSection index="06" label="Serviços">
      <div className="grid gap-6 sm:grid-cols-2">
        {SERVICOS.map((servico) => (
          <div key={servico.title} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
            <h3 className="font-semibold text-[var(--ink)]">{servico.title}</h3>
            <p className="mt-2 text-sm text-[var(--muted)]">{servico.description}</p>
          </div>
        ))}
      </div>
    </BlueprintSection>
  )
}
```

- [ ] **Step 2: Build**

Run: `cd manfac-site && npm run build`
Expected: build sem erros

- [ ] **Step 3: Commit**

```bash
git add manfac-site/components/Servicos.tsx
git commit -m "feat(manfac-site): migrate Servicos to light theme with expanded descriptions"
```

---

## Task 11: Página Resultados (Case)

**Files:**
- Modify: `manfac-site/components/Case.tsx` (rewrite completo)

**Interfaces:**
- Consumes: `RESULTADOS` de `@/lib/content` (Task 1), `BlueprintSection` (Task 3)

- [ ] **Step 1: Reescrever o componente**

```tsx
// manfac-site/components/Case.tsx
import BlueprintSection from './BlueprintSection'
import { RESULTADOS } from '@/lib/content'

export default function Case() {
  return (
    <BlueprintSection index="07" label="Resultados" tone="alt">
      <h2 className="max-w-3xl text-2xl font-semibold leading-snug text-[var(--ink)] md:text-3xl">
        Um dos maiores varejistas do setor farmacêutico do Brasil — faturamento de mais de
        R$16 bilhões/ano e 1.600+ unidades no país — colocou a Manfac na gestão de 400+ unidades
        no Rio de Janeiro.
      </h2>
      <p className="mt-4 max-w-2xl text-[var(--muted)]">
        Depois de 7 anos com fornecedores de baixa qualidade, sem padrão e com comunicação
        ineficiente, a Manfac estruturou gestão ativa, rotinas de acompanhamento e transparência
        total — virando referência reconhecida no estado.
      </p>
      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {RESULTADOS.map((r) => (
          <div key={r.label} className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-6 text-center">
            <p className="text-3xl font-bold text-[var(--orange)]">{r.value}</p>
            <p className="mt-2 text-sm text-[var(--muted)]">{r.label}</p>
          </div>
        ))}
      </div>
    </BlueprintSection>
  )
}
```

- [ ] **Step 2: Build**

Run: `cd manfac-site && npm run build`
Expected: build sem erros

- [ ] **Step 3: Commit**

```bash
git add manfac-site/components/Case.tsx
git commit -m "feat(manfac-site): migrate Case/Resultados to light theme + BlueprintSection"
```

---

## Task 12: Contato — tema claro

**Files:**
- Modify: `manfac-site/components/Contato.tsx` (rewrite completo)

- [ ] **Step 1: Reescrever o componente**

```tsx
// manfac-site/components/Contato.tsx
export default function Contato() {
  return (
    <section className="border-t border-[var(--border)] bg-[var(--surface)]">
      <div className="mx-auto max-w-3xl px-6 py-24 text-center">
        <h2 className="text-2xl font-bold text-[var(--ink)] md:text-3xl">
          Se a sua operação exige controle, visibilidade e resultado,
          <br />a Manfac é o parceiro certo para construir isso com você.
        </h2>
        <a
          href="mailto:contato@manfac.com.br"
          className="mt-8 inline-block rounded-md bg-[var(--orange)] px-8 py-3 font-medium text-white transition-colors hover:bg-[var(--orange-hover)]"
        >
          contato@manfac.com.br
        </a>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Build**

Run: `cd manfac-site && npm run build`
Expected: build sem erros

- [ ] **Step 3: Commit**

```bash
git add manfac-site/components/Contato.tsx
git commit -m "feat(manfac-site): migrate Contato to light theme"
```

---

## Task 13: Teasers da Home (Quem Somos, Serviços, Resultados)

**Files:**
- Create: `manfac-site/components/home/QuemSomosTeaser.tsx`
- Create: `manfac-site/components/home/ServicosTeaser.tsx`
- Create: `manfac-site/components/home/CaseTeaser.tsx`

**Interfaces:**
- Consumes: `SERVICOS`, `RESULTADOS` de `@/lib/content` (Task 1), `BlueprintSection` (Task 3)
- Produces: `QuemSomosTeaser`, `ServicosTeaser`, `CaseTeaser` — componentes sem props, consumidos por `app/page.tsx` (Task 14)

- [ ] **Step 1: Criar `QuemSomosTeaser.tsx`**

```tsx
// manfac-site/components/home/QuemSomosTeaser.tsx
import Link from 'next/link'
import BlueprintSection from '../BlueprintSection'

export default function QuemSomosTeaser() {
  return (
    <BlueprintSection index="02" label="Quem somos">
      <h2 className="max-w-2xl text-2xl font-semibold leading-snug text-[var(--ink)] md:text-3xl">
        A Manfac é uma empresa de Engenharia especializada na gestão e execução de obras,
        reformas e manutenção predial para grandes operações.
      </h2>
      <Link
        href="/quem-somos"
        className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-[var(--orange)] hover:text-[var(--orange-hover)]"
      >
        Saiba mais sobre a Manfac →
      </Link>
    </BlueprintSection>
  )
}
```

- [ ] **Step 2: Criar `ServicosTeaser.tsx`**

```tsx
// manfac-site/components/home/ServicosTeaser.tsx
import Link from 'next/link'
import BlueprintSection from '../BlueprintSection'
import { SERVICOS } from '@/lib/content'

export default function ServicosTeaser() {
  return (
    <BlueprintSection index="03" label="Serviços" tone="alt">
      <div className="grid gap-6 sm:grid-cols-2">
        {SERVICOS.map((servico) => (
          <div key={servico.title} className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-6">
            <h3 className="font-semibold text-[var(--ink)]">{servico.title}</h3>
          </div>
        ))}
      </div>
      <Link
        href="/servicos"
        className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-[var(--orange)] hover:text-[var(--orange-hover)]"
      >
        Ver todos os serviços →
      </Link>
    </BlueprintSection>
  )
}
```

- [ ] **Step 3: Criar `CaseTeaser.tsx`**

```tsx
// manfac-site/components/home/CaseTeaser.tsx
import Link from 'next/link'
import BlueprintSection from '../BlueprintSection'
import { RESULTADOS } from '@/lib/content'

export default function CaseTeaser() {
  return (
    <BlueprintSection index="04" label="Resultados">
      <h2 className="max-w-3xl text-2xl font-semibold leading-snug text-[var(--ink)] md:text-3xl">
        Um dos maiores varejistas do setor farmacêutico do Brasil colocou a Manfac na gestão de
        400+ unidades no Rio de Janeiro.
      </h2>
      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {RESULTADOS.map((r) => (
          <div key={r.label} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
            <p className="text-3xl font-bold text-[var(--orange)]">{r.value}</p>
            <p className="mt-2 text-sm text-[var(--muted)]">{r.label}</p>
          </div>
        ))}
      </div>
      <Link
        href="/resultados"
        className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-[var(--orange)] hover:text-[var(--orange-hover)]"
      >
        Ver o case completo →
      </Link>
    </BlueprintSection>
  )
}
```

- [ ] **Step 4: Build**

Run: `cd manfac-site && npm run build`
Expected: build sem erros

- [ ] **Step 5: Commit**

```bash
git add manfac-site/components/home
git commit -m "feat(manfac-site): add Home page teaser components"
```

---

## Task 14: Montar a Home (`app/page.tsx`)

**Files:**
- Modify: `manfac-site/app/page.tsx` (rewrite completo)

**Interfaces:**
- Consumes: `Header`, `Hero`, `Stats`, `Problema`, `Footer` (já existentes), `QuemSomosTeaser`, `ServicosTeaser`, `CaseTeaser` (Task 13), `Contato` (Task 12)

- [ ] **Step 1: Reescrever `app/page.tsx`**

```tsx
// manfac-site/app/page.tsx
import Header from '@/components/Header'
import Hero from '@/components/Hero'
import Stats from '@/components/Stats'
import Problema from '@/components/Problema'
import QuemSomosTeaser from '@/components/home/QuemSomosTeaser'
import ServicosTeaser from '@/components/home/ServicosTeaser'
import CaseTeaser from '@/components/home/CaseTeaser'
import Contato from '@/components/Contato'
import Footer from '@/components/Footer'

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Stats />
        <Problema />
        <QuemSomosTeaser />
        <ServicosTeaser />
        <CaseTeaser />
        <Contato />
      </main>
      <Footer />
    </>
  )
}
```

- [ ] **Step 2: Build e checagem visual completa**

Run: `cd manfac-site && npm run build && npm run dev`

Em `http://localhost:3000`, role a home inteira e confirme: hero com 3D, stats, problema, os 3 teasers cada um com link "saiba mais"/"ver todos"/"ver o case completo" (ainda vão dar 404 até a Task 15), e o CTA de contato. Pare o dev server.

- [ ] **Step 3: Commit**

```bash
git add manfac-site/app/page.tsx
git commit -m "feat(manfac-site): rebuild Home as condensed multi-page entry point"
```

---

## Task 15: Páginas dedicadas (Quem Somos, Serviços, Resultados, Contato)

**Files:**
- Create: `manfac-site/app/quem-somos/page.tsx`
- Create: `manfac-site/app/servicos/page.tsx`
- Create: `manfac-site/app/resultados/page.tsx`
- Create: `manfac-site/app/contato/page.tsx`

**Interfaces:**
- Consumes: `Header`, `Footer`, `QuemSomos`, `Abordagem`, `Diferencial`, `Time`, `Servicos`, `Case`, `Stats`, `Contato` (já migrados nas tasks 5, 9, 10, 11, 12, 3)

- [ ] **Step 1: Criar `app/quem-somos/page.tsx`**

```tsx
// manfac-site/app/quem-somos/page.tsx
import type { Metadata } from 'next'
import Header from '@/components/Header'
import QuemSomos from '@/components/QuemSomos'
import Abordagem from '@/components/Abordagem'
import Diferencial from '@/components/Diferencial'
import Time from '@/components/Time'
import Footer from '@/components/Footer'

export const metadata: Metadata = {
  title: 'Quem somos — Manfac Engenharia',
  description:
    'A Manfac é uma empresa de Engenharia especializada na gestão e execução de obras, reformas e manutenção predial para grandes operações.',
}

export default function QuemSomosPage() {
  return (
    <>
      <Header />
      <main>
        <QuemSomos />
        <Abordagem />
        <Diferencial />
        <Time />
      </main>
      <Footer />
    </>
  )
}
```

- [ ] **Step 2: Criar `app/servicos/page.tsx`**

```tsx
// manfac-site/app/servicos/page.tsx
import type { Metadata } from 'next'
import Header from '@/components/Header'
import Servicos from '@/components/Servicos'
import Footer from '@/components/Footer'

export const metadata: Metadata = {
  title: 'Serviços — Manfac Engenharia',
  description:
    'Obras e reformas corporativas, novas construções, manutenção predial preventiva e corretiva, e sistemas de climatização (HVAC).',
}

export default function ServicosPage() {
  return (
    <>
      <Header />
      <main>
        <Servicos />
      </main>
      <Footer />
    </>
  )
}
```

- [ ] **Step 3: Criar `app/resultados/page.tsx`**

```tsx
// manfac-site/app/resultados/page.tsx
import type { Metadata } from 'next'
import Header from '@/components/Header'
import Case from '@/components/Case'
import Stats from '@/components/Stats'
import Footer from '@/components/Footer'

export const metadata: Metadata = {
  title: 'Resultados — Manfac Engenharia',
  description:
    'Como a Manfac estruturou a gestão de 400+ unidades no Rio de Janeiro para um dos maiores varejistas farmacêuticos do Brasil.',
}

export default function ResultadosPage() {
  return (
    <>
      <Header />
      <main>
        <Case />
        <Stats />
      </main>
      <Footer />
    </>
  )
}
```

- [ ] **Step 4: Criar `app/contato/page.tsx`**

```tsx
// manfac-site/app/contato/page.tsx
import type { Metadata } from 'next'
import Header from '@/components/Header'
import Contato from '@/components/Contato'
import Footer from '@/components/Footer'

export const metadata: Metadata = {
  title: 'Contato — Manfac Engenharia',
  description: 'Fale com a Manfac Engenharia sobre gestão e execução de obras, reformas e manutenção predial.',
}

export default function ContatoPage() {
  return (
    <>
      <Header />
      <main>
        <Contato />
      </main>
      <Footer />
    </>
  )
}
```

- [ ] **Step 5: Build e checagem visual de navegação completa**

Run: `cd manfac-site && npm run build && npm run dev`

Em `http://localhost:3000`, clique em cada link do header (Quem somos, Serviços, Resultados, Contato) e confirme que cada um carrega sua página própria sem 404, com o indicador de página ativa correto no header. Clique nos links "saiba mais" dos teasers da home e confirme que levam às páginas certas. Pare o dev server.

- [ ] **Step 6: Commit**

```bash
git add manfac-site/app/quem-somos manfac-site/app/servicos manfac-site/app/resultados manfac-site/app/contato
git commit -m "feat(manfac-site): add dedicated routes for Quem Somos, Serviços, Resultados, Contato"
```

---

## Task 16: Atualizar o sitemap

**Files:**
- Modify: `manfac-site/app/sitemap.ts`

- [ ] **Step 1: Adicionar as novas rotas**

```typescript
// manfac-site/app/sitemap.ts
import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'

const LAST_CONTENT_UPDATE = new Date('2026-06-23')

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ['', '/quem-somos', '/servicos', '/resultados', '/contato']

  return routes.map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: LAST_CONTENT_UPDATE,
    changeFrequency: 'monthly',
    priority: route === '' ? 1 : 0.8,
  }))
}
```

- [ ] **Step 2: Build final e checagem de performance**

Run: `cd manfac-site && npm run build`
Expected: build de produção conclui sem erros, sem warnings de rota

Run: `cd manfac-site && npm run lint`
Expected: nenhum erro de lint

Run: `cd manfac-site && npm run dev`, abrir `http://localhost:3000/sitemap.xml`
Expected: lista as 5 rotas (`/`, `/quem-somos`, `/servicos`, `/resultados`, `/contato`)

Abrir as DevTools (Network/Performance) em `http://localhost:3000` e confirmar visualmente que o texto do hero aparece imediatamente (sem esperar o JS do 3D) — o 3D deve "popar" alguns instantes depois. Pare o dev server.

- [ ] **Step 3: Commit**

```bash
git add manfac-site/app/sitemap.ts
git commit -m "feat(manfac-site): update sitemap with new multi-page routes"
```

---

## Self-Review (preenchido após escrever o plano)

**Cobertura da spec:**
- Site multi-página → Tasks 14, 15, 16 ✓
- Hero 3D blueprint→sólido, interativo, carregamento adiado, fallback mobile → Tasks 6, 7 ✓
- Tema claro com cores oficiais da marca → Task 2 ✓
- Linguagem visual "blueprint" (grid, anotação, assimetria) em todas as seções → Task 3 (`BlueprintSection`) aplicado nas Tasks 8-11, 13 ✓
- Tipografia (Inter + tracking, IBM Plex Mono em anotações) → Task 4 ✓
- Sem dependência de fotografia → nenhuma task introduz `<img>`/`next/image` de conteúdo além das logos já existentes ✓
- Performance (code-split por rota, 3D lazy, fontes self-hosted) → Tasks 4, 6, 7, 14-16 ✓
- Fora de escopo (logo do cliente, formulário com backend, páginas extra) → respeitado, nenhuma task adiciona isso ✓

**Consistência de tipos:** `Hero3D` exporta `{ progress: number; simplified?: boolean }` na Task 6 e é chamado exatamente assim na Task 7. `BlueprintSection` exporta `{ index, label, tone?, className?, children }` na Task 3 e todo consumidor (Tasks 8-11, 13) usa essa assinatura. `NAV_ITEMS` tem o formato `{ href, label }` usado igual no Header (Task 5).
