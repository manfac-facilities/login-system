/**
 * Peças visuais do painel gerencial — as classes do mockup aprovado
 * (`mockup-dashboard-gerencial-2026-09-28.html`: .card, .kpi, .mini, .delta,
 * .table-wrap, .tag) portadas para Tailwind com o tema do hub em hex literal.
 * Sem estado: servem aos componentes client do painel.
 */

import Link from 'next/link'
import type { ReactNode } from 'react'
import type { ObraResumo } from './_calculos'

// ------------------------------------------------------------
// Números
// ------------------------------------------------------------

const nf0 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })
const nf1 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 1 })

/** R$ sem centavos, como no mockup. */
export const R = (v: number) => 'R$ ' + nf0.format(Math.round(v))
/** Valor curto: "215 mil", "1,2 mi". */
export const K = (v: number) => (v >= 1e6 ? nf1.format(v / 1e6) + ' mi' : nf0.format(Math.round(v / 1000)) + ' mil')
export const N0 = (v: number) => nf0.format(v)
export const N1 = (v: number) => nf1.format(v)
/** `AAAA-MM-DD` → `DD/MM`. */
export const fd = (iso: string | null | undefined) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '—')

// ------------------------------------------------------------
// Blocos
// ------------------------------------------------------------

export function Secao({
  titulo,
  sub,
  extra,
  children,
}: {
  titulo: string
  sub: string
  extra?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="mt-8">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight text-[#e8eef7]">{titulo}</h2>
          <p className="mt-0.5 text-[12.5px] text-[#94a3b8]">{sub}</p>
        </div>
        {extra}
      </div>
      {children}
    </section>
  )
}

/** Rótulo "Posição de hoje" das seções que não seguem o mês (`.pos`). */
export function Posicao({ children }: { children: ReactNode }) {
  return (
    <span className="whitespace-nowrap rounded-full border border-[#294b78] bg-[#5aa9f014] px-2.5 py-0.5 text-[10.5px] font-extrabold text-[#5aa9f0]">
      {children}
    </span>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <article className={`min-w-0 overflow-hidden rounded-xl border border-[#1e3a5f] bg-[#0b1b36] ${className}`}>
      {children}
    </article>
  )
}

export function CardH({ titulo, sub }: { titulo: string; sub?: ReactNode }) {
  return (
    <div className="border-b border-[#1e3a5f] px-4 py-3">
      <h3 className="text-[15px] font-semibold text-[#e8eef7]">{titulo}</h3>
      {sub ? <p className="mt-0.5 text-[11.5px] text-[#64748b]">{sub}</p> : null}
    </div>
  )
}

export function Mini({
  rotulo,
  valor,
  cor,
  children,
  className = '',
}: {
  rotulo: string
  valor: ReactNode
  cor?: string
  children?: ReactNode
  className?: string
}) {
  return (
    <div className={`min-w-0 rounded-lg border border-[#1e3a5f] bg-[#0d205073] p-2.5 [overflow-wrap:anywhere] sm:p-3 ${className}`}>
      <span className="text-[8.5px] font-extrabold uppercase tracking-wide text-[#94a3b8] sm:text-[10px] sm:tracking-wider">
        {rotulo}
      </span>
      <div className="mt-1.5 font-mono text-[19px] font-bold tabular-nums sm:text-[22px]" style={{ color: cor ?? '#e8eef7' }}>
        {valor}
      </div>
      {children}
    </div>
  )
}

/** Botão de segmento (`.seg button`). */
export function Seg({
  itens,
  valor,
  aoEscolher,
  rotulo,
  pequeno = false,
}: {
  itens: { v: string; nome: string }[]
  valor: string
  aoEscolher: (v: string) => void
  rotulo: string
  pequeno?: boolean
}) {
  return (
    <div
      role="group"
      aria-label={rotulo}
      className="flex max-w-full gap-0.5 overflow-x-auto rounded-lg border border-[#1e3a5f] bg-[#071225] p-[3px]"
    >
      {itens.map((i) => (
        <button
          key={i.v}
          type="button"
          aria-pressed={valor === i.v}
          onClick={() => aoEscolher(i.v)}
          className={
            'whitespace-nowrap rounded-md ' +
            (pequeno ? 'px-2.5 py-1 text-[11.5px] ' : 'px-3 py-1.5 text-[12.5px] ') +
            (valor === i.v ? 'bg-[#f05a28] font-bold text-white' : 'text-[#94a3b8] hover:text-white')
          }
        >
          {i.nome}
        </button>
      ))}
    </div>
  )
}

/** Variação contra o período de comparação (`delta()` do mockup). */
export function Delta({
  atual,
  anterior,
  maiorMelhor,
  rotulo,
}: {
  atual: number
  anterior: number | null
  maiorMelhor: boolean
  rotulo: string
}) {
  const base = 'mt-2 inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 font-mono text-[11.5px] font-bold'
  if (!anterior) {
    return (
      <span className={`${base} bg-[#94a3b81a] text-[#94a3b8]`}>
        — <small className="font-sans text-[10.5px] font-medium text-[#64748b]">{rotulo}: sem base</small>
      </span>
    )
  }
  const p = ((atual - anterior) / anterior) * 100
  const plano = Math.abs(p) < 0.5
  const bom = p >= 0 === maiorMelhor
  const cls = plano
    ? 'bg-[#94a3b81a] text-[#94a3b8]'
    : bom
      ? 'bg-[#35c98a1a] text-[#35c98a]'
      : 'bg-[#ff4d6d1a] text-[#ff4d6d]'
  return (
    <span className={`${base} ${cls}`}>
      {plano ? '=' : p >= 0 ? '▲' : '▼'} {N1(Math.abs(p))}%{' '}
      {rotulo ? <small className="font-sans text-[10.5px] font-medium text-[#64748b]">{rotulo}</small> : null}
    </span>
  )
}

/** Barra de progresso até a meta, ou o aviso de "sem meta". */
export function Progresso({ valor, meta, rotuloMeta }: { valor: number; meta: number | null; rotuloMeta?: string }) {
  if (!meta) {
    return (
      <div className="mt-2.5 mb-1.5 rounded-md border border-dashed border-[#294b78] px-2 py-1 text-[11px] text-[#64748b]">
        Sem meta — obras pontuais
      </div>
    )
  }
  const pc = (valor / meta) * 100
  return (
    <>
      <div className="relative mt-2.5 mb-1.5 h-[9px] overflow-hidden rounded-full bg-[#071225]">
        <i
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${Math.min(100, pc)}%`, backgroundColor: pc >= 100 ? '#35c98a' : '#f05a28' }}
        />
      </div>
      <div className="flex justify-between gap-2 text-[11px] text-[#64748b]">
        <span>
          <b className="font-bold text-[#e8eef7]">{N0(pc)}%</b> da meta
        </span>
        <span>{rotuloMeta ?? `meta ${R(meta)}`}</span>
      </div>
    </>
  )
}

export function Barra({ pct, cor = '#5aa9f0', className = '' }: { pct: number; cor?: string; className?: string }) {
  return (
    <div className={`h-[7px] min-w-[70px] overflow-hidden rounded-full bg-[#071225] ${className}`}>
      <i className="block h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, backgroundColor: cor }} />
    </div>
  )
}

export function Tag({ cor, children }: { cor: string; children: ReactNode }) {
  return (
    <span
      className="inline-block whitespace-nowrap rounded-full border px-1.5 text-[10.5px] font-bold"
      style={{ color: cor, borderColor: `${cor}73`, backgroundColor: `${cor}14` }}
    >
      {children}
    </span>
  )
}

export function Vazio({ children }: { children: ReactNode }) {
  return <div className="px-4 py-5 text-center text-[12.5px] text-[#64748b]">{children}</div>
}

export const Chevron = ({ aberto }: { aberto: boolean }) => (
  <span className={`inline-block w-4 text-[#ff7849] transition-transform ${aberto ? 'rotate-90' : ''}`}>›</span>
)

// ------------------------------------------------------------
// Tabela de obras (a "lista detalhada" que só abre no clique)
// ------------------------------------------------------------

export const TH = 'sticky top-0 z-[1] whitespace-nowrap bg-[#0d2050] px-2.5 py-2 text-left text-[10px] uppercase tracking-wider text-[#94a3b8]'
export const TD = 'whitespace-nowrap border-t border-[#1e3a5f] px-2.5 py-2 align-middle'

export type Coluna<T> = { rotulo: string; dir?: boolean; render: (x: T) => ReactNode }

/** Colunas padrão de uma obra: OS (link para a ficha), loja, cliente (só em Todos), equipe. */
export function colunasObra<T extends { obra: ObraResumo }>(
  comCliente: boolean,
  opcoes: { equipe?: boolean } = {}
): Coluna<T>[] {
  const c: Coluna<T>[] = [
    {
      rotulo: 'OS',
      render: (x) => (
        <Link href={`/obras/obra/${x.obra.id}`} className="font-mono text-[11px] text-[#94a3b8] underline-offset-2 hover:text-[#ff7849] hover:underline">
          {x.obra.os ?? 'sem OS'}
        </Link>
      ),
    },
    { rotulo: 'Loja', render: (x) => x.obra.loja ?? '—' },
  ]
  if (comCliente) c.push({ rotulo: 'Cliente', render: (x) => x.obra.cliente })
  if (opcoes.equipe !== false) c.push({ rotulo: 'Equipe', render: (x) => x.obra.equipe })
  return c
}

export const colunaValor = <T extends { obra: ObraResumo }>(): Coluna<T> => ({
  rotulo: 'Valor',
  dir: true,
  render: (x) => (x.obra.semValor ? <span className="text-[#64748b]">sem valor</span> : R(x.obra.valor)),
})

export function TabelaObras<T extends { obra: ObraResumo }>({
  linhas,
  colunas,
  vazio = 'Nenhuma obra nesta linha.',
}: {
  linhas: T[]
  colunas: Coluna<T>[]
  vazio?: string
}) {
  if (!linhas.length) return <Vazio>{vazio}</Vazio>
  return (
    <div className="max-h-80 max-w-full overflow-auto rounded-lg border border-[#1e3a5f]">
      <table className="w-full min-w-[640px] border-collapse text-[12px]">
        <thead>
          <tr>
            {colunas.map((c) => (
              <th key={c.rotulo} className={`${TH} bg-[#0b1b36] ${c.dir ? 'text-right' : ''}`}>
                {c.rotulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.obra.id}>
              {colunas.map((c) => (
                <td key={c.rotulo} className={`${TD} ${c.dir ? 'text-right font-mono tabular-nums' : ''}`}>
                  {c.render(l)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
