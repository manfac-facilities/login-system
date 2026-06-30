'use client'

import { useState, useTransition } from 'react'
import {
  enviarParaDescontoEmMassaAction,
  excluirMultaAction,
  excluirMultasEmMassaAction,
  atualizarAutorizacaoMultaAction,
} from './_actions'

import { formatAutorizacaoLabel, autorizacaoBadgeClass } from '@/lib/sofia/autorizacao'
import DeleteConfirmButton from '@/components/sofia/DeleteConfirmButton'
import type { MultaComRelacoes } from './page'

const statusStyle: Record<string, string> = {
  pendente: 'bg-amber-900 text-amber-300',
  validada: 'bg-blue-900 text-blue-300',
  descontada: 'bg-green-900 text-green-300',
}

export default function MultasTable({
  multas,
  isAdmin,
}: {
  multas: MultaComRelacoes[]
  isAdmin: boolean
}) {
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()
  const [erro, setErro] = useState<string | null>(null)

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

  function handleEnviarParaDesconto() {
    setErro(null)
    startTransition(async () => {
      try {
        await enviarParaDescontoEmMassaAction(Array.from(selecionadas))
        setSelecionadas(new Set())
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Erro ao processar a ação')
      }
    })
  }

  function handleExcluirSelecionadas() {
    if (!window.confirm(`Excluir ${selecionadas.size} multa(s) selecionada(s)? Essa ação não pode ser desfeita.`))
      return
    setErro(null)
    startTransition(async () => {
      try {
        await excluirMultasEmMassaAction(Array.from(selecionadas))
        setSelecionadas(new Set())
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Erro ao processar a ação')
      }
    })
  }

  return (
    <>
      {selecionadas.size > 0 && (
        <div className="flex items-center gap-3 mb-3 px-4 py-2 rounded-lg border border-[#1e3a5f] bg-[#0d2050]">
          <span className="text-sm text-[#94a3b8]">{selecionadas.size} selecionada(s)</span>
          <button
            onClick={handleEnviarParaDesconto}
            disabled={isPending}
            className="text-sm text-[#f05a28] hover:underline disabled:opacity-50 disabled:no-underline active:scale-95 transition-transform"
          >
            Enviar para desconto
          </button>
          {isAdmin && (
            <button
              onClick={handleExcluirSelecionadas}
              disabled={isPending}
              className="text-sm text-red-400 hover:underline disabled:opacity-50 disabled:no-underline active:scale-95 transition-transform"
            >
              Excluir selecionadas
            </button>
          )}
        </div>
      )}

      {erro && <p className="text-sm text-red-400 mb-3">{erro}</p>}

      <div className="rounded-xl border border-[#1e3a5f] overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e3a5f] bg-[#0d2050]">
              <th className="px-4 py-3">
                <input
                  type="checkbox"
                  checked={selecionadas.size === multas.length && multas.length > 0}
                  onChange={toggleTodas}
                  className="accent-[#f05a28]"
                />
              </th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Data</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Data de recebimento</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Veículo</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Motorista</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Tipo de infração</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Descrição</th>
              <th className="text-right px-4 py-3 text-[#4a6080] font-medium">Valor</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Desconto</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Autorização</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {multas.map((m) => (
              <tr key={m.id} className="border-b border-[#1e3a5f] hover:bg-[#0d2050] transition-colors">
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selecionadas.has(m.id)}
                    onChange={() => toggleUma(m.id)}
                    className="accent-[#f05a28]"
                  />
                </td>
                <td className="px-4 py-3 text-[#94a3b8]">{new Date(m.data).toLocaleDateString('pt-BR')}</td>
                <td className="px-4 py-3 text-[#94a3b8]">
                  {m.data_recebimento ? new Date(m.data_recebimento).toLocaleDateString('pt-BR') : '—'}
                </td>
                <td className="px-4 py-3 text-[#94a3b8] font-mono">{m.veiculos?.placa ?? '—'}</td>
                <td className="px-4 py-3 text-[#94a3b8]">{m.motoristas?.nome ?? '—'}</td>
                <td className="px-4 py-3 text-white">{m.tipo_infracao ?? '—'}</td>
                <td className="px-4 py-3 text-white">{m.descricao ?? '—'}</td>
                <td className="px-4 py-3 text-white text-right font-medium">R$ {Number(m.valor).toFixed(2)}</td>
                <td className="px-4 py-3 text-[#94a3b8] text-sm">
                  {m.tipo_desconto === 'nenhum'
                    ? '—'
                    : `${m.tipo_desconto === 'total' ? 'Total' : 'Parcial'} · R$ ${Number(m.valor_descontado ?? 0).toFixed(2)}`}
                </td>
                <td className="px-4 py-3">
                  {(() => {
                    const st = m.autorizacao_status ?? 'sem_solicitacao'
                    const badgeClass = autorizacaoBadgeClass(st)
                    const label = formatAutorizacaoLabel(st, m.autorizacao_solicitado_em ?? null)
                    return (
                      <div className="flex flex-col gap-1">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium w-fit ${badgeClass}`}>{label}</span>
                        <div className="flex gap-2">
                          {st === 'sem_solicitacao' && (
                            <form action={atualizarAutorizacaoMultaAction.bind(null, m.id)}>
                              <button name="status" value="solicitado" type="submit" className="text-xs text-amber-400 hover:underline active:scale-95 transition-transform">Solicitar</button>
                            </form>
                          )}
                          {st === 'solicitado' && (
                            <>
                              <form action={atualizarAutorizacaoMultaAction.bind(null, m.id)}>
                                <button name="status" value="autorizado" type="submit" className="text-xs text-green-400 hover:underline active:scale-95 transition-transform">Autorizar</button>
                              </form>
                              <form action={atualizarAutorizacaoMultaAction.bind(null, m.id)}>
                                <button name="status" value="sem_solicitacao" type="submit" className="text-xs text-[#4a6080] hover:underline active:scale-95 transition-transform">← Cancelar</button>
                              </form>
                            </>
                          )}
                          {st === 'autorizado' && (
                            <form action={atualizarAutorizacaoMultaAction.bind(null, m.id)}>
                              <button name="status" value="solicitado" type="submit" className="text-xs text-[#4a6080] hover:underline active:scale-95 transition-transform">← Revogar</button>
                            </form>
                          )}
                        </div>
                      </div>
                    )
                  })()}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusStyle[m.status]}`}>
                    {m.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {isAdmin && (
                    <DeleteConfirmButton action={excluirMultaAction} id={m.id} label="Excluir" />
                  )}
                </td>
              </tr>
            ))}
            {multas.length === 0 && (
              <tr>
                <td colSpan={12} className="px-4 py-12 text-center text-[#4a6080]">
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
