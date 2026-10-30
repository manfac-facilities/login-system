'use client'

/**
 * Barra de ferramentas do cronograma (spec §5): Expandir/Recolher · versão ·
 * Mostrar base · Semana/Dia · Hoje · Atualizar status · revisão/base.
 * Os controles do Gantt somem abaixo de 1024px, junto com o Gantt.
 */
import { useState, type ReactNode } from 'react'
import type { VersaoOpcao } from './_tipos'

export type Escala = 'semana' | 'dia'

/** Mesma regra e redação do diário (`SEM_BASE`): status só depois da base salva. */
export const SEM_BASE_STATUS = 'Sem cronograma — o status começa quando a base for salva'

const BOTAO =
  'inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-(--obra-border) bg-(--obra-card) px-3 text-[13px] font-medium text-(--obra-ink) transition-colors duration-150 hover:bg-(--obra-surface) disabled:opacity-50'
const PRIMARIO =
  'inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-(--obra-ink) px-3.5 text-[13px] font-semibold text-white transition-colors duration-150 hover:bg-(--obra-ink-escuro) disabled:opacity-50'
const ALTERNADO = 'aria-pressed:border-(--obra-ink) aria-pressed:bg-[#e6eef5]'

function Grupo({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={'flex flex-wrap items-center gap-2 ' + className}>{children}</div>
}

export default function BarraFerramentas({
  versoes,
  versaoNumero,
  onVersao,
  onExpandirTudo,
  onRecolherTudo,
  temBase,
  mostrarBase,
  onMostrarBase,
  escala,
  onEscala,
  onHoje,
  podeEditar,
  rascunho,
  temVigente,
  pendente,
  onAtualizarStatus,
  onNovaRevisao,
  onSalvarVersao,
}: {
  versoes: VersaoOpcao[]
  versaoNumero: number
  onVersao: (numero: number) => void
  onExpandirTudo: () => void
  onRecolherTudo: () => void
  temBase: boolean
  mostrarBase: boolean
  onMostrarBase: (v: boolean) => void
  escala: Escala
  onEscala: (e: Escala) => void
  onHoje: () => void
  podeEditar: boolean
  rascunho: { id: string; numero: number } | null
  temVigente: boolean
  pendente: boolean
  onAtualizarStatus: () => void
  onNovaRevisao: () => void
  /** Salva o rascunho; `motivo` só na revisão (v2+). */
  onSalvarVersao: (motivo: string | null, depois: () => void) => void
}) {
  const [motivo, setMotivo] = useState('')

  return (
    <div
      role="toolbar"
      aria-label="Ferramentas do cronograma"
      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2"
    >
      <Grupo>
        <button type="button" className={BOTAO} onClick={onExpandirTudo}>
          <Chevron aberto /> Expandir tudo
        </button>
        <button type="button" className={BOTAO} onClick={onRecolherTudo}>
          <Chevron aberto={false} /> Recolher tudo
        </button>
        <label className="inline-flex items-center gap-2 text-[13px] text-(--obra-muted-texto)">
          <span>Versão</span>
          <select
            className="min-h-11 rounded-lg border border-(--obra-border) bg-(--obra-card) px-2 text-[13px] font-medium text-(--obra-ink)"
            value={versaoNumero}
            onChange={(e) => onVersao(Number(e.target.value))}
          >
            {versoes.map((v) => (
              <option key={v.numero} value={v.numero}>
                {v.rotulo}
              </option>
            ))}
          </select>
        </label>
        <div className="hidden items-center gap-2 lg:flex">
          {temBase ? (
            <button
              type="button"
              aria-pressed={mostrarBase}
              className={BOTAO + ' ' + ALTERNADO}
              onClick={() => onMostrarBase(!mostrarBase)}
            >
              <svg width="18" height="10" aria-hidden="true">
                <rect x="1" y="2" width="16" height="6" rx="1.5" fill="none" stroke="var(--obra-base)" strokeWidth="1.5" strokeDasharray="3 2" />
              </svg>
              Mostrar base
            </button>
          ) : null}
          <div role="group" aria-label="Escala do Gantt" className="inline-flex">
            {(['semana', 'dia'] as const).map((e, i) => (
              <button
                key={e}
                type="button"
                aria-pressed={escala === e}
                className={BOTAO + ' ' + ALTERNADO + (i === 0 ? ' rounded-r-none' : ' -ml-px rounded-l-none')}
                onClick={() => onEscala(e)}
              >
                {e === 'semana' ? 'Semana' : 'Dia'}
              </button>
            ))}
          </div>
          <button type="button" className={BOTAO} onClick={onHoje}>
            <span aria-hidden="true" className="h-3.5 w-0.5 rounded-full bg-(--obra-orange)" /> Hoje
          </button>
        </div>
      </Grupo>

      {podeEditar ? (
        <Grupo>
          {temVigente ? (
            <button
              type="button"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-(--obra-orange) px-3.5 text-[13px] font-semibold text-[#1d1d1f] transition-colors duration-150 hover:bg-[#e65200] disabled:opacity-50"
              disabled={pendente}
              onClick={onAtualizarStatus}
            >
              Atualizar status
            </button>
          ) : (
            <span className="text-[13px] text-(--obra-muted-texto)">{SEM_BASE_STATUS}</span>
          )}
          {rascunho && rascunho.numero === 1 ? (
            <button type="button" className={PRIMARIO} disabled={pendente} onClick={() => onSalvarVersao(null, () => {})}>
              Salvar base
            </button>
          ) : null}
          {rascunho && rascunho.numero > 1 ? (
            <>
              <input
                className="min-h-11 w-56 rounded-lg border border-(--obra-border) bg-(--obra-card) px-3 text-[13px] text-(--obra-text) placeholder:text-(--obra-muted-texto)"
                placeholder="Motivo da revisão"
                aria-label="Motivo da revisão"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
              />
              <button
                type="button"
                className={PRIMARIO}
                disabled={pendente}
                onClick={() => onSalvarVersao(motivo, () => setMotivo(''))}
              >
                Salvar revisão
              </button>
            </>
          ) : null}
          {!rascunho && temVigente ? (
            <button type="button" className={BOTAO} disabled={pendente} onClick={onNovaRevisao}>
              Nova revisão
            </button>
          ) : null}
        </Grupo>
      ) : null}
    </div>
  )
}

export function Chevron({ aberto, tamanho = 14 }: { aberto: boolean; tamanho?: number }) {
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={'transition-transform duration-150 ' + (aberto ? 'rotate-90' : '')}
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  )
}
