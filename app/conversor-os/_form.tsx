'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { registrarImportacaoAction } from './_actions'
import type { Cliente, ConversorRow, LinhaErro } from '@/lib/conversor-os/types'

interface ResultadoConversao {
  cliente: Cliente
  filename: string
  linhasOrigem: number
  linhasConvertidas: number
  duplicadosRemovidos: number
  erros: LinhaErro[]
  preview: ConversorRow[]
  arquivoBase64: string
}

function base64ParaBlob(base64: string): Blob {
  const binario = atob(base64)
  const bytes = new Uint8Array(binario.length)
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i)
  return new Blob([bytes], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

export default function ConversorForm() {
  const [cliente, setCliente] = useState<Cliente | ''>('')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [convertendo, setConvertendo] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [resultado, setResultado] = useState<ResultadoConversao | null>(null)
  const [salvo, setSalvo] = useState(false)

  async function handleConverter() {
    if (!cliente || !arquivo) return
    setConvertendo(true)
    setErro(null)
    try {
      const formData = new FormData()
      formData.set('cliente', cliente)
      formData.set('arquivo', arquivo)
      const response = await fetch('/api/conversor-os/processar', { method: 'POST', body: formData })
      const body = await response.json()
      if (!response.ok) {
        setErro(body.error ?? 'Erro ao converter a planilha')
        return
      }
      setResultado(body)
    } catch {
      setErro('Erro de rede ao converter a planilha')
    } finally {
      setConvertendo(false)
    }
  }

  function handleCancelar() {
    setResultado(null)
    setArquivo(null)
    setErro(null)
    setSalvo(false)
  }

  async function handleBaixar() {
    if (!resultado) return
    setSalvando(true)
    setErro(null)
    try {
      const blob = base64ParaBlob(resultado.arquivoBase64)

      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = resultado.filename
      link.click()
      URL.revokeObjectURL(link.href)

      const storagePath = `${resultado.cliente}/${resultado.filename}`
      const supabase = createClient()
      const { error: uploadError } = await supabase.storage
        .from('conversor-os-arquivos')
        .upload(storagePath, blob, {
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        })
      if (uploadError) {
        setErro('Arquivo baixado, mas não foi possível salvar no histórico.')
        return
      }

      const logResult = await registrarImportacaoAction({
        cliente: resultado.cliente,
        filename: resultado.filename,
        storagePath,
        linhasOrigem: resultado.linhasOrigem,
        linhasConvertidas: resultado.linhasConvertidas,
        duplicadosRemovidos: resultado.duplicadosRemovidos,
        erros: resultado.erros,
      })
      if ('error' in logResult && logResult.error) {
        setErro('Arquivo baixado, mas não foi possível salvar no histórico.')
        return
      }
      setSalvo(true)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-2">Conversor de OS</h1>
      <p className="text-[#4a6080] text-sm mb-8">
        Converte planilhas de OS do cliente para o formato de importação do Field Control
      </p>

      {erro && (
        <div className="px-4 py-3 rounded-lg border border-red-600 bg-red-950 text-red-300 text-sm mb-4">
          {erro}
        </div>
      )}

      {!resultado && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-[#94a3b8]">Cliente *</label>
            <select
              value={cliente}
              onChange={(e) => setCliente(e.target.value as Cliente)}
              className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm max-w-xs"
            >
              <option value="">Selecione</option>
              <option value="DPSP">DPSP</option>
              <option value="D1000">D1000</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-[#94a3b8]">Planilha (.xlsx) *</label>
            <input
              type="file"
              accept=".xlsx"
              onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
              className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-sm text-[#94a3b8] max-w-xs file:mr-3 file:px-3 file:py-1.5 file:rounded-md file:border-0 file:bg-[#f05a28] file:text-white file:text-sm file:font-medium file:cursor-pointer hover:file:bg-[#d94e22] cursor-pointer"
            />
          </div>

          <button
            type="button"
            disabled={!cliente || !arquivo || convertendo}
            onClick={handleConverter}
            className="self-start px-6 py-2.5 rounded-lg bg-[#f05a28] text-white text-sm font-medium hover:bg-[#d94e22] disabled:opacity-50 transition-colors active:scale-95"
          >
            {convertendo ? 'Convertendo...' : 'Converter'}
          </button>
        </div>
      )}

      {resultado && !salvo && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg bg-[#0d2050] border border-[#1e3a5f]">
              <p className="text-[#4a6080] text-xs">Linhas na origem</p>
              <p className="text-white text-lg font-semibold">{resultado.linhasOrigem}</p>
            </div>
            <div className="p-3 rounded-lg bg-[#0d2050] border border-[#1e3a5f]">
              <p className="text-[#4a6080] text-xs">Convertidas</p>
              <p className="text-white text-lg font-semibold">{resultado.linhasConvertidas}</p>
            </div>
            <div className="p-3 rounded-lg bg-[#0d2050] border border-[#1e3a5f]">
              <p className="text-[#4a6080] text-xs">Com erro</p>
              <p className="text-white text-lg font-semibold">{resultado.erros.length}</p>
            </div>
            <div className="p-3 rounded-lg bg-[#0d2050] border border-[#1e3a5f]">
              <p className="text-[#4a6080] text-xs">Duplicados removidos</p>
              <p className="text-white text-lg font-semibold">{resultado.duplicadosRemovidos}</p>
            </div>
          </div>

          {resultado.erros.length > 0 && (
            <details className="text-sm text-amber-400">
              <summary className="cursor-pointer">Ver linhas excluídas por erro</summary>
              <ul className="mt-2 flex flex-col gap-1 text-[#94a3b8]">
                {resultado.erros.map((e) => (
                  <li key={e.linha}>{e.motivo}</li>
                ))}
              </ul>
            </details>
          )}

          <div className="overflow-x-auto rounded-lg border border-[#1e3a5f]">
            <table className="w-full text-sm text-left">
              <thead className="bg-[#0d2050] text-[#94a3b8]">
                <tr>
                  <th className="px-3 py-2">Identificador</th>
                  <th className="px-3 py-2">Nome da localização</th>
                  <th className="px-3 py-2">Descrição</th>
                </tr>
              </thead>
              <tbody>
                {resultado.preview.map((row) => (
                  <tr key={row.identificador} className="border-t border-[#1e3a5f] text-white">
                    <td className="px-3 py-2">{row.identificador}</td>
                    <td className="px-3 py-2">{row.nomeLocalizacao}</td>
                    <td className="px-3 py-2">{row.descricao}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleCancelar}
              disabled={salvando}
              className="flex-1 py-2.5 rounded-lg border border-[#1e3a5f] text-[#94a3b8] text-sm hover:border-[#94a3b8] transition-colors active:scale-95 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleBaixar}
              disabled={salvando}
              className="flex-1 py-2.5 rounded-lg bg-[#f05a28] text-white text-sm font-medium hover:bg-[#d94e22] disabled:opacity-50 transition-colors active:scale-95"
            >
              {salvando ? 'Salvando...' : 'Baixar arquivo'}
            </button>
          </div>
        </div>
      )}

      {salvo && (
        <div className="flex flex-col gap-4">
          <div className="px-4 py-3 rounded-lg border border-green-600 bg-green-950 text-green-300 text-sm">
            Arquivo baixado e registrado no histórico.
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleCancelar}
              className="px-6 py-2.5 rounded-lg border border-[#1e3a5f] text-[#94a3b8] text-sm hover:border-[#94a3b8] transition-colors active:scale-95"
            >
              Converter outra planilha
            </button>
            <Link
              href="/conversor-os/historico"
              className="px-6 py-2.5 rounded-lg bg-[#f05a28] text-white text-sm font-medium hover:bg-[#d94e22] transition-colors active:scale-95"
            >
              Ver histórico
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
