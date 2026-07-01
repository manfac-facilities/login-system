'use client'

import { useState } from 'react'
import { obterUrlDownloadAction } from '../_actions'

interface Importacao {
  id: string
  cliente: string
  filename: string
  storage_path: string
  user_email: string
  total_rows: number
  converted_rows: number
  duplicates_removed: number
  imported_at: string
}

export default function HistoricoTable({
  importacoes,
  mostrarUsuario,
}: {
  importacoes: Importacao[]
  mostrarUsuario: boolean
}) {
  const [baixandoId, setBaixandoId] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  async function handleBaixarNovamente(importacao: Importacao) {
    setBaixandoId(importacao.id)
    setErro(null)
    const result = await obterUrlDownloadAction(importacao.storage_path)
    setBaixandoId(null)
    if ('error' in result) {
      setErro(result.error)
      return
    }
    window.open(result.url, '_blank')
  }

  if (importacoes.length === 0) {
    return <p className="text-[#4a6080] text-sm">Nenhuma importação registrada ainda.</p>
  }

  return (
    <div className="flex flex-col gap-3">
      {erro && (
        <div className="px-4 py-3 rounded-lg border border-red-600 bg-red-950 text-red-300 text-sm">
          {erro}
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border border-[#1e3a5f]">
        <table className="w-full text-sm text-left">
          <thead className="bg-[#0d2050] text-[#94a3b8]">
            <tr>
              <th className="px-3 py-2">Data</th>
              <th className="px-3 py-2">Cliente</th>
              {mostrarUsuario && <th className="px-3 py-2">Usuário</th>}
              <th className="px-3 py-2">Convertidas</th>
              <th className="px-3 py-2">Duplicados</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {importacoes.map((importacao) => (
              <tr key={importacao.id} className="border-t border-[#1e3a5f] text-white">
                <td className="px-3 py-2">{new Date(importacao.imported_at).toLocaleString('pt-BR')}</td>
                <td className="px-3 py-2">{importacao.cliente}</td>
                {mostrarUsuario && <td className="px-3 py-2">{importacao.user_email}</td>}
                <td className="px-3 py-2">
                  {importacao.converted_rows} / {importacao.total_rows}
                </td>
                <td className="px-3 py-2">{importacao.duplicates_removed}</td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => handleBaixarNovamente(importacao)}
                    disabled={baixandoId === importacao.id}
                    className="text-[#f05a28] hover:underline disabled:opacity-50"
                  >
                    {baixandoId === importacao.id ? 'Gerando link...' : 'Baixar novamente'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
