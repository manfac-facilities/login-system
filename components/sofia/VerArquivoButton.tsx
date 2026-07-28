'use client'
import { useState } from 'react'
import { obterUrlDocumentoAction } from '@/app/(operacoes)/sofia/documentos/_actions'

export default function VerArquivoButton({ storagePath }: { storagePath: string }) {
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function handleClick() {
    setErro(null)
    // Abre a aba em branco de forma síncrona, ainda dentro do gesto do usuário —
    // no iOS Safari, window.open após um await é bloqueado como popup.
    const janela = window.open('', '_blank', 'noopener,noreferrer')
    setLoading(true)
    const result = await obterUrlDocumentoAction(storagePath)
    setLoading(false)
    if ('url' in result) {
      if (janela) janela.location.href = result.url
    } else {
      janela?.close()
      setErro(result.error)
    }
  }

  return (
    <div className="flex flex-col gap-1 items-start">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="text-xs text-[#f05a28] hover:underline disabled:opacity-50 active:scale-95 transition-transform"
      >
        {loading ? '...' : 'Ver arquivo'}
      </button>
      {erro && <p className="text-red-400 text-xs">{erro}</p>}
    </div>
  )
}
