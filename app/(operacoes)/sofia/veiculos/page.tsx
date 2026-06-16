import { getVeiculos, getEquipes } from '@/lib/sofia/queries'
import Link from 'next/link'

const statusLabel: Record<string, string> = {
  ativo: 'Ativo',
  inativo: 'Inativo',
  manutencao: 'Manutenção',
}
const statusStyle: Record<string, string> = {
  ativo: 'bg-green-900 text-green-300',
  inativo: 'bg-[#1e3a5f] text-[#4a6080]',
  manutencao: 'bg-amber-900 text-amber-300',
}

export default async function VeiculosPage() {
  const [veiculos, equipes] = await Promise.all([getVeiculos(), getEquipes()])

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Veículos</h1>
          <p className="text-[#4a6080] text-sm mt-1">
            {veiculos.length} veículos cadastrados
          </p>
        </div>
        <Link
          href="/sofia/veiculos/novo"
          className="px-4 py-2 rounded-lg bg-[#f05a28] text-white text-sm font-medium hover:bg-[#d94e22] transition-colors"
        >
          + Novo Veículo
        </Link>
      </div>

      <div className="rounded-xl border border-[#1e3a5f] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e3a5f] bg-[#0d2050]">
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Placa</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Modelo</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">KM Atual</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Equipe</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {veiculos.map((v) => {
              const equipe = equipes.find((e) => e.id === v.equipe_id)
              return (
                <tr
                  key={v.id}
                  className="border-b border-[#1e3a5f] hover:bg-[#0d2050] transition-colors"
                >
                  <td className="px-4 py-3 text-white font-medium font-mono">{v.placa}</td>
                  <td className="px-4 py-3 text-[#94a3b8]">
                    {v.modelo}
                    {v.ano ? ` · ${v.ano}` : ''}
                  </td>
                  <td className="px-4 py-3 text-[#94a3b8]">
                    {v.km_atual.toLocaleString('pt-BR')} km
                  </td>
                  <td className="px-4 py-3 text-[#94a3b8]">{equipe?.codigo ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusStyle[v.status]}`}>
                      {statusLabel[v.status]}
                    </span>
                  </td>
                </tr>
              )
            })}
            {veiculos.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-[#4a6080]">
                  Nenhum veículo cadastrado.{' '}
                  <Link href="/sofia/veiculos/novo" className="text-[#f05a28] hover:underline">
                    Adicionar primeiro →
                  </Link>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
