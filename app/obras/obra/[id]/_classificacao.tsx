'use client'

/**
 * Classificação SPOT/OBRA no cabeçalho da ficha. O botão só aparece para
 * administrador (a action e o banco barram de novo). A action entra por PROP,
 * com o tipo mínimo declarado aqui (armadilha 1 de `.claude/rules/obras.md`).
 */

import Link from 'next/link'
import { useState, useTransition } from 'react'

type Alterar = (
  obraId: string,
  modalidade: 'spot' | 'obra'
) => Promise<{ ok: true } | { ok: false; erro: string }>

export default function Classificacao({
  obraId,
  modalidade,
  admin,
  alterar,
}: {
  obraId: string
  modalidade: 'spot' | 'obra'
  admin: boolean
  alterar: Alterar
}) {
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()
  const alvo = modalidade === 'obra' ? 'spot' : 'obra'

  function trocar() {
    setErro(null)
    iniciar(async () => {
      try {
        const r = await alterar(obraId, alvo)
        if (!r.ok) setErro(r.erro)
      } catch {
        setErro('Não deu para reclassificar. Tente de novo.')
      }
    })
  }

  if (!admin && modalidade !== 'obra') return null

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {modalidade === 'obra' ? (
        <Link href={`/obras/obras/${obraId}`} className="font-semibold text-[#f05a28] hover:underline">
          Abrir na aba OBRAS →
        </Link>
      ) : null}
      {admin ? (
        <button
          type="button"
          onClick={trocar}
          disabled={pendente}
          className="min-h-9 rounded-lg border border-[#1e3a5f] px-3 py-1.5 text-[#94a3b8] hover:border-[#f05a28] hover:text-white disabled:opacity-60"
        >
          {pendente ? 'Salvando…' : modalidade === 'obra' ? 'Voltar para SPOT' : 'Tornar OBRA'}
        </button>
      ) : null}
      {erro ? <span role="alert" className="text-[#ff4d6d]">{erro}</span> : null}
    </div>
  )
}
