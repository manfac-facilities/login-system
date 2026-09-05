/**
 * Primitivos visuais do módulo Controle de Obras.
 *
 * Existem para que as frentes de tela não reinventem — e não colidam — nos mesmos
 * componentes. Reproduzem as classes do mockup aprovado (`.pill`, `.box`, `.box-h`,
 * `.box-b`, `.placeholder`) com o tema do hub em hex literal, que é como este projeto
 * escreve cor (não há `tailwind.config`).
 *
 * Sem `'use client'`: são puramente apresentacionais, então servem tanto para Server
 * quanto para Client Components. Não acrescente estado aqui.
 */

import type { ReactNode } from 'react'
import { COR_SEV, nomeEtapa, type Etapa, type Sev } from '../_lib/tipos'

/** Cores do tema do hub. Fonte: AGENTS.md. */
export const TEMA = {
  fundo: '#0a1628',
  navy: '#0d2050',
  accent: '#f05a28',
  texto: '#e8eef7',
  secundario: '#94a3b8',
  borda: '#1e3a5f',
} as const

/* -------------------------------------------------------------------------- */
/* Caixa                                                                       */
/* -------------------------------------------------------------------------- */

export function Box({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={`rounded-lg border border-[#1e3a5f] bg-[#0d2050] overflow-hidden ${className}`}
    >
      {children}
    </section>
  )
}

export function BoxH({ children, extra }: { children: ReactNode; extra?: ReactNode }) {
  return (
    <header className="flex items-center justify-between gap-3 border-b border-[#1e3a5f] px-4 py-2.5">
      <h2 className="text-sm font-semibold text-[#e8eef7]">{children}</h2>
      {extra ? <div className="text-xs text-[#94a3b8]">{extra}</div> : null}
    </header>
  )
}

export function BoxB({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`px-4 py-3 ${className}`}>{children}</div>
}

/* -------------------------------------------------------------------------- */
/* Etiquetas                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Etiqueta. `cor` é um hex; quando ausente sai no cinza neutro.
 * O mockup usa a cor de fundo em 18% de opacidade com a borda na cor cheia.
 */
export function Pill({
  children,
  cor,
  titulo,
}: {
  children: ReactNode
  cor?: string
  titulo?: string
}) {
  const c = cor ?? TEMA.secundario
  return (
    <span
      title={titulo}
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4 whitespace-nowrap"
      style={{ color: c, borderColor: c, backgroundColor: `${c}2e` }}
    >
      {children}
    </span>
  )
}

/** Etiqueta da etapa, com o nome exato aprovado no mockup. */
export function PillEtapa({ etapa, cor }: { etapa: Etapa; cor?: string }) {
  return <Pill cor={cor}>{nomeEtapa(etapa)}</Pill>
}

/** Etiqueta pintada pelo token de severidade de `sev()`. */
export function PillSev({ sev, children }: { sev: Sev; children: ReactNode }) {
  return <Pill cor={COR_SEV[sev]}>{children}</Pill>
}

/* -------------------------------------------------------------------------- */
/* Campos e listas                                                             */
/* -------------------------------------------------------------------------- */

/** Par rótulo/valor. Valor ausente aparece como travessão, nunca em branco. */
export function Campo({ rotulo, children }: { rotulo: string; children?: ReactNode }) {
  const vazio = children === null || children === undefined || children === ''
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase tracking-wide text-[#94a3b8]">{rotulo}</dt>
      <dd className={`text-sm ${vazio ? 'text-[#64748b]' : 'text-[#e8eef7]'}`}>
        {vazio ? '—' : children}
      </dd>
    </div>
  )
}

export function Campos({ children, cols = 3 }: { children: ReactNode; cols?: 2 | 3 | 4 }) {
  const g = { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3', 4: 'sm:grid-cols-4' }[cols]
  return <dl className={`grid grid-cols-1 gap-x-4 gap-y-3 ${g}`}>{children}</dl>
}

/* -------------------------------------------------------------------------- */
/* Indicadores                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Indicador do topo das telas.
 *
 * Regra do mockup que não se dobra: os KPIs olham SEMPRE a base inteira, nunca a
 * lista filtrada. Quem chama é responsável por passar o número certo.
 */
export function KPI({
  rotulo,
  valor,
  cor,
  nota,
}: {
  rotulo: string
  valor: ReactNode
  cor?: string
  nota?: string
}) {
  return (
    <div className="rounded-lg border border-[#1e3a5f] bg-[#0d2050] px-3 py-2.5">
      <div className="text-xl font-semibold leading-tight" style={{ color: cor ?? TEMA.texto }}>
        {valor}
      </div>
      <div className="mt-0.5 text-[11px] leading-tight text-[#94a3b8]">{rotulo}</div>
      {nota ? <div className="mt-1 text-[10px] leading-tight text-[#64748b]">{nota}</div> : null}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Estados                                                                     */
/* -------------------------------------------------------------------------- */

/** Estado vazio. O texto vem do mockup — não invente frase nova. */
export function EstadoVazio({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-[#1e3a5f] px-4 py-8 text-center text-sm text-[#94a3b8]">
      {children}
    </div>
  )
}

/**
 * Retângulo rotulado no lugar de uma imagem ou documento que ainda não existe.
 * O mockup desenha o LUGAR da foto, nunca uma foto — e o produto faz igual
 * enquanto não houver arquivo.
 */
export function Placeholder({ children, alto = false }: { children: ReactNode; alto?: boolean }) {
  return (
    <div
      className={`flex items-center justify-center rounded border border-dashed border-[#1e3a5f] bg-[#0a1628] px-3 text-center text-[11px] text-[#64748b] ${
        alto ? 'h-28' : 'h-16'
      }`}
    >
      {children}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Ações                                                                       */
/* -------------------------------------------------------------------------- */

export function Botao({
  children,
  tipo = 'principal',
  ...props
}: {
  children: ReactNode
  tipo?: 'principal' | 'secundario'
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const base =
    'inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-45'
  const cor =
    tipo === 'principal'
      ? 'bg-[#f05a28] text-white hover:bg-[#d94d20]'
      : 'border border-[#1e3a5f] bg-transparent text-[#e8eef7] hover:bg-[#132a52]'
  return (
    <button className={`${base} ${cor}`} {...props}>
      {children}
    </button>
  )
}
