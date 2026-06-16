import { getEquipes, getVeiculos } from '@/lib/sofia/queries'
import Link from 'next/link'
import { toggleEquipeAction } from './_actions'

export default async function EquipesPage() {
  const [equipes, veiculos] = await Promise.all([getEquipes(), getVeiculos()])

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Equipes</h1>
          <p className="text-[#4a6080] text-sm mt-1">
            {equipes.length} equipes cadastradas
          </p>
        </div>
        <Link
          href="/sofia/equipes/nova"
          className="px-4 py-2 rounded-lg bg-[#f05a28] text-white text-sm font-medium hover:bg-[#d94e22] transition-colors"
        >
          + Nova Equipe
        </Link>
      </div>

      <div className="rounded-xl border border-[#1e3a5f] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e3a5f] bg-[#0d2050]">
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Código</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Centro de Custo</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Veículo</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {equipes.map((equipe) => {
              const veiculo = veiculos.find((v) => v.equipe_id === equipe.id)
              return (
                <tr
                  key={equipe.id}
                  className="border-b border-[#1e3a5f] hover:bg-[#0d2050] transition-colors"
                >
                  <td className="px-4 py-3 text-white font-medium">{equipe.codigo}</td>
                  <td className="px-4 py-3 text-[#94a3b8]">{equipe.centro_custo ?? '—'}</td>
                  <td className="px-4 py-3 text-[#94a3b8]">
                    {veiculo ? `${veiculo.placa} · ${veiculo.modelo}` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        equipe.ativo
                          ? 'bg-green-900 text-green-300'
                          : 'bg-[#1e3a5f] text-[#4a6080]'
                      }`}
                    >
                      {equipe.ativo ? 'Ativa' : 'Inativa'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <form
                      action={toggleEquipeAction.bind(null, equipe.id, !equipe.ativo)}
                    >
                      <button
                        type="submit"
                        className="text-xs text-[#4a6080] hover:text-[#94a3b8] transition-colors"
                      >
                        {equipe.ativo ? 'Desativar' : 'Ativar'}
                      </button>
                    </form>
                  </td>
                </tr>
              )
            })}
            {equipes.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-[#4a6080]">
                  Nenhuma equipe cadastrada.{' '}
                  <Link
                    href="/sofia/equipes/nova"
                    className="text-[#f05a28] hover:underline"
                  >
                    Criar primeira equipe →
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
