import { getEquipes, getVeiculos, getMotoristas, getKmHoje } from '@/lib/sofia/queries'
import KmForm from './_form'

export default async function KmPage() {
  const [equipes, veiculos, motoristas, kmHoje] = await Promise.all([
    getEquipes(),
    getVeiculos(),
    getMotoristas(),
    getKmHoje(),
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
            Lançados hoje
          </h2>
          {kmHoje.length === 0 ? (
            <p className="text-[#4a6080] text-sm">Nenhum lançamento hoje ainda.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {(kmHoje as any[]).map((k) => (
                <div
                  key={k.id}
                  className="flex items-center justify-between px-4 py-3 rounded-lg border border-[#1e3a5f] bg-[#0d2050]"
                >
                  <div>
                    <p className="text-white text-sm font-medium">{k.equipes?.codigo}</p>
                    <p className="text-[#4a6080] text-xs">{k.veiculos?.placa}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-white text-sm">
                      {k.km_inicial.toLocaleString('pt-BR')} →{' '}
                      {k.km_final ? k.km_final.toLocaleString('pt-BR') : '—'}
                    </p>
                    {k.km_final && (
                      <p className="text-[#4a6080] text-xs">
                        {(k.km_final - k.km_inicial).toLocaleString('pt-BR')} km rodados
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
