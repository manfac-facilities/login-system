'use client'

/**
 * "Agendar e tirar do diário" — spec de 16/10/2026 §4.2, textos do
 * `mockup-pausa-diario.html`. Modal próprio (e não `_ui/dialogo.tsx`): aquele
 * fecha a janela a cada clique de botão, e aqui o "salvando…" e o erro
 * ("Tentar de novo") precisam aparecer com a janela aberta.
 */

import { useEffect, useRef, useState } from 'react'
import {
  ERRO_AGENDAR,
  MAX_OQUE,
  MAX_OUTRO,
  MOTIVOS_AGENDAMENTO,
  MOTIVO_OUTRO,
  SUGESTOES_AGENDAMENTO,
  ddmm,
  limitesAgendamento,
  type EntradaAgendamento,
} from '../_lib/agendamento'
import type { Obra } from '../_lib/tipos'

type ObraDoDialogo = Pick<Obra, 'id' | 'os' | 'tipo' | 'loja' | 'descricao'>

const CHIP = 'min-h-9 rounded-full border px-3 py-1.5 text-[12px] font-medium transition hover:border-[#f05a28]'
const INPUT =
  'mt-1.5 w-full rounded-md border border-[#1e3a5f] bg-[#0a1628] px-2.5 py-2 text-sm text-[#e8eef7] placeholder:text-[#4a6080] outline-none focus:border-[#f05a28]'

export default function DialogoAgendar({
  obra,
  hoje,
  admin,
  agendar,
  aoFechar,
  aoAgendar,
}: {
  obra: ObraDoDialogo
  hoje: string
  admin: boolean
  agendar: (e: EntradaAgendamento) => Promise<{ error?: string; success?: boolean }>
  aoFechar: () => void
  aoAgendar: (ate: string) => void
}) {
  const { min, max } = limitesAgendamento(hoje)
  const [oque, setOque] = useState<string>(SUGESTOES_AGENDAMENTO[0])
  const [motivo, setMotivo] = useState('')
  const [outro, setOutro] = useState('')
  const [ate, setAte] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const campoOque = useRef<HTMLInputElement>(null)

  useEffect(() => {
    campoOque.current?.focus()
    function aoTeclar(ev: KeyboardEvent) {
      if (ev.key === 'Escape') aoFechar()
    }
    document.addEventListener('keydown', aoTeclar)
    return () => document.removeEventListener('keydown', aoTeclar)
  }, [aoFechar])

  const oqueOk = oque.trim().length > 0
  const motivoOk = !!motivo && (motivo !== MOTIVO_OUTRO || outro.trim().length > 0)
  const dataOk = /^\d{4}-\d{2}-\d{2}$/.test(ate) && ate >= min && ate <= max
  const pronto = oqueOk && motivoOk && dataOk

  const dica = !oqueOk
    ? 'Diga o que vai acontecer.'
    : !motivo
      ? 'Escolha o motivo da parada.'
      : !motivoOk
        ? 'Escreva o motivo.'
        : !dataOk
          ? 'Escolha uma data entre amanhã e 30 dias.'
          : ''

  const falhaDeGravacao = erro === ERRO_AGENDAR
  const dd = dataOk ? ddmm(ate) : '__/__'

  async function confirmar() {
    setErro(null)
    setSalvando(true)
    const r = await agendar({ obraId: obra.id, oque, motivo, outro, ate })
    setSalvando(false)
    if (r.error) {
      setErro(r.error)
      return
    }
    aoAgendar(ate)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Agendar e tirar do diário"
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/60 p-3 sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) aoFechar()
      }}
    >
      <div className="my-auto w-full max-w-lg rounded-lg border border-[#1e3a5f] bg-[#0d2050] p-4 text-sm text-[#94a3b8]">
        <div className="text-[11px] uppercase tracking-wide">
          OS {obra.os ?? '—'} · {obra.tipo ?? '—'}
        </div>
        <h2 className="mt-0.5 text-[17px] font-semibold text-[#e8eef7]">Agendar e tirar do diário</h2>
        <p className="mt-0.5">
          {obra.loja ?? 'Obra sem loja'}
          {obra.descricao ? ` · ${obra.descricao}` : ''}
        </p>

        <label htmlFor="ag-oque" className="mt-3 block text-[13px] font-medium">
          O que vai acontecer?
        </label>
        <input
          id="ag-oque"
          ref={campoOque}
          type="text"
          maxLength={MAX_OQUE}
          value={oque}
          aria-label="O que vai acontecer"
          onChange={(e) => setOque(e.target.value)}
          className={INPUT}
        />
        <div className="mt-2 flex flex-wrap gap-2">
          {SUGESTOES_AGENDAMENTO.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setOque(s)}
              className={`${CHIP} border-[#1e3a5f] text-[#94a3b8]`}
            >
              {s}
            </button>
          ))}
        </div>

        <span className="mt-3 block text-[13px] font-medium">Por que a obra está parada?</span>
        <div className="mt-1.5 flex flex-wrap gap-2" role="group" aria-label="Por que a obra está parada?">
          {[...MOTIVOS_AGENDAMENTO, MOTIVO_OUTRO].map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={motivo === m}
              onClick={() => setMotivo(m)}
              className={`${CHIP} ${
                motivo === m ? 'border-[#f05a28] bg-[#f05a28] text-white' : 'border-[#1e3a5f] text-[#94a3b8]'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
        {motivo === MOTIVO_OUTRO ? (
          <input
            type="text"
            maxLength={MAX_OUTRO}
            value={outro}
            placeholder="Escreva o motivo em uma linha"
            aria-label="Outro motivo"
            onChange={(e) => setOutro(e.target.value)}
            className={INPUT}
          />
        ) : null}

        <label htmlFor="ag-ate" className="mt-3 block text-[13px] font-medium">
          Até quando? (a obra volta ao diário nesse dia)
        </label>
        <input
          id="ag-ate"
          type="date"
          min={min}
          max={max}
          value={ate}
          aria-label="Até quando"
          onChange={(e) => setAte(e.target.value)}
          className={`${INPUT} max-w-56`}
        />
        <p className="mt-1 text-[11px] text-[#64748b]">
          Entre {ddmm(min)} e {ddmm(max)} (máximo de 30 dias).
        </p>

        <div className="mt-3 rounded-md border border-[#1e3a5f] bg-[#0a1628] px-3 py-2.5 text-[12px]">
          <b className="text-[#e8eef7]">O que acontece quando você confirmar</b>
          <ul className="mt-1 list-disc pl-5">
            <li>
              A obra sai do diário até <b className="text-[#e8eef7]">{dd}</b>. Ninguém precisa responder o diário
              dela até lá.
            </li>
            <li>
              No dia <b className="text-[#e8eef7]">{dd}</b> ela volta sozinha para o diário.
            </li>
            <li>
              O agendamento aparece em Tarefas, com{' '}
              <b className="text-[#e8eef7]">{admin ? 'você (admin)' : 'você'}</b> como dono.
            </li>
            <li>Ela deixa de contar no &quot;Responderam X/Y&quot; do painel e do e-mail das 8h.</li>
          </ul>
        </div>

        {falhaDeGravacao ? (
          <div role="alert" className="mt-3 rounded-md border border-[#ff4d6d] px-3 py-2.5 text-[12px]">
            <div className="font-semibold text-[#ff4d6d]">Não deu para agendar</div>A conexão falhou na hora de
            salvar. <b className="text-[#e8eef7]">Nada mudou:</b> a obra continua no diário e nenhuma tarefa foi
            criada. Tente de novo; se continuar, avise o suporte da Manfac.
          </div>
        ) : null}

        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={aoFechar}
            className="min-h-11 rounded-md border border-[#1e3a5f] px-3 py-2 text-sm font-medium text-[#e8eef7] hover:bg-[#132a52]"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!pronto || salvando}
            onClick={confirmar}
            className="min-h-11 rounded-md bg-[#f05a28] px-3 py-2 text-sm font-medium text-white hover:bg-[#d94d20] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {salvando ? 'salvando…' : falhaDeGravacao ? 'Tentar de novo' : 'Agendar e tirar do diário'}
          </button>
        </div>
        <p className="mt-1.5 min-h-4 text-[12px] text-[#f4b73f]" aria-live="polite">
          {erro && !falhaDeGravacao ? erro : dica}
        </p>
      </div>
    </div>
  )
}
