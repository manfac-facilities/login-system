'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { excluirMultaAction, excluirMultasEmMassaAction } from './_actions'
import DeleteConfirmButton from '@/components/sofia/DeleteConfirmButton'
import { classePrazo, infoEtapa } from '@/lib/sofia/multaEtapas'
import PillPrazo from './_pill'
import type { MultaComRelacoes } from './page'

const fmtData = (d: string | null) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString('pt-BR') : '—')

export default function MultasTable({
  multas,
  podeGerir,
  hoje,
}: {
  multas: MultaComRelacoes[]
  podeGerir: boolean
  hoje: string
}) {
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const router = useRouter()

  function toggleUma(id: string) {
    setSelecionadas((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleTodas() {
    setSelecionadas((prev) => (prev.size === multas.length ? new Set() : new Set(multas.map((m) => m.id))))
  }

  function handleExcluirSelecionadas() {
    if (!window.confirm(`Excluir ${selecionadas.size} multa(s) selecionada(s)? Essa ação não pode ser desfeita.`))
      return
    setErro(null)
    startTransition(async () => {
      try {
        await excluirMultasEmMassaAction(Array.from(selecionadas))
        setSelecionadas(new Set())
      } catch {
        setErro('Erro ao excluir as multas selecionadas')
      }
    })
  }

  return (
    <>
      {podeGerir && selecionadas.size > 0 && (
        <div className="flex items-center gap-3 mb-3 px-4 py-2 rounded-lg border border-[#1e3a5f] bg-[#0d2050]">
          <span className="text-sm text-[#94a3b8]">{selecionadas.size} selecionada(s)</span>
          <button
            onClick={handleExcluirSelecionadas}
            disabled={isPending}
            className="text-sm text-red-400 hover:underline disabled:opacity-50 disabled:no-underline active:scale-95 transition-transform"
          >
            Excluir selecionadas
          </button>
        </div>
      )}

      {erro && <p className="text-sm text-red-400 mb-3">{erro}</p>}

      <div className="rounded-xl border border-[#1e3a5f] overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e3a5f] bg-[#0d2050]">
              <th className="px-4 py-3">
                {podeGerir && (
                  <input
                    type="checkbox"
                    checked={selecionadas.size === multas.length && multas.length > 0}
                    onChange={toggleTodas}
                    className="accent-[#f05a28]"
                  />
                )}
              </th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Data</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Veículo</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Motorista</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Tipo de infração</th>
              <th className="text-right px-4 py-3 text-[#4a6080] font-medium">Valor</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Etapa</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Prazo</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {multas.map((m) => (
              <tr
                key={m.id}
                onClick={() => router.push(`/sofia/multas/${m.id}`)}
                className="border-b border-[#1e3a5f] hover:bg-[#0d2050] transition-colors cursor-pointer"
              >
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  {podeGerir && (
                    <input
                      type="checkbox"
                      checked={selecionadas.has(m.id)}
                      onChange={() => toggleUma(m.id)}
                      className="accent-[#f05a28]"
                    />
                  )}
                </td>
                <td className="px-4 py-3 text-[#94a3b8] whitespace-nowrap">{fmtData(m.data)}</td>
                <td className="px-4 py-3 text-[#94a3b8] font-mono">{m.veiculos?.placa ?? '—'}</td>
                <td className="px-4 py-3 text-[#94a3b8]">{m.motoristas?.nome ?? '—'}</td>
                <td className="px-4 py-3 text-white">
                  <Link href={`/sofia/multas/${m.id}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
                    {m.tipo_infracao ?? m.descricao ?? '—'}
                  </Link>
                </td>
                <td className="px-4 py-3 text-white text-right font-medium whitespace-nowrap">
                  R$ {Number(m.valor).toFixed(2)}
                </td>
                <td className="px-4 py-3 text-[#94a3b8]">{infoEtapa(m.etapa)?.rotulo ?? m.etapa}</td>
                <td className="px-4 py-3">
                  <PillPrazo prazo={classePrazo(m.prazo_indicacao, m.etapa, hoje)} />
                </td>
                <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                  {podeGerir && (
                    <DeleteConfirmButton
                      action={excluirMultaAction}
                      id={m.id}
                      label="Excluir"
                      itemLabel={`multa de ${m.veiculos?.placa ?? 'veículo sem placa'} — R$ ${Number(m.valor).toFixed(2)}`}
                    />
                  )}
                </td>
              </tr>
            ))}
            {multas.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-[#4a6080]">
                  Nenhuma multa registrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
