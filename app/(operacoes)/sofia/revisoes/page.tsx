import { createClient } from '@/lib/supabase/server'
import { getVeiculos } from '@/lib/sofia/queries'
import RevisoesForm from './_form'

export default async function RevisoesPage() {
  const supabase = await createClient()
  const [veiculos, { data: revisoes }] = await Promise.all([
    getVeiculos(),
    supabase
      .from('revisoes')
      .select('*, veiculos(placa, modelo, km_atual)')
      .order('km_ultima_revisao'),
  ])

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Revisões</h1>
        <p className="text-[#4a6080] text-sm mt-1">
          Manutenção preventiva — revisão a cada 10.000 km
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div>
          <h2 className="text-sm font-medium text-[#4a6080] uppercase tracking-wider mb-3">
            Status da Frota
          </h2>
          {(revisoes ?? []).length === 0 ? (
            <p className="text-[#4a6080] text-sm">
              Nenhum veículo com revisão cadastrada.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {(revisoes ?? []).map((r: any) => {
                const kmAtual = r.veiculos?.km_atual ?? 0
                const kmProximo = (r.km_ultima_revisao ?? 0) + 10000
                const kmFaltando = kmProximo - kmAtual
                const urgente = kmFaltando <= 1000
                const atencao = kmFaltando <= 2000
                return (
                  <div
                    key={r.id}
                    className={`px-4 py-3 rounded-lg border ${
                      urgente
                        ? 'border-red-600 bg-red-950'
                        : atencao
                        ? 'border-amber-600 bg-amber-950'
                        : 'border-[#1e3a5f] bg-[#0d2050]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white font-medium">
                          {r.veiculos?.placa} · {r.veiculos?.modelo}
                        </p>
                        <p className="text-[#4a6080] text-xs">
                          Última revisão:{' '}
                          {r.km_ultima_revisao?.toLocaleString('pt-BR')} km
                        </p>
                      </div>
                      <div className="text-right">
                        <p
                          className={`font-bold ${
                            urgente
                              ? 'text-red-300'
                              : atencao
                              ? 'text-amber-300'
                              : 'text-green-300'
                          }`}
                        >
                          {kmFaltando > 0
                            ? `${kmFaltando.toLocaleString('pt-BR')} km`
                            : 'VENCIDA'}
                        </p>
                        <p className="text-[#4a6080] text-xs">para próxima revisão</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div>
          <h2 className="text-sm font-medium text-[#4a6080] uppercase tracking-wider mb-3">
            Registrar Revisão
          </h2>
          <RevisoesForm veiculos={veiculos} />
        </div>
      </div>
    </div>
  )
}
