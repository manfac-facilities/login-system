'use client'

/**
 * A foto do dia, anexada no mesmo gesto de responder.
 *
 * ORDEM QUE NÃO SE INVERTE (spec §4.6, padrão de `lib/sofia/uploadFotos.ts`): a
 * foto sobe para o bucket ANTES de o diário ser gravado. Se o upload falhar, o
 * registro não nasce apontando para um arquivo que não existe — e, do outro
 * lado, o diário ainda pode ser salvo sem foto, porque foto NÃO trava
 * salvamento (decisão C). A ausência dela vira tarefa para a equipe.
 *
 * POR QUE O UPLOAD É NO NAVEGADOR, e não dentro da Server Action: o corpo de
 * uma Server Action tem limite de 1 MB por padrão no Next, e foto de celular
 * passa disso com folga. Mandar o arquivo direto do navegador para o Storage é
 * o mesmo caminho que `app/conversor-os/_form.tsx` já usa neste hub.
 *
 * A REDUÇÃO ANTES DE SUBIR NÃO É ENFEITE: esta tela vai ser preenchida no
 * celular, dentro da obra, no 4G que houver. 4 MB viram ~200 KB e a resposta
 * sai em vez de travar.
 *
 * Caminho fixo `{obra_id}/{data}.jpg` — determinístico, então reenviar a foto
 * do mesmo dia sobrescreve (`upsert`), nunca acumula lixo.
 */

import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const LADO_MAX = 1600
const QUALIDADE = 0.82

/** Reduz a foto no próprio aparelho. Se algo der errado, sobe o original. */
async function reduzir(arquivo: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(arquivo)
    const escala = Math.min(1, LADO_MAX / Math.max(bitmap.width, bitmap.height))
    const largura = Math.round(bitmap.width * escala)
    const altura = Math.round(bitmap.height * escala)
    const canvas = document.createElement('canvas')
    canvas.width = largura
    canvas.height = altura
    const ctx = canvas.getContext('2d')
    if (!ctx) return arquivo
    ctx.drawImage(bitmap, 0, 0, largura, altura)
    bitmap.close?.()
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', QUALIDADE))
    return blob ?? arquivo
  } catch {
    return arquivo
  }
}

export default function BotaoFoto({
  obraId,
  data,
  valor,
  onChange,
  desabilitado,
}: {
  obraId: string
  data: string
  valor: string | null
  onChange: (path: string | null) => void
  desabilitado?: boolean
}) {
  const input = useRef<HTMLInputElement>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function escolher(arquivo: File | undefined) {
    if (!arquivo) return
    setEnviando(true)
    setErro(null)
    try {
      const blob = await reduzir(arquivo)
      const path = `${obraId}/${data}.jpg`
      const supabase = createClient()
      const { error } = await supabase.storage.from('obras-fotos').upload(path, blob, {
        contentType: 'image/jpeg',
        upsert: true,
      })
      if (error) {
        setErro('Não deu para enviar a foto. Dá para salvar sem ela.')
        return
      }
      onChange(path)
    } catch {
      setErro('Não deu para enviar a foto. Dá para salvar sem ela.')
    } finally {
      setEnviando(false)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <div className="min-w-0">
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => escolher(e.target.files?.[0])}
      />
      <button
        type="button"
        aria-pressed={!!valor}
        disabled={desabilitado || enviando}
        onClick={() => input.current?.click()}
        className={
          'inline-flex min-h-11 items-center gap-1.5 rounded-md border px-3 py-2 text-sm transition disabled:opacity-45 ' +
          (valor
            ? 'border-[#35c98a] text-[#35c98a] hover:bg-[#35c98a1a]'
            : 'border-[#1e3a5f] text-[#94a3b8] hover:border-[#f05a28] hover:text-[#e8eef7]')
        }
      >
        {enviando ? 'enviando a foto…' : valor ? '✓ foto do dia anexada' : '+ anexar foto do dia'}
      </button>
      {valor ? (
        <p className="mt-1 text-[11px] text-[#64748b]">
          Toque de novo para trocar.{' '}
          <button
            type="button"
            onClick={() => onChange(null)}
            className="underline underline-offset-2 hover:text-[#e8eef7]"
          >
            tirar a foto da resposta
          </button>
        </p>
      ) : null}
      {erro ? <p className="mt-1 text-[11px] text-[#ff4d6d]">{erro}</p> : null}
    </div>
  )
}
