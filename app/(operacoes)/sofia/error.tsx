'use client'

import { useEffect } from 'react'

/**
 * Error boundary do módulo Gestão de Frotas (achado B-08 da auditoria).
 * Antes, uma falha de query (RLS/timeout) era engolida e a tela mostrava
 * "lista vazia" — indistinguível de "não há registros". Agora as funções de
 * leitura propagam o erro e este boundary o exibe com opção de recarregar.
 */
export default function SofiaError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[sofia] erro na renderização da página:', error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 px-6 text-center">
      <div className="w-14 h-14 rounded-full bg-[#3a1a1a] border border-[#5f1e1e] flex items-center justify-center">
        <span className="text-2xl">⚠️</span>
      </div>
      <div className="flex flex-col gap-1">
        <h2 className="text-white text-lg font-semibold">Não foi possível carregar os dados</h2>
        <p className="text-[#94a3b8] text-sm max-w-md">
          {error.message || 'Ocorreu um erro ao buscar as informações do sistema.'} Se o problema
          persistir, avise o suporte.
        </p>
      </div>
      <button
        onClick={reset}
        className="px-4 py-2.5 rounded-lg bg-[#f05a28] text-white text-sm font-medium hover:bg-[#d94d1f] active:scale-95 transition-[background-color,transform]"
      >
        Tentar novamente
      </button>
    </div>
  )
}
