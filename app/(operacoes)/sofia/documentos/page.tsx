import { getDocumentosVeiculo } from '@/lib/sofia/queries'
import Link from 'next/link'

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
  licenciamento: 'Licenciamento (CRLV)',
  ipva: 'IPVA',
  outro: 'Outro',
}

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
  searchParams: Promise<{ status?: string }>
}) {
  const { status } = await searchParams
  const documentos = await getDocumentosVeiculo()
  const comStatus = documentos.map((d) => ({ ...d, statusCalc: computeStatus(d.vencimento) }))
  const filtrados = status ? comStatus.filter((d) => d.statusCalc === status) : comStatus

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Documentos</h1>
          <p className="text-[#4a6080] text-sm mt-1">Seguro, licenciamento e IPVA por veículo</p>
        </div>
        <Link
          href="/sofia/documentos/novo"
          className="px-4 py-2 rounded-lg bg-[#f05a28] text-white text-sm font-medium hover:bg-[#d94e22] transition-colors"
        >
          + Adicionar Documento
        </Link>
      </div>

      <div className="flex gap-2 mb-4">
        {[
          { value: undefined, label: 'Todos' },
          { value: 'valido', label: 'Válido' },
          { value: 'vence_30d', label: 'Vence em 30d' },
          { value: 'vencido', label: 'Vencido' },
        ].map((opt) => (
          <Link
            key={opt.label}
            href={opt.value ? `/sofia/documentos?status=${opt.value}` : '/sofia/documentos'}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              status === opt.value ? 'border-[#f05a28] text-[#f05a28]' : 'border-[#1e3a5f] text-[#94a3b8] hover:border-[#94a3b8]'
            }`}
          >
            {opt.label}
          </Link>
        ))}
      </div>

      <div className="rounded-xl border border-[#1e3a5f] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e3a5f] bg-[#0d2050]">
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Placa</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Tipo</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Número/Apólice</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Vencimento</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((d: any) => (
              <tr key={d.id} className="border-b border-[#1e3a5f] hover:bg-[#0d2050] transition-colors">
                <td className="px-4 py-3 text-white font-medium font-mono">{d.veiculos?.placa ?? '—'}</td>
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
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-[#4a6080]">
                  Nenhum documento encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
