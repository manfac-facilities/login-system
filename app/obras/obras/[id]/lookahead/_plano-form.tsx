'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { avaliarPlanoAction, fecharPlanoAction } from './_plano-actions'

export type CandidatoPlano = {
  numero: number
  rotulo: string
  periodo: string
  pronta: boolean
  restricoes: string[]
}

export type ItemAvaliar = {
  numero: number
  rotulo: string
  meta: number
  realizado: number
  cumprido: boolean
}

export type CausaOpcao = { valor: string; rotulo: string }

const campo = 'min-h-11 rounded-lg border border-[#dadad8] bg-white px-3 text-sm text-[#333336]'
const botao = 'min-h-11 rounded-lg bg-[#00345e] px-4 text-sm font-semibold text-white hover:bg-[#0d2050] disabled:opacity-60'

/** Montar o plano: Prontas pré-marcadas, aviso nas com restrição, meta por item. */
export function FormFecharPlano({ obraId, semana, candidatos }: { obraId: string; semana: string; candidatos: CandidatoPlano[] }) {
  const router = useRouter()
  const [marcados, setMarcados] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(candidatos.map((c) => [c.numero, c.pronta])),
  )
  const [metas, setMetas] = useState<Record<number, number>>(() => Object.fromEntries(candidatos.map((c) => [c.numero, 100])))
  const [erro, setErro] = useState<string | null>(null)
  const [indo, setIndo] = useState(false)

  async function fechar() {
    const itens = candidatos
      .filter((c) => marcados[c.numero])
      .map((c) => ({ numero: c.numero, meta: Math.min(100, Math.max(0, Number(metas[c.numero]) || 0)) / 100 }))
    setIndo(true)
    setErro(null)
    try {
      const r = await fecharPlanoAction(obraId, semana, itens)
      if (!r.ok) return setErro(r.erro)
      router.refresh()
    } catch {
      setErro('Não deu para fechar o plano. Confira a conexão e tente de novo.')
    } finally {
      setIndo(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {candidatos.length === 0 ? <p className="text-sm text-[#5a7380]">Nenhuma atividade prevista para esta semana.</p> : null}
      <ul className="flex flex-col gap-2">
        {candidatos.map((c) => (
          <li key={c.numero} className="flex flex-wrap items-start gap-3 rounded-xl border border-[#dadad8] bg-white p-3">
            <label className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 size-5"
                checked={!!marcados[c.numero]}
                onChange={(e) => setMarcados((m) => ({ ...m, [c.numero]: e.target.checked }))}
              />
              <span className="min-w-0 text-sm text-[#333336]">
                <span className="block font-semibold text-[#00345e]">{c.rotulo}</span>
                <span className="block text-xs text-[#5a7380]">{c.periodo}</span>
                {!c.pronta ? (
                  <span className="mt-1 block text-xs text-[#b23232]">
                    Atenção: com restrição aberta ({c.restricoes.join('; ')})
                  </span>
                ) : null}
              </span>
            </label>
            <label className="flex items-center gap-2 text-sm text-[#333336]">
              Meta %
              <input
                type="number"
                min={1}
                max={100}
                step={5}
                inputMode="numeric"
                className={`${campo} w-24`}
                value={metas[c.numero]}
                disabled={!marcados[c.numero]}
                aria-label={`Meta de ${c.rotulo} em porcentagem`}
                onChange={(e) => setMetas((m) => ({ ...m, [c.numero]: Number(e.target.value) }))}
              />
            </label>
          </li>
        ))}
      </ul>
      {erro ? (
        <p role="alert" className="text-sm text-[#b23232]">
          {erro}
        </p>
      ) : null}
      <div>
        <button type="button" className={botao} disabled={indo} onClick={fechar}>
          {indo ? 'Fechando...' : 'Fechar plano'}
        </button>
        <p className="mt-1 text-xs text-[#5a7380]">Depois de fechado, o plano não muda.</p>
      </div>
    </div>
  )
}

/** Avaliação: cumprido é calculado; não cumprido exige causa. */
export function FormAvaliarPlano({
  obraId,
  semana,
  itens,
  causas,
}: {
  obraId: string
  semana: string
  itens: ItemAvaliar[]
  causas: CausaOpcao[]
}) {
  const router = useRouter()
  const [escolhidas, setEscolhidas] = useState<Record<number, string>>({})
  const [erro, setErro] = useState<string | null>(null)
  const [indo, setIndo] = useState(false)

  async function salvar() {
    setIndo(true)
    setErro(null)
    try {
      const r = await avaliarPlanoAction(
        obraId,
        semana,
        itens.map((i) => ({ numero: i.numero, causa: i.cumprido ? null : (escolhidas[i.numero] ?? null) })),
      )
      if (!r.ok) return setErro(r.erro)
      router.refresh()
    } catch {
      setErro('Não deu para salvar. Confira a conexão e tente de novo.')
    } finally {
      setIndo(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {itens.map((i) => (
          <li key={i.numero} className="flex flex-wrap items-center gap-3 rounded-xl border border-[#dadad8] bg-white p-3">
            <div className="min-w-0 flex-1 text-sm text-[#333336]">
              <p className="font-semibold text-[#00345e]">{i.rotulo}</p>
              <p className="text-xs text-[#5a7380]">
                Meta {Math.round(i.meta * 100)}% · realizado {Math.round(i.realizado * 100)}%
              </p>
            </div>
            <span
              className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${
                i.cumprido ? 'border-[#136c38] text-[#136c38]' : 'border-[#b23232] text-[#b23232]'
              }`}
            >
              {i.cumprido ? 'Cumprido' : 'Não cumprido'}
            </span>
            {!i.cumprido ? (
              <select
                className={campo}
                aria-label={`Causa do não cumprido: ${i.rotulo}`}
                value={escolhidas[i.numero] ?? ''}
                onChange={(e) => setEscolhidas((m) => ({ ...m, [i.numero]: e.target.value }))}
              >
                <option value="">Causa...</option>
                {causas.map((c) => (
                  <option key={c.valor} value={c.valor}>
                    {c.rotulo}
                  </option>
                ))}
              </select>
            ) : null}
          </li>
        ))}
      </ul>
      {erro ? (
        <p role="alert" className="text-sm text-[#b23232]">
          {erro}
        </p>
      ) : null}
      <div>
        <button type="button" className={botao} disabled={indo} onClick={salvar}>
          {indo ? 'Salvando...' : 'Salvar avaliação'}
        </button>
        <p className="mt-1 text-xs text-[#5a7380]">A avaliação é gravada uma vez; depois só um administrador altera.</p>
      </div>
    </div>
  )
}
