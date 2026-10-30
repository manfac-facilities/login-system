'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { salvarPesoAvancoAction } from './_actions'
import type { PesoAvanco } from './_tipos'

const OPCOES: { valor: PesoAvanco; rotulo: string; ajuda: string }[] = [
  { valor: null, rotulo: 'Automático', ajuda: 'Por valor se todas as atividades têm peso de valor; senão, por duração.' },
  { valor: 'valor', rotulo: 'Por valor', ajuda: 'Cada atividade pesa pelo valor contratado.' },
  { valor: 'duracao', rotulo: 'Por duração', ajuda: 'Cada atividade pesa pelos dias de duração.' },
]

export default function PesoAvancoForm({ obraId, inicial }: { obraId: string; inicial: PesoAvanco }) {
  const router = useRouter()
  const [peso, setPeso] = useState<PesoAvanco>(inicial)
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const [indo, setIndo] = useState(false)
  const mudou = peso !== inicial

  async function salvar() {
    setIndo(true)
    setErro(null)
    setOk(false)
    const r = await salvarPesoAvancoAction(obraId, peso)
    setIndo(false)
    if (!r.ok) return setErro(r.erro)
    setOk(true)
    router.refresh()
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-bold text-[#00345e]">Peso do avanço</h2>
      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">Critério de peso do avanço físico</legend>
        {OPCOES.map((o) => (
          <label key={o.rotulo} className="flex min-h-11 items-start gap-2 text-sm text-[#333336]">
            <input type="radio" name="peso-avanco" className="mt-1" checked={peso === o.valor} onChange={() => setPeso(o.valor)} />
            <span>
              <strong>{o.rotulo}</strong>
              <span className="block text-xs text-[#5a7380]">{o.ajuda}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {mudou ? (
        <p role="status" className="rounded-lg border border-[#dadad8] bg-[#f6f6f5] p-2 text-xs text-[#333336]">
          Atenção: trocar o critério muda o % de avanço do painel, da curva S e dos relatórios, inclusive do histórico.
        </p>
      ) : null}
      {erro ? <p role="alert" className="text-xs text-[#b23232]">{erro}</p> : null}
      {ok && !mudou ? <p role="status" className="text-xs text-[#5a7380]">Critério salvo.</p> : null}
      <button type="button" disabled={indo || !mudou} onClick={salvar} className="min-h-11 self-start rounded-lg bg-[#b94606] px-4 text-sm font-semibold text-white disabled:opacity-45">
        {indo ? 'salvando…' : 'Salvar critério'}
      </button>
    </section>
  )
}
