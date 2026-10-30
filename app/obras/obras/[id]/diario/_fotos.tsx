'use client'

/**
 * Fotos do diário de obra: várias por dia, cada uma com legenda opcional.
 *
 * Mesma ordem do diário de SPOT (`app/obras/diario/_foto.tsx`): reduz no
 * aparelho (1600 px / JPEG 0,82), sobe direto do navegador para `obras-fotos`
 * e só depois registra a linha em `obras_rdo_foto`. Caminho
 * `{obra_id}/rdo/{data}/{uuid}.jpg` — uma foto nunca sobrescreve outra.
 *
 * A foto pertence a um RDO, então antes do primeiro upload o rascunho é salvo
 * (`garantirRdo`).
 */

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { reduzir } from '../../../diario/_foto'
import { registrarFotoAction, removerFotoAction } from './_actions'
import type { FotoRdo } from './_tipos'

const TAMANHO_MAXIMO_FOTO = 5 * 1024 * 1024

export default function FotosDiario({
  obraId,
  data,
  fotos: iniciais,
  garantirRdo,
  onQuantidade,
  desabilitado,
}: {
  obraId: string
  data: string
  fotos: FotoRdo[]
  garantirRdo: () => Promise<string | null>
  onQuantidade?: (n: number) => void
  desabilitado?: boolean
}) {
  const input = useRef<HTMLInputElement>(null)
  const [fotos, setFotos] = useState<FotoRdo[]>(iniciais)
  useEffect(() => onQuantidade?.(fotos.length), [fotos.length, onQuantidade])
  const [legenda, setLegenda] = useState('')
  const [enviando, setEnviando] = useState(0)
  const [erro, setErro] = useState<string | null>(null)

  async function enviarUma(rdoId: string, arquivo: File, leg: string | null) {
    if (!arquivo.type.startsWith('image/')) throw new Error('Escolha uma imagem.')
    const blob = await reduzir(arquivo)
    if (blob.type !== 'image/jpeg' || blob.size > TAMANHO_MAXIMO_FOTO) throw new Error('A foto precisa ser JPEG e ter até 5 MB.')
    const path = `${obraId}/rdo/${data}/${crypto.randomUUID()}.jpg`
    const { error } = await createClient().storage.from('obras-fotos').upload(path, blob, { contentType: 'image/jpeg' })
    if (error) throw new Error('Não deu para enviar a foto. Tente de novo.')
    const r = await registrarFotoAction(rdoId, path, leg)
    if (!r.ok) throw new Error(r.erro)
    setFotos((f) => [...f, { id: r.fotoId!, path, legenda: leg, url: URL.createObjectURL(blob) }])
  }

  async function escolher(lista: FileList | null) {
    const arquivos = Array.from(lista ?? [])
    if (input.current) input.current.value = ''
    if (!arquivos.length) return
    setErro(null)
    setEnviando(arquivos.length)
    try {
      const rdoId = await garantirRdo()
      if (!rdoId) return
      const leg = legenda.trim() || null
      for (const a of arquivos) {
        try {
          await enviarUma(rdoId, a, leg)
        } catch (e) {
          setErro(e instanceof Error ? e.message : 'Não deu para enviar a foto.')
        } finally {
          setEnviando((n) => n - 1)
        }
      }
      setLegenda('')
    } finally {
      setEnviando(0)
    }
  }

  async function remover(id: string) {
    setErro(null)
    const r = await removerFotoAction(id)
    if (!r.ok) return setErro(r.erro)
    setFotos((f) => f.filter((x) => x.id !== id))
  }

  return (
    <div className="flex flex-col gap-3">
      {fotos.length ? (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {fotos.map((f) => (
            <li key={f.id} className="overflow-hidden rounded-lg border border-[#1e3a5f] bg-[#0a1628]">
              {f.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={f.url} alt={f.legenda ?? 'Foto do diário'} className="aspect-[4/3] w-full object-cover" />
              ) : (
                <div className="flex aspect-[4/3] items-center justify-center text-xs text-[#94a3b8]">sem prévia</div>
              )}
              <div className="flex items-center justify-between gap-1 px-2 py-1.5">
                <span className="truncate text-xs text-[#e8eef7]">{f.legenda ?? '—'}</span>
                {!desabilitado ? (
                  <button
                    type="button"
                    onClick={() => remover(f.id)}
                    className="min-h-9 shrink-0 rounded px-2 text-xs text-[#ff4d6d] hover:bg-[#ff4d6d1a]"
                  >
                    tirar
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-[#94a3b8]">Nenhuma foto ainda.</p>
      )}

      {!desabilitado ? (
        <>
          <label className="flex flex-col gap-1 text-xs text-[#94a3b8]">
            Legenda da próxima foto (opcional)
            <input
              value={legenda}
              onChange={(e) => setLegenda(e.target.value)}
              placeholder="ex.: fachada, balcão, ponto 4"
              className="min-h-11 rounded-lg border border-[#1e3a5f] bg-[#0a1628] px-3 text-base text-[#e8eef7]"
            />
          </label>
          <input
            ref={input}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => escolher(e.target.files)}
          />
          <button
            type="button"
            disabled={enviando > 0}
            onClick={() => input.current?.click()}
            className="min-h-12 rounded-xl border border-[#f05a28] px-4 text-base font-semibold text-[#f05a28] disabled:opacity-45"
          >
            {enviando > 0 ? `enviando ${enviando} foto(s)…` : '📷 Tirar ou escolher fotos'}
          </button>
        </>
      ) : null}
      {erro ? <p role="alert" className="text-sm text-[#ff4d6d]">{erro}</p> : null}
    </div>
  )
}
