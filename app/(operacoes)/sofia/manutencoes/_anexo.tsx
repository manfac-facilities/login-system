'use client'

/**
 * "Anexar orçamento ou nota" (gestor; um arquivo, substitui o anterior). Upload no navegador para
 * `sofia-anexos` em `manutencoes/<id>/<timestamp>-<nome>`, no padrão de documentos/novo/_form.tsx
 * (PDF ou imagem; imagem comprimida). A action só aceita esse prefixo.
 */
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { comprimirImagem } from '@/lib/sofia/comprimirImagem'
import { anexarManutencaoAction } from './_actions'

const nomeSeguro = (n: string) =>
  n.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').slice(-80) || 'arquivo'

export default function AnexoManutencao({ id, temArquivo }: { id: string; temArquivo: boolean }) {
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function enviar(arquivo: File | undefined) {
    setErro(null)
    if (!arquivo) return
    if (!arquivo.type.startsWith('image/') && arquivo.type !== 'application/pdf') {
      setErro('Envie um PDF ou uma imagem.')
      return
    }
    setEnviando(true)
    try {
      let corpo: Blob = arquivo
      if (arquivo.type.startsWith('image/')) {
        try {
          corpo = await comprimirImagem(arquivo)
        } catch (e) {
          console.warn('Não foi possível comprimir o arquivo, usando original:', e)
        }
      }
      const path = `manutencoes/${id}/${Date.now()}-${nomeSeguro(arquivo.name)}`
      const { error } = await createClient().storage.from('sofia-anexos').upload(path, corpo, { contentType: corpo.type })
      if (error) {
        setErro('Falha ao enviar o arquivo. Tente novamente.')
        return
      }
      const r = await anexarManutencaoAction(id, path)
      if (r.error) setErro(r.error)
      else router.refresh()
    } catch (e) {
      console.warn('Falha inesperada ao enviar o arquivo:', e)
      setErro('Falha ao enviar o arquivo. Tente novamente.')
    } finally {
      setEnviando(false)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <input ref={input} type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => enviar(e.target.files?.[0])} />
      <button type="button" disabled={enviando} onClick={() => input.current?.click()} className="text-sm text-[#f05a28] hover:underline disabled:opacity-50">
        {enviando ? 'Enviando…' : temArquivo ? 'Trocar anexo (orçamento ou nota)' : 'Anexar orçamento ou nota'}
      </button>
      {erro && <span className="text-xs text-red-400">{erro}</span>}
    </span>
  )
}
