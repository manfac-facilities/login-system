'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { adicionarFeriadoObraAction, removerFeriadoObraAction } from './_actions'
import { ABRANGENCIAS_FERIADO, type AbrangenciaFeriado, type FeriadoObra } from './_tipos'

const campo = 'min-h-11 rounded-lg border border-[#dadad8] bg-[#ffffff] px-3 text-base text-[#333336]'
const dataBR = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`

export default function FeriadosObra({ obraId, feriados }: { obraId: string; feriados: FeriadoObra[] }) {
  const router = useRouter()
  const [data, setData] = useState('')
  const [descricao, setDescricao] = useState('')
  const [abrangencia, setAbrangencia] = useState<AbrangenciaFeriado>('municipal')
  const [erro, setErro] = useState<string | null>(null)
  const [indo, setIndo] = useState(false)

  async function adicionar() {
    setIndo(true)
    setErro(null)
    const r = await adicionarFeriadoObraAction(obraId, { data, descricao, abrangencia })
    setIndo(false)
    if (!r.ok) return setErro(r.erro)
    setData('')
    setDescricao('')
    router.refresh()
  }

  async function remover(d: string) {
    if (!window.confirm(`Remover o feriado de ${dataBR(d)}? As datas calculadas da obra mudam.`)) return
    setIndo(true)
    setErro(null)
    const r = await removerFeriadoObraAction(obraId, d)
    setIndo(false)
    if (!r.ok) return setErro(r.erro)
    router.refresh()
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-bold text-[#00345e]">Feriados da obra</h2>
      <p className="rounded-lg border border-[#dadad8] bg-[#f6f6f5] p-2 text-xs text-[#333336]">
        Atenção: feriado da obra muda as datas calculadas do cronograma, inclusive as da base. Os feriados globais valem para todas as obras.
      </p>
      {feriados.length === 0 ? (
        <p className="text-sm text-[#5a7380]">Nenhum feriado cadastrado</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {feriados.map((f) => (
            <li key={`${f.global ? 'g' : 'o'}-${f.data}`} className="flex items-center justify-between gap-2 rounded-lg border border-[#dadad8] px-3 py-1 text-sm text-[#333336]">
              <span>
                <span className="obra-num">{dataBR(f.data)}</span> · {f.descricao}{' '}
                <span className="text-xs text-[#5a7380]">({f.global ? 'todas as obras' : f.abrangencia})</span>
              </span>
              {f.global ? null : (
                <button type="button" disabled={indo} onClick={() => remover(f.data)} className="min-h-11 px-2 text-xs font-semibold text-[#b23232] disabled:opacity-45">
                  Remover
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-col gap-2">
        <label className="flex flex-col gap-1 text-xs text-[#5a7380]">
          Data
          <input type="date" className={campo} value={data} onChange={(e) => setData(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-[#5a7380]">
          Descrição
          <input type="text" className={campo} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-[#5a7380]">
          Abrangência
          <select className={campo} value={abrangencia} onChange={(e) => setAbrangencia(e.target.value as AbrangenciaFeriado)}>
            {ABRANGENCIAS_FERIADO.map((a) => (
              <option key={a.valor} value={a.valor}>{a.rotulo}</option>
            ))}
          </select>
        </label>
      </div>
      {erro ? <p role="alert" className="text-xs text-[#b23232]">{erro}</p> : null}
      <button type="button" disabled={indo || !data || !descricao.trim()} onClick={adicionar} className="min-h-11 self-start rounded-lg bg-[#b94606] px-4 text-sm font-semibold text-white disabled:opacity-45">
        {indo ? 'salvando…' : 'Adicionar feriado'}
      </button>
    </section>
  )
}
