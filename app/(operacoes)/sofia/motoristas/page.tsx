import { getMotoristas, getEquipes } from '@/lib/sofia/queries'
import Link from 'next/link'

function cnhStatus(vencimento: string | null): { label: string; style: string } {
  if (!vencimento) return { label: 'Sem CNH', style: 'bg-[#1e3a5f] text-[#4a6080]' }
  const diff = new Date(vencimento).getTime() - Date.now()
  const dias = Math.ceil(diff / 86400000)
  if (dias < 0) return { label: 'VENCIDA', style: 'bg-red-900 text-red-300' }
  if (dias <= 30) return { label: `Vence em ${dias}d`, style: 'bg-red-900 text-red-300' }
  if (dias <= 60) return { label: `Vence em ${dias}d`, style: 'bg-amber-900 text-amber-300' }
  return {
    label: new Date(vencimento).toLocaleDateString('pt-BR'),
    style: 'bg-green-900 text-green-300',
  }
}

export default async function MotoristasPage() {
  const [motoristas, equipes] = await Promise.all([getMotoristas(), getEquipes()])

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Motoristas</h1>
          <p className="text-[#4a6080] text-sm mt-1">
            {motoristas.filter((m) => m.ativo).length} ativos
          </p>
        </div>
        <Link
          href="/sofia/motoristas/novo"
          className="px-4 py-2 rounded-lg bg-[#f05a28] text-white text-sm font-medium hover:bg-[#d94e22] transition-colors"
        >
          + Novo Motorista
        </Link>
      </div>

      <div className="rounded-xl border border-[#1e3a5f] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e3a5f] bg-[#0d2050]">
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Nome</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">CNH</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Vencimento</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Equipe</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Contato</th>
            </tr>
          </thead>
          <tbody>
            {motoristas.map((m) => {
              const equipe = equipes.find((e) => e.id === m.equipe_id)
              const cnh = cnhStatus(m.cnh_vencimento)
              return (
                <tr
                  key={m.id}
                  className="border-b border-[#1e3a5f] hover:bg-[#0d2050] transition-colors"
                >
                  <td className="px-4 py-3 text-white font-medium">
                    <Link href={`/sofia/motoristas/${m.id}`} className="hover:text-[#f05a28] transition-colors">
                      {m.nome}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[#94a3b8] font-mono">{m.cnh ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${cnh.style}`}>
                      {cnh.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#94a3b8]">{equipe?.codigo ?? '—'}</td>
                  <td className="px-4 py-3 text-[#94a3b8]">{m.contato ?? '—'}</td>
                </tr>
              )
            })}
            {motoristas.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-[#4a6080]">
                  Nenhum motorista cadastrado.{' '}
                  <Link href="/sofia/motoristas/novo" className="text-[#f05a28] hover:underline">
                    Cadastrar →
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
