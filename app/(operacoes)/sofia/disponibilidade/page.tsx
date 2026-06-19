import { getVeiculos, getResponsabilidadesAtuais, getRevisoes, getResponsabilidadeHistorico } from '@/lib/sofia/queries'
import { motivoParado, formatarTempoDesde, type MotivoParado } from '@/lib/sofia/disponibilidade'
import Link from 'next/link'

const motivoLabel: Record<MotivoParado, string> = {
  manutencao: 'Em Manutenção',
  sem_motorista: 'Sem Motorista',
  outro: 'Outro',
}

const motivoStyle: Record<MotivoParado, string> = {
  manutencao: 'bg-amber-900 text-amber-300',
  sem_motorista: 'bg-red-900 text-red-300',
  outro: 'bg-[#1e3a5f] text-[#4a6080]',
}

function statusFrota(pct: number): string {
  if (pct >= 85) return 'Bom'
  if (pct >= 70) return 'Atenção'
  return 'Crítico'
}

const RAIO = 80
const CIRCUNFERENCIA = 2 * Math.PI * RAIO

export default async function DisponibilidadePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>
}) {
  const { view } = await searchParams
  const [veiculos, responsabilidadesAtuais, revisoes] = await Promise.all([
    getVeiculos(),
    getResponsabilidadesAtuais(),
    getRevisoes(),
  ])

  const comResponsavel = new Set(responsabilidadesAtuais.map((r) => r.veiculo_id))

  const classificados = veiculos.map((v) => ({
    veiculo: v,
    motivo: motivoParado({ status: v.status, temResponsavelAtivo: comResponsavel.has(v.id) }),
  }))

  const parados = classificados.filter((c) => c.motivo !== null)
  const pct = veiculos.length ? Math.round(((veiculos.length - parados.length) / veiculos.length) * 100) : 0
  const pctParados = 100 - pct
  const offset = CIRCUNFERENCIA * (1 - pct / 100)

  const revisaoMaisRecentePorVeiculo = new Map<string, string>()
  for (const r of revisoes) {
    const atual = revisaoMaisRecentePorVeiculo.get(r.veiculo_id)
    if (!atual || r.created_at > atual) revisaoMaisRecentePorVeiculo.set(r.veiculo_id, r.created_at)
  }

  const semMotoristaIds = parados.filter((c) => c.motivo === 'sem_motorista').map((c) => c.veiculo.id)
  const historicos = await Promise.all(semMotoristaIds.map((id) => getResponsabilidadeHistorico(id)))
  const fimMaisRecentePorVeiculo = new Map<string, string>()
  semMotoristaIds.forEach((id, i) => {
    const encerradoMaisRecente = historicos[i].find((h) => h.fim != null)
    if (encerradoMaisRecente?.fim) fimMaisRecentePorVeiculo.set(id, encerradoMaisRecente.fim)
  })

  function desdeLabel(veiculoId: string, motivo: MotivoParado): string | null {
    if (motivo === 'manutencao') {
      const desde = revisaoMaisRecentePorVeiculo.get(veiculoId)
      return desde ? `Desde ${formatarTempoDesde(desde)}` : null
    }
    if (motivo === 'sem_motorista') {
      const desde = fimMaisRecentePorVeiculo.get(veiculoId)
      return desde ? `Desde ${formatarTempoDesde(desde)}` : null
    }
    return null
  }

  const lista = view === 'todos' ? classificados : parados

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Disponibilidade da Frota</h1>
        <p className="text-[#4a6080] text-sm mt-1">{veiculos.length - parados.length} de {veiculos.length} veículos disponíveis</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="rounded-xl border border-[#1e3a5f] bg-[#0d2050] p-8 flex flex-col items-center">
          <div className="relative w-[200px] h-[200px]">
            <svg width="200" height="200" viewBox="0 0 200 200" className="-rotate-90">
              <circle cx="100" cy="100" r={RAIO} fill="none" stroke="#1e3a5f" strokeWidth="20" />
              <circle
                cx="100"
                cy="100"
                r={RAIO}
                fill="none"
                stroke="#f05a28"
                strokeWidth="20"
                strokeDasharray={CIRCUNFERENCIA}
                strokeDashoffset={offset}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-xs text-[#4a6080]">Status da Frota</p>
              <p className="text-lg font-bold text-white">{statusFrota(pct)}</p>
            </div>
          </div>
          <div className="flex gap-8 mt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-[#f05a28]">{pct}%</p>
              <p className="text-xs text-[#4a6080] mt-1">Disponível</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{pctParados}%</p>
              <p className="text-xs text-[#4a6080] mt-1">Parados</p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="flex gap-2">
            <Link
              href="/sofia/disponibilidade?view=parados"
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                view !== 'todos' ? 'border-[#f05a28] text-[#f05a28]' : 'border-[#1e3a5f] text-[#94a3b8] hover:border-[#94a3b8]'
              }`}
            >
              Parados ({parados.length})
            </Link>
            <Link
              href="/sofia/disponibilidade?view=todos"
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                view === 'todos' ? 'border-[#f05a28] text-[#f05a28]' : 'border-[#1e3a5f] text-[#94a3b8] hover:border-[#94a3b8]'
              }`}
            >
              Todos os Veículos ({veiculos.length})
            </Link>
          </div>

          {lista.length === 0 ? (
            <p className="text-[#4a6080] text-sm">Nenhum veículo parado.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {lista.map(({ veiculo, motivo }) => {
                const desde = motivo ? desdeLabel(veiculo.id, motivo) : null
                return (
                  <div key={veiculo.id} className="flex items-center justify-between px-4 py-3 rounded-lg border border-[#1e3a5f] bg-[#0d2050]">
                    <div className="flex items-center gap-3">
                      <span className="text-white text-sm font-mono">{veiculo.placa}</span>
                      <span className="text-[#4a6080] text-xs">{veiculo.modelo}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {desde && <span className="text-xs text-[#4a6080]">{desde}</span>}
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          motivo ? motivoStyle[motivo] : 'bg-green-900 text-green-300'
                        }`}
                      >
                        {motivo ? motivoLabel[motivo] : 'Disponível'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
