'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { salvarCoordenadorAction } from './_actions'

/**
 * Coordenador da obra (Leva 6b): todos veem; só admin edita (a action e o
 * trigger OBRAS_PARAMETROS conferem de novo). Edita, emite e envia a planta de
 * faseamento junto com o engenheiro e o admin.
 */
export default function Coordenador({ obraId, email, admin }: { obraId: string; email: string | null; admin: boolean }) {
  const router = useRouter()
  const inicial = email ?? ''
  const [texto, setTexto] = useState(inicial)
  const [erro, setErro] = useState<string | null>(null)
  const [indo, setIndo] = useState(false)
  const mudou = texto.trim().toLowerCase() !== inicial

  async function salvar() {
    setIndo(true)
    setErro(null)
    const r = await salvarCoordenadorAction(obraId, texto)
    setIndo(false)
    if (!r.ok) return setErro(r.erro)
    router.refresh()
  }

  return (
    <section className="rounded-xl border border-(--obra-border) bg-(--obra-card) p-4">
      <h3 className="text-[15px] font-semibold text-(--obra-ink)">Coordenador (e-mail)</h3>
      <p className="mb-2 text-[13px] text-(--obra-muted-texto)">Edita, emite e envia a planta de faseamento, como o engenheiro da obra.</p>
      {admin ? (
        <div className="flex flex-col gap-1">
          <span className="flex flex-wrap items-center gap-2">
            <input
              aria-label="Coordenador (e-mail)"
              type="email"
              inputMode="email"
              placeholder="nome@manfac.com.br"
              className="min-h-11 w-72 max-w-full rounded-lg border border-(--obra-border) bg-white px-3 text-[14px] text-(--obra-text)"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
            />
            <button
              type="button"
              disabled={!mudou || indo}
              onClick={salvar}
              className="min-h-11 rounded-lg bg-(--obra-orange-texto) px-4 text-sm font-semibold text-white disabled:opacity-45"
            >
              {indo ? 'salvando…' : 'Salvar'}
            </button>
          </span>
          {erro ? <span role="alert" className="text-xs text-(--obra-vermelho-texto)">{erro}</span> : null}
        </div>
      ) : (
        <p className="text-[14px] text-(--obra-text)">{email || 'não definido'}</p>
      )}
    </section>
  )
}
