import { getRevisoes, getRevisoesAtrasadas } from '@/lib/sofia/queries'
import type { Revisao } from '@/lib/sofia/types'
import Link from 'next/link'

type RevisaoComVeiculo = Revisao & {
  veiculos: { placa: string } | null
  motoristas: { nome: string } | null
}

const statusStyle: Record<string, string> = {
  em_dia: 'bg-green-900 text-green-300',
  agendada: 'bg-blue-900 text-blue-300',
  atrasada: 'bg-red-900 text-red-300',
}

const statusLabel: Record<string, string> = {
  em_dia: 'Em dia',
  agendada: 'Agendada',
  atrasada: 'Atrasada',
}

const tipoLabel: Record<string, string> = {
  preventiva: 'Preventiva',
  corretiva: 'Corretiva',
}

export default async function RevisoesPage() {
  const [revisoes, atrasadas] = await Promise.all([getRevisoes(), getRevisoesAtrasadas()])
  const idsAtrasadas = new Set(atrasadas.map((a) => a.id))

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Revisões</h1>
          <p className="text-[#4a6080] text-sm mt-1">
            {atrasadas.length} manutenção{atrasadas.length !== 1 ? 'ões' : ''} atrasada{atrasadas.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          href="/sofia/revisoes/nova"
          className="px-4 py-2 rounded-lg bg-[#f05a28] text-white text-sm font-medium hover:bg-[#d94e22] transition-colors"
        >
          + Registrar Revisão
        </Link>
      </div>

      <div className="rounded-xl border border-[#1e3a5f] overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e3a5f] bg-[#0d2050]">
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Veículo</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Motorista</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Tipo</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Fornecedor</th>
              <th className="text-right px-4 py-3 text-[#4a6080] font-medium">Valor</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Realizada em</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Próxima prevista</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {(revisoes as RevisaoComVeiculo[]).map((r) => {
              const status = idsAtrasadas.has(r.id) ? 'atrasada' : r.status
              return (
                <tr key={r.id} className="border-b border-[#1e3a5f] hover:bg-[#0d2050] transition-colors">
                  <td className="px-4 py-3 text-white font-medium font-mono">{r.veiculos?.placa ?? '—'}</td>
                  <td className="px-4 py-3 text-[#94a3b8]">{r.motoristas?.nome ?? '—'}</td>
                  <td className="px-4 py-3 text-[#94a3b8]">{tipoLabel[r.tipo]}</td>
                  <td className="px-4 py-3 text-[#94a3b8]">{r.fornecedor ?? '—'}</td>
                  <td className="px-4 py-3 text-white text-right font-medium">
                    {r.valor != null ? `R$ ${Number(r.valor).toFixed(2)}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-[#94a3b8]">
                    {r.data_realizada ? new Date(r.data_realizada).toLocaleDateString('pt-BR') : '—'}
                  </td>
                  <td className="px-4 py-3 text-[#94a3b8]">
                    {r.proxima_data
                      ? new Date(r.proxima_data).toLocaleDateString('pt-BR')
                      : r.proxima_km != null ? `${r.proxima_km.toLocaleString('pt-BR')} km` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusStyle[status]}`}>
                      {statusLabel[status]}
                    </span>
                  </td>
                </tr>
              )
            })}
            {revisoes.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-[#4a6080]">
                  Nenhuma revisão registrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
