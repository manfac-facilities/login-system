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
    // IMPORTANTE: não usar 'noopener'/'noreferrer' aqui — por spec, isso força
    // window.open a retornar null (mesmo criando e navegando a aba), o que
    // deixaria a aba presa em about:blank. Como a aba começa em branco e só é
    // navegada por este código para uma signed URL confiável do Supabase
    // (nunca conteúdo arbitrário), o risco que noopener mitiga não se aplica.
    const janela = window.open('', '_blank')
    if (!janela) {
      setErro('Não foi possível abrir o arquivo. Verifique o bloqueador de pop-ups.')
      return
    }
    setLoading(true)
    const result = await obterUrlDocumentoAction(storagePath)
    setLoading(false)
    if ('url' in result) {
      janela.location.href = result.url
    } else {
      janela.close()
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
