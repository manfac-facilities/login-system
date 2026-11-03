'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { salvarObraMaeAction } from './_actions'
import { rotuloObra, type ObraParaMae } from './_tipos'

/** "Esta obra é aditivo de…" (admin). A mãe lista as filhas. */
export default function ObraMaeForm({
  obraId,
  maeAtual,
  opcoes,
  bloqueio,
  filhas,
}: {
  obraId: string
  maeAtual: string | null
  opcoes: ObraParaMae[]
  bloqueio: string | null
  filhas: ObraParaMae[]
}) {
  const router = useRouter()
  const [mae, setMae] = useState(maeAtual ?? '')
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const [indo, setIndo] = useState(false)
  const mudou = (mae || null) !== maeAtual

  async function salvar() {
    setIndo(true)
    setErro(null)
    setOk(false)
    try {
      const r = await salvarObraMaeAction(obraId, mae || null)
      if (!r.ok) return setErro(r.erro)
      setOk(true)
      router.refresh()
    } catch {
      setErro('Não deu para salvar. Confira a conexão e tente de novo.')
    } finally {
      setIndo(false)
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-bold text-[#00345e]">Aditivo (OS filha)</h2>
      {bloqueio ? (
        <p className="text-sm text-[#5a7380]">{bloqueio}</p>
      ) : (
        <>
          <label className="flex flex-col gap-1 text-sm text-[#333336]">
            Esta obra é aditivo de…
            <select
              value={mae}
              onChange={(e) => setMae(e.target.value)}
              className="min-h-11 w-full rounded-lg border border-[#dadad8] bg-white px-3 text-sm text-[#333336]"
            >
              <option value="">Nenhuma (obra principal)</option>
              {opcoes.map((o) => (
                <option key={o.id} value={o.id}>
                  {rotuloObra(o)}
                </option>
              ))}
            </select>
          </label>
          <p className="text-xs text-[#5a7380]">Custo e receita do aditivo ficam nesta OS e somam na obra mãe.</p>
          {erro ? <p role="alert" className="text-xs text-[#b23232]">{erro}</p> : null}
          {ok && !mudou ? <p role="status" className="text-xs text-[#5a7380]">Salvo.</p> : null}
          <button
            type="button"
            disabled={indo || !mudou}
            onClick={salvar}
            className="min-h-11 self-start rounded-lg bg-[#b94606] px-4 text-sm font-semibold text-white disabled:opacity-45"
          >
            {indo ? 'salvando…' : 'Salvar'}
          </button>
        </>
      )}
      {filhas.length ? (
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold text-[#00345e]">Aditivos desta obra</p>
          <ul className="flex flex-col gap-1">
            {filhas.map((f) => (
              <li key={f.id}>
                <Link href={`/obras/obras/${f.id}`} className="inline-flex min-h-11 items-center text-sm text-[#b94606] underline">
                  {rotuloObra(f)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
