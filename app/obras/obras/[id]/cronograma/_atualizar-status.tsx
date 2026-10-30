'use client'

/**
 * Gaveta "Atualizar status" (spec Leva 1 §5 A5): lateral no computador, tela
 * cheia no celular. Lista as atividades em andamento + não iniciadas com início
 * previsto até a data de status, por etapa. % nunca regride (o servidor também
 * garante); dias restantes é opcional; datas reais saem sozinhas e são editáveis.
 */
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { IconeCadeado, IconeCheck } from '../../_ui/icones'
import { atualizarStatusAction } from './_actions'
import type { AtividadeStatus, LinhaStatus } from './_tipos'

type Edicao = { pct: number; dias: string; concluir: boolean; inicioReal?: string; fimReal?: string }

const pctDe = (f: number) => Math.round(f * 100)
const diasTexto = (d: number | null) => (d === null ? '' : String(d))

export default function AtualizarStatus({
  obraId,
  hoje,
  atividades,
  cores,
  atividadeTrava,
  onFechar,
  onSalvo,
}: {
  obraId: string
  hoje: string
  atividades: AtividadeStatus[]
  /** Cor da etapa (chave = nome cru da etapa). */
  cores: Record<string, string>
  atividadeTrava: number | null
  onFechar: () => void
  onSalvo: () => void
}) {
  const [dataStatus, setDataStatus] = useState(hoje)
  const [edicoes, setEdicoes] = useState<Record<number, Edicao>>({})
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()
  const painelRef = useRef<HTMLDivElement>(null)
  const fecharRef = useRef(onFechar)
  useEffect(() => {
    fecharRef.current = onFechar
  }, [onFechar])

  useEffect(() => {
    // Quem abriu a gaveta (o botão "Atualizar status") recebe o foco de volta ao fechar.
    const anterior = document.activeElement instanceof HTMLElement ? document.activeElement : null
    painelRef.current?.querySelector<HTMLElement>('input, button')?.focus()
    const tecla = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        fecharRef.current()
        return
      }
      if (e.key !== 'Tab' || !painelRef.current) return
      // Foco preso na gaveta (aria-modal): Tab no último volta ao primeiro e vice-versa.
      const focaveis = [...painelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      )]
      if (!focaveis.length) return
      const primeiro = focaveis[0]
      const ultimo = focaveis[focaveis.length - 1]
      const ativo = document.activeElement
      const dentro = ativo instanceof Node && painelRef.current.contains(ativo)
      if (e.shiftKey && (ativo === primeiro || !dentro)) {
        e.preventDefault()
        ultimo.focus()
      } else if (!e.shiftKey && (ativo === ultimo || !dentro)) {
        e.preventDefault()
        primeiro.focus()
      }
    }
    window.addEventListener('keydown', tecla)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', tecla)
      document.body.style.overflow = overflow
      if (anterior?.isConnected) anterior.focus()
    }
  }, [])

  const grupos = useMemo(() => {
    const visiveis = atividades.filter(
      (a) =>
        a.status !== 'concluido' &&
        (a.status !== 'nao_iniciado' || a.percentual > 0 || a.inicioPrevisto <= dataStatus || !!edicoes[a.numero]),
    )
    const m = new Map<string, AtividadeStatus[]>()
    for (const a of visiveis) m.set(a.etapa, [...(m.get(a.etapa) ?? []), a])
    return [...m.entries()]
  }, [atividades, dataStatus, edicoes])

  const travaConcluidaAqui = atividadeTrava !== null && !!edicoes[atividadeTrava]?.concluir
  const edicaoDe = (a: AtividadeStatus): Edicao =>
    edicoes[a.numero] ?? { pct: pctDe(a.percentual), dias: diasTexto(a.diasRestantes), concluir: false }
  const mudar = (a: AtividadeStatus, campos: Partial<Edicao>) =>
    setEdicoes((e) => ({ ...e, [a.numero]: { ...edicaoDe(a), ...campos } }))

  const alteradas = Object.keys(edicoes).length

  const salvar = () =>
    iniciar(async () => {
      setErro(null)
      const linhas: LinhaStatus[] = []
      for (const [n, e] of Object.entries(edicoes)) {
        const dias = e.dias.trim().replace(',', '.')
        const diasN = dias === '' ? null : Number(dias)
        if (diasN !== null && (!Number.isFinite(diasN) || diasN < 0)) {
          setErro(`Atividade ${n}: dias restantes deve ser um número a partir de 0`)
          return
        }
        linhas.push({
          numero: Number(n),
          percentual: Math.min(100, Math.max(0, e.pct)) / 100,
          diasRestantes: diasN,
          concluir: e.concluir,
          ...(e.inicioReal !== undefined ? { inicioReal: e.inicioReal || null } : {}),
          ...(e.fimReal !== undefined ? { fimReal: e.fimReal || null } : {}),
        })
      }
      const r = await atualizarStatusAction(obraId, dataStatus, linhas)
      if (!r.ok) {
        setErro(r.erro)
        return
      }
      onSalvo()
    })

  const campo =
    'min-h-11 rounded-lg border border-(--obra-border) bg-(--obra-card) px-2.5 text-[14px] text-(--obra-text) disabled:bg-(--obra-surface) disabled:text-(--obra-muted-texto)'

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div aria-hidden="true" className="absolute inset-0 hidden bg-[#00345e]/30 lg:block" onClick={onFechar} />
      <div
        ref={painelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-status"
        className="obra-tema relative flex h-full w-full flex-col bg-(--obra-surface) shadow-2xl lg:w-[560px] lg:border-l lg:border-(--obra-border)"
      >
        <header className="flex flex-wrap items-end justify-between gap-3 border-b border-(--obra-border) bg-(--obra-card) px-4 py-3">
          <div className="min-w-0">
            <h2 id="titulo-status" className="text-[17px] font-semibold text-(--obra-ink)">
              Atualizar status
            </h2>
            <label className="mt-1 flex items-center gap-2 text-[13px] text-(--obra-muted-texto)">
              Data de status
              <input
                type="date"
                className={campo}
                value={dataStatus}
                max={hoje}
                onChange={(e) => e.target.value && setDataStatus(e.target.value)}
              />
            </label>
          </div>
          <button
            type="button"
            className="min-h-11 rounded-lg px-3 text-[14px] font-medium text-(--obra-ink) underline"
            onClick={onFechar}
          >
            Fechar
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <p className="mb-3 text-[12px] text-(--obra-muted-texto)">
            O % não volta para trás. Dias restantes é opcional: quando informado, manda na previsão de entrega.
          </p>
          {grupos.length === 0 ? (
            <p className="rounded-lg border border-dashed border-(--obra-border) bg-(--obra-card) px-3 py-8 text-center text-[14px] text-(--obra-muted-texto)">
              Nenhuma atividade em andamento ou prevista até esta data.
            </p>
          ) : null}
          {grupos.map(([etapa, lista]) => (
            <section key={etapa} className="mb-4" aria-label={etapa || 'Sem etapa'}>
              <h3 className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-(--obra-ink)">
                <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ background: cores[etapa] ?? '#9aa9b2' }} />
                {etapa || 'Sem etapa'}
              </h3>
              <ul className="flex flex-col gap-2">
                {lista.map((a) => {
                  const e = edicaoDe(a)
                  const travada = a.travada && !travaConcluidaAqui
                  const minimo = pctDe(a.percentual)
                  const idBase = `st-${a.numero}`
                  return (
                    <li key={a.numero} className="rounded-xl border border-(--obra-border) bg-(--obra-card) p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 text-[14px] font-medium text-(--obra-text)">
                          <span className="obra-num text-(--obra-muted-texto)">{a.numero}</span> · {a.descricao}
                        </p>
                        {travada ? (
                          <span className="inline-flex shrink-0 items-center gap-1 text-[12px] text-(--obra-muted-texto)">
                            <IconeCadeado tamanho={14} /> Travada
                          </span>
                        ) : null}
                      </div>
                      {travada ? (
                        <p className="mt-1 text-[12px] text-(--obra-muted-texto)">
                          Libera quando a atividade {atividadeTrava} for concluída.
                        </p>
                      ) : (
                        <>
                          <div className="mt-2 flex items-center gap-3">
                            <input
                              id={`${idBase}-r`}
                              type="range"
                              min={0}
                              max={100}
                              step={5}
                              aria-label={`Percentual da atividade ${a.numero}`}
                              className="h-11 min-w-0 flex-1 accent-(--obra-orange)"
                              value={e.concluir ? 100 : e.pct}
                              disabled={e.concluir}
                              onChange={(ev) => mudar(a, { pct: Math.max(minimo, Number(ev.target.value)) })}
                            />
                            <label className="flex items-center gap-1 text-[13px] text-(--obra-muted-texto)">
                              <input
                                type="number"
                                inputMode="numeric"
                                min={minimo}
                                max={100}
                                aria-label={`Percentual da atividade ${a.numero} (número)`}
                                className={`${campo} obra-num w-[4.5rem] text-right`}
                                value={e.concluir ? 100 : e.pct}
                                disabled={e.concluir}
                                onChange={(ev) => mudar(a, { pct: Number(ev.target.value) })}
                                onBlur={() => mudar(a, { pct: Math.min(100, Math.max(minimo, e.pct || 0)) })}
                              />
                              %
                            </label>
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_auto]">
                            <label className="flex flex-col gap-1 text-[12px] text-(--obra-muted-texto)">
                              Dias restantes
                              <input
                                type="number"
                                inputMode="decimal"
                                min={0}
                                step={0.5}
                                placeholder="opcional"
                                className={`${campo} obra-num`}
                                value={e.concluir ? '' : e.dias}
                                disabled={e.concluir}
                                onChange={(ev) => mudar(a, { dias: ev.target.value })}
                              />
                            </label>
                            <label className="flex flex-col gap-1 text-[12px] text-(--obra-muted-texto)">
                              Início real
                              <input
                                type="date"
                                className={campo}
                                value={e.inicioReal ?? a.inicioReal ?? ''}
                                placeholder="automático"
                                onChange={(ev) => mudar(a, { inicioReal: ev.target.value })}
                              />
                            </label>
                            <button
                              type="button"
                              aria-pressed={e.concluir}
                              className={`col-span-2 inline-flex min-h-11 items-center justify-center gap-1.5 self-end rounded-lg border px-3 text-[13px] font-semibold sm:col-span-1 ${
                                e.concluir
                                  ? 'border-(--obra-verde) bg-(--obra-verde) text-white'
                                  : 'border-(--obra-border) bg-(--obra-card) text-(--obra-ink)'
                              }`}
                              onClick={() => mudar(a, { concluir: !e.concluir })}
                            >
                              <IconeCheck tamanho={16} /> {e.concluir ? 'Concluída' : 'Concluir'}
                            </button>
                          </div>
                          {e.concluir ? (
                            <label className="mt-2 flex flex-col gap-1 text-[12px] text-(--obra-muted-texto)">
                              Fim real
                              <input
                                type="date"
                                className={campo}
                                value={e.fimReal ?? dataStatus}
                                onChange={(ev) => mudar(a, { fimReal: ev.target.value })}
                              />
                            </label>
                          ) : null}
                        </>
                      )}
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>

        <footer className="flex flex-col gap-2 border-t border-(--obra-border) bg-(--obra-card) px-4 py-3">
          {erro ? (
            <p role="alert" className="rounded-lg border border-[#efc2c2] bg-[#fbecec] px-3 py-2 text-[13px] text-(--obra-vermelho-texto)">
              {erro}
            </p>
          ) : null}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              className="min-h-11 rounded-lg border border-(--obra-border) px-4 text-[14px] font-medium text-(--obra-ink)"
              onClick={onFechar}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="min-h-11 rounded-lg bg-(--obra-orange) px-4 text-[14px] font-semibold text-[#1d1d1f] disabled:opacity-50"
              disabled={pendente || alteradas === 0}
              onClick={salvar}
            >
              {pendente ? 'Salvando…' : alteradas ? `Salvar (${alteradas})` : 'Salvar'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
