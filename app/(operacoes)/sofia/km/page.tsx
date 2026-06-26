import { getEquipes, getVeiculos, getMotoristas, getKmDiarioHistorico, getKmResumoMensal } from '@/lib/sofia/queries'
import KmForm from './_form'
import { deletarKmAction } from './_actions'
import DeleteConfirmButton from '@/components/sofia/DeleteConfirmButton'

export default async function KmPage() {
  const [equipes, veiculos, motoristas, historico, resumoMensal] = await Promise.all([
    getEquipes(),
    getVeiculos(),
    getMotoristas(),
    getKmDiarioHistorico(),
    getKmResumoMensal(),
  ])

  const hoje = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">KM Diário</h1>
        <p className="text-[#4a6080] text-sm mt-1 capitalize">{hoje}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <KmForm equipes={equipes} veiculos={veiculos} motoristas={motoristas} />

        <div>
          <h2 className="text-sm font-medium text-[#4a6080] uppercase tracking-wider mb-3">
            Histórico de lançamentos
          </h2>
          {historico.length === 0 ? (
            <p className="text-[#4a6080] text-sm">Nenhum lançamento ainda.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {historico.map((k) => (
                <div
                  key={k.id}
                  className="flex items-start justify-between px-4 py-3 rounded-lg border border-[#1e3a5f] bg-[#0d2050] gap-3"
                >
                  <div>
                    <p className="text-white text-sm font-medium">{k.equipes?.codigo}</p>
                    <p className="text-[#4a6080] text-xs font-mono">{k.veiculos?.placa}</p>
                    <p className="text-[#4a6080] text-xs">
                      {new Date(k.data + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="text-right">
                      <p className="text-white text-sm font-mono">
                        {k.km_atual.toLocaleString('pt-BR')} km
                      </p>
                      {k.motoristas?.nome && (
                        <p className="text-[#4a6080] text-xs">{k.motoristas.nome}</p>
                      )}
                    </div>
                    <DeleteConfirmButton action={deletarKmAction} id={k.id} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {resumoMensal.length > 0 && (
          <div className="mt-10 col-span-full">
            <h2 className="text-sm font-medium text-[#4a6080] uppercase tracking-wider mb-3">
              Resumo por mês
            </h2>
            <div className="rounded-xl border border-[#1e3a5f] overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1e3a5f] bg-[#0d2050]">
                    <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Mês</th>
                    <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Equipe</th>
                    <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Placa</th>
                    <th className="text-right px-4 py-3 text-[#4a6080] font-medium">KM início</th>
                    <th className="text-right px-4 py-3 text-[#4a6080] font-medium">KM fim</th>
                    <th className="text-right px-4 py-3 text-[#4a6080] font-medium">Rodados</th>
                  </tr>
                </thead>
                <tbody>
                  {resumoMensal.map((r) => (
                    <tr
                      key={`${r.veiculo_placa}::${r.mes}`}
                      className="border-b border-[#1e3a5f] hover:bg-[#0d2050] transition-colors"
                    >
                      <td className="px-4 py-3 text-[#94a3b8]">
                        {new Date(r.mes + '-01').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3 text-[#94a3b8]">{r.equipe_codigo}</td>
                      <td className="px-4 py-3 text-white font-mono">{r.veiculo_placa}</td>
                      <td className="px-4 py-3 text-[#94a3b8] text-right font-mono">
                        {r.km_inicio.toLocaleString('pt-BR')}
                      </td>
                      <td className="px-4 py-3 text-[#94a3b8] text-right font-mono">
                        {r.km_fim.toLocaleString('pt-BR')}
                      </td>
                      <td className="px-4 py-3 text-white text-right font-mono font-medium">
                        {r.km_rodados.toLocaleString('pt-BR')} km
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[#4a6080] text-xs mt-2">
              KM rodados = última leitura do mês − primeira leitura do mês por veículo.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
