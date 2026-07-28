'use client'
import { useActionState, useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { criarDocumentoAction } from '../_actions'
import { createClient } from '@/lib/supabase/client'
import { DOCUMENTO_TIPOS, DOCUMENTO_TIPO_LABELS } from '@/lib/sofia/enums'
import { comprimirImagem } from '@/lib/sofia/comprimirImagem'
import type { Veiculo } from '@/lib/sofia/types'

export default function NovoDocumentoForm({ veiculos }: { veiculos: Veiculo[] }) {
  const [state, formAction, isPending] = useActionState(criarDocumentoAction, {})
  const [, startTransition] = useTransition()
  const router = useRouter()
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  useEffect(() => {
    if (state.success) router.push('/sofia/documentos')
  }, [state.success, router])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setUploadError(null)
    const fd = new FormData(e.currentTarget)
    const arquivo = fd.get('arquivo') as File | null

    try {
      if (arquivo && arquivo.size > 0) {
        setUploading(true)
        const supabase = createClient()
        let paraEnviar: Blob = arquivo
        if (arquivo.type.startsWith('image/')) {
          try {
            paraEnviar = await comprimirImagem(arquivo)
          } catch (compressError) {
            console.warn('Não foi possível comprimir o arquivo, usando original:', compressError)
            paraEnviar = arquivo
          }
        }
        const path = `documentos/${crypto.randomUUID()}-${arquivo.name}`
        const { error } = await supabase.storage.from('sofia-anexos').upload(path, paraEnviar, {
          contentType: paraEnviar.type,
        })
        if (error) {
          setUploadError('Falha ao enviar o arquivo. Tente novamente.')
          return
        }
        fd.set('storage_path', path)
      }
      fd.delete('arquivo')

      startTransition(() => { formAction(fd) })
    } catch (e) {
      console.warn('Falha inesperada ao enviar o arquivo:', e)
      setUploadError('Falha ao enviar o arquivo. Tente novamente.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="p-8 max-w-md">
      <h1 className="text-2xl font-bold text-white mb-2">Adicionar Documento</h1>
      <p className="text-[#4a6080] text-sm mb-8">Seguro, licenciamento, IPVA, contrato de locação ou outro</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {state.error && (
          <div className="px-4 py-3 rounded-lg border border-red-600 bg-red-950 text-red-300 text-sm">
            {state.error}
          </div>
        )}
        {uploadError && (
          <div className="px-4 py-3 rounded-lg border border-red-600 bg-red-950 text-red-300 text-sm">
            {uploadError}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Veículo *</label>
          <select name="veiculo_id" required className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm">
            <option value="">Selecione</option>
            {veiculos.map((v) => (
              <option key={v.id} value={v.id}>{v.placa} · {v.modelo}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Tipo *</label>
          <select name="tipo" required defaultValue="seguro" className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm">
            {DOCUMENTO_TIPOS.map((t) => (
              <option key={t} value={t}>{DOCUMENTO_TIPO_LABELS[t]}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Número/Apólice</label>
          <input name="numero" placeholder="Número do documento" className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white placeholder-[#4a6080] focus:outline-none focus:border-[#f05a28] text-sm" />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Vencimento *</label>
          <input name="vencimento" type="date" required className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm [color-scheme:dark]" />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Arquivo (opcional)</label>
          <input
            name="arquivo"
            type="file"
            accept="application/pdf,image/*"
            className="text-sm text-[#94a3b8] file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-[#f05a28] file:text-white file:text-sm file:cursor-pointer"
          />
        </div>

        <div className="flex gap-3 mt-2">
          <button type="button" onClick={() => router.back()} className="flex-1 py-2.5 rounded-lg border border-[#1e3a5f] text-[#94a3b8] text-sm hover:border-[#94a3b8] active:scale-95 transition-[border-color,transform]">
            Cancelar
          </button>
          <button type="submit" disabled={isPending || uploading} className="flex-1 py-2.5 rounded-lg bg-[#f05a28] text-white text-sm font-medium hover:bg-[#d94e22] disabled:opacity-50 transition-colors active:scale-95">
            {uploading ? 'Enviando arquivo...' : isPending ? 'Salvando...' : 'Adicionar Documento'}
          </button>
        </div>
      </form>
    </div>
  )
}
