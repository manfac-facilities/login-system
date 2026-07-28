'use client'
import { useState } from 'react'
import { obterUrlDocumentoAction } from '@/app/(operacoes)/sofia/documentos/_actions'

export default function VerArquivoButton({ storagePath }: { storagePath: string }) {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    const result = await obterUrlDocumentoAction(storagePath)
    setLoading(false)
    if ('url' in result) {
      window.open(result.url, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="text-xs text-[#f05a28] hover:underline disabled:opacity-50 active:scale-95 transition-transform"
    >
      {loading ? '...' : 'Ver arquivo'}
    </button>
  )
}
