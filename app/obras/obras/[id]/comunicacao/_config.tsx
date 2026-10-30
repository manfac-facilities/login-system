'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { salvarConfigObraAction } from './_actions'
import type { ConfigObra } from './_tipos'

const campo = 'min-h-11 rounded-lg border border-[#dadad8] bg-[#ffffff] px-3 text-base text-[#333336] disabled:opacity-60'

export default function ConfigObraForm({
  obraId,
  inicial,
  baseSalva,
  admin,
}: {
  obraId: string
  inicial: ConfigObra
  baseSalva: boolean
  admin: boolean
}) {
  const router = useRouter()
  const [eng, setEng] = useState(inicial.engenheiroEmail ?? '')
  const [base, setBase] = useState(inicial.dataBase ?? '')
  const [trava, setTrava] = useState(inicial.atividadeTrava?.toString() ?? '')
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const [indo, setIndo] = useState(false)

  async function salvar() {
    setIndo(true)
    setErro(null)
    setOk(false)
    const r = await salvarConfigObraAction(obraId, {
      engenheiroEmail: eng.trim() || null,
      dataBase: base || null,
      atividadeTrava: trava.trim() ? Number(trava) : null,
    })
    setIndo(false)
    if (!r.ok) return setErro(r.erro)
    setOk(true)
    router.refresh()
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-bold text-[#00345e]">Configuração</h2>
      <label className="flex flex-col gap-1 text-xs text-[#5a7380]">
        Engenheiro (valida o diário)
        <input type="email" className={campo} disabled={!admin} value={eng} onChange={(e) => setEng(e.target.value)} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-[#5a7380]">
        Data-base {baseSalva ? '(base já salva — não muda)' : ''}
        <input type="date" className={campo} disabled={!admin || baseSalva} value={base} onChange={(e) => setBase(e.target.value)} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-[#5a7380]">
        Atividade-trava (número)
        <input type="number" min={1} step={1} className={campo} disabled={!admin} value={trava} onChange={(e) => setTrava(e.target.value)} />
      </label>
      {erro ? <p role="alert" className="text-xs text-[#b23232]">{erro}</p> : null}
      {ok ? <p role="status" className="text-xs text-[#5a7380]">Configuração salva.</p> : null}
      {admin ? (
        <button type="button" disabled={indo} onClick={salvar} className="min-h-11 self-start rounded-lg bg-[#b94606] px-4 text-sm font-semibold text-white disabled:opacity-45">
          {indo ? 'salvando…' : 'Salvar configuração'}
        </button>
      ) : null}
    </section>
  )
}
