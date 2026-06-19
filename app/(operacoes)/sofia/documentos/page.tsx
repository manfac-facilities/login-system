import { getDocumentosVeiculo } from '@/lib/sofia/queries'
import type { DocumentoVeiculo } from '@/lib/sofia/types'
import Link from 'next/link'
import StatCard from '@/components/sofia/StatCard'
import FilterSelect from '@/components/sofia/FilterSelect'
import PrintExportButton from '@/components/sofia/PrintExportButton'

const PAGE_SIZE = 10

type DocumentoComVeiculo = DocumentoVeiculo & {
  statusCalc: 'valido' | 'vence_30d' | 'vencido'
  veiculos: { placa: string; modelo: string } | null
}

const statusStyle: Record<string, string> = {
  valido: 'bg-green-900 text-green-300',
  vence_30d: 'bg-amber-900 text-amber-300',
  vencido: 'bg-red-900 text-red-300',
}

const statusLabel: Record<string, string> = {
  valido: 'Válido',
  vence_30d: 'Vence em 30d',
  vencido: 'Vencido',
}

const tipoLabel: Record<string, string> = {
  seguro: 'Seguro',
  licenciamento: 'CRLV',
  ipva: 'IPVA',
  outro: 'Outro',
}

const tipoOptions = Object.entries(tipoLabel).map(([value, label]) => ({ value, label }))
const statusOptions = Object.entries(statusLabel).map(([value, label]) => ({ value, label }))

function computeStatus(vencimento: string): 'valido' | 'vence_30d' | 'vencido' {
  const hoje = new Date()
  const hojeUTC = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
  const diffDias = (new Date(vencimento).getTime() - hojeUTC) / (1000 * 60 * 60 * 24)
  if (diffDias < 0) return 'vencido'
  if (diffDias <= 30) return 'vence_30d'
  return 'valido'
}

export default async function DocumentosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tipo?: string; status?: string; page?: string }>
}) {
  const { q, tipo, status, page } = await searchParams
  const documentos = (await getDocumentosVeiculo()) as (DocumentoVeiculo & {
    veiculos: { placa: string; modelo: string } | null
  })[]
  const comStatus: DocumentoComVeiculo[] = documentos.map((d) => ({ ...d, statusCalc: computeStatus(d.vencimento) }))

  const vencidos = comStatus.filter((d) => d.statusCalc === 'vencido').length
  const criticos = comStatus.filter((d) => d.statusCalc === 'vence_30d').length

  let filtrados = comStatus
  if (q) {
    const termo = q.toLowerCase()
    filtrados = filtrados.filter(
      (d) => d.veiculos?.placa.toLowerCase().includes(termo) || d.veiculos?.modelo.toLowerCase().includes(termo)
    )
  }
  if (tipo) filtrados = filtrados.filter((d) => d.tipo === tipo)
  if (status) filtrados = filtrados.filter((d) => d.statusCalc === status)

  const paginaAtual = Math.max(1, Number(page) || 1)
  const inicio = (paginaAtual - 1) * PAGE_SIZE
  const pagina = filtrados.slice(inicio, inicio + PAGE_SIZE)
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE))

  function hrefPagina(n: number) {
    const usp = new URLSearchParams()
    if (q) usp.set('q', q)
    if (tipo) usp.set('tipo', tipo)
    if (status) usp.set('status', status)
    if (n > 1) usp.set('page', String(n))
    const query = usp.toString()
    return query ? `/sofia/documentos?${query}` : '/sofia/documentos'
  }

  const janelaInicio = Math.max(1, paginaAtual - 2)
  const janelaFim = Math.min(totalPaginas, paginaAtual + 2)
  const paginasVisiveis = Array.from({ length: janelaFim - janelaInicio + 1 }, (_, i) => janelaInicio + i)

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-white">Documentos</h1>
        <Link
          href="/sofia/documentos/novo"
          className="px-4 py-2 rounded-lg bg-[#f05a28] text-white text-sm font-medium hover:bg-[#d94e22] transition-colors"
        >
          + Anexar Documento
        </Link>
      </div>
      <p className="text-[#4a6080] text-sm mb-6">Controle de prazos e licenças da frota ativa.</p>

      <div className="rounded-xl border border-[#1e3a5f] bg-[#0d2050] p-5 mb-6 flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <label className="block text-xs text-[#4a6080] uppercase tracking-wider font-medium mb-1.5">Buscar Veículo</label>
          <form action="/sofia/documentos">
            {tipo && <input type="hidden" name="tipo" value={tipo} />}
            {status && <input type="hidden" name="status" value={status} />}
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Placa ou modelo..."
              className="w-full px-4 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white placeholder-[#4a6080] focus:outline-none focus:border-[#f05a28] text-sm"
            />
          </form>
        </div>
        <div>
          <label className="block text-xs text-[#4a6080] uppercase tracking-wider font-medium mb-1.5">Tipo</label>
          <FilterSelect paramName="tipo" options={tipoOptions} />
        </div>
        <div>
          <label className="block text-xs text-[#4a6080] uppercase tracking-wider font-medium mb-1.5">Status</label>
          <FilterSelect paramName="status" options={statusOptions} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6 max-w-md">
        <StatCard label="Vencidos" value={vencidos} accent />
        <StatCard label="Críticos" value={criticos} />
      </div>

      <div className="rounded-xl border border-[#1e3a5f] overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e3a5f] bg-[#0d2050]">
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Placa / Veículo</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Tipo</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Número/Apólice</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Vencimento</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {pagina.map((d) => (
              <tr key={d.id} className="border-b border-[#1e3a5f] hover:bg-[#0d2050] transition-colors">
                <td className="px-4 py-3">
                  <p className="text-white font-medium font-mono">{d.veiculos?.placa ?? '—'}</p>
                  <p className="text-[#4a6080] text-xs">{d.veiculos?.modelo ?? '—'}</p>
                </td>
                <td className="px-4 py-3 text-[#94a3b8]">{tipoLabel[d.tipo]}</td>
                <td className="px-4 py-3 text-[#94a3b8]">{d.numero ?? '—'}</td>
                <td className="px-4 py-3 text-[#94a3b8]">{new Date(d.vencimento).toLocaleDateString('pt-BR')}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusStyle[d.statusCalc]}`}>
                    {statusLabel[d.statusCalc]}
                  </span>
                </td>
              </tr>
            ))}
            {pagina.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-[#4a6080]">
                  Nenhum documento encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {filtrados.length > 0 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-[#4a6080]">
            Exibindo {pagina.length} de {filtrados.length} registros
          </p>
          <div className="flex gap-1">
            {paginasVisiveis.map((n) => (
              <Link
                key={n}
                href={hrefPagina(n)}
                className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-medium border transition-colors ${
                  n === paginaAtual ? 'border-[#f05a28] text-[#f05a28]' : 'border-[#1e3a5f] text-[#94a3b8] hover:border-[#94a3b8]'
                }`}
              >
                {n}
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
        <div className="rounded-xl border border-[#1e3a5f] bg-[#0d2050] p-5">
          <p className="text-white font-medium mb-1.5">Alertas Automáticos</p>
          <p className="text-[#94a3b8] text-sm">
            Documentos vencidos ou que vencem em até 30 dias são sinalizados automaticamente com os badges acima — não é
            necessária configuração adicional.
          </p>
        </div>
        <div className="rounded-xl border border-[#1e3a5f] bg-[#0d2050] p-5">
          <p className="text-white font-medium mb-1.5">Exportação de Relatórios</p>
          <p className="text-[#94a3b8] text-sm mb-3">
            Gere um PDF da lista filtrada de documentos para fiscalizações ou auditorias externas.
          </p>
          <PrintExportButton label="Gerar PDF" />
        </div>
      </div>
    </div>
  )
}
