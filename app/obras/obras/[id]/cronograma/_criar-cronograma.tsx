'use client'

/** Item 15: OBRA sem cronograma → "Criar cronograma" abre a v1 em rascunho, vazia, na visão Tabela. */
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { criarCronogramaAction } from './_actions'

export default function CriarCronograma({ obraId }: { obraId: string }) {
  const router = useRouter()
  const [pendente, iniciar] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  return (
    <span className="mt-4 flex flex-col items-center gap-2">
      <button
        type="button"
        disabled={pendente}
        className="inline-flex min-h-11 items-center rounded-lg bg-(--obra-ink) px-4 text-[14px] font-semibold text-white hover:bg-(--obra-ink-escuro) disabled:opacity-50"
        onClick={() =>
          iniciar(async () => {
            setErro(null)
            const r = await criarCronogramaAction(obraId)
            if (!r.ok) return setErro(r.erro)
            router.refresh()
          })
        }
      >
        {pendente ? 'Criando…' : 'Criar cronograma'}
      </button>
      {erro ? <span role="alert" className="text-[13px] text-(--obra-vermelho-texto)">{erro}</span> : null}
    </span>
  )
}
