'use client'

import { useEffect } from 'react'

/**
 * Error boundary do Controle de Obras.
 *
 * Por que existe (revisão de 18/09/2026): o módulo não tinha nenhum, então
 * qualquer erro não tratado — uma query que falha por RLS, uma Server Action
 * cujo transporte cai no meio — levava a pessoa para a tela branca do Next, sem
 * dizer o que houve e sem caminho de volta. As gravações da ficha já tratam
 * queda de rede dentro do próprio bloco (`ERRO_DE_REDE`), preservando o que foi
 * digitado; este boundary é a rede embaixo, para o que escapar disso.
 *
 * Segue o padrão de `app/(operacoes)/sofia/error.tsx`.
 */
export default function ObrasError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[obras] erro na renderização da página:', error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center gap-4 px-6 py-20 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[#5f1e1e] bg-[#3a1a1a]">
        <span className="text-2xl">⚠️</span>
      </div>
      <h2 className="text-lg font-semibold text-[#e8eef7]">Esta tela não carregou</h2>
      <p className="max-w-[52ch] text-[13px] leading-relaxed text-[#94a3b8]">
        Nada do que você tinha preenchido foi gravado. Tente de novo; se continuar assim, avise o
        suporte — é problema do sistema, não seu.
      </p>
      {error.digest ? (
        <p className="font-mono text-[11px] text-[#64748b]">
          Código para o suporte: {error.digest}
        </p>
      ) : null}
      <button
        type="button"
        onClick={reset}
        className="rounded-md border border-[#1e3a5f] bg-[#0d2050] px-4 py-2 text-[13px] font-semibold text-[#e8eef7] hover:border-[#f05a28]"
      >
        Tentar de novo
      </button>
    </div>
  )
}
