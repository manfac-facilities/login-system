import { getEquipes, getVeiculos, getMotoristas, getChecklistsRecentes } from '@/lib/sofia/queries'
import { ultimoTipoPorVeiculo, statusEquipe, type StatusEquipe } from '@/lib/sofia/equipes'
import Link from 'next/link'
import { toggleEquipeAction, desativarEquipeAction } from './_actions'
import FilterSelect from '@/components/sofia/FilterSelect'
import DeleteConfirmButton from '@/components/sofia/DeleteConfirmButton'

const PAGE_SIZE = 6

const statusLabel: Record<StatusEquipe, string> = {
  em_rota: 'Em Rota',
  disponivel: 'Disponível',
  manutencao: 'Em Manutenção',
  inativa: 'Inativa',
}

const statusStyle: Record<StatusEquipe, string> = {
  em_rota: 'bg-blue-900 text-blue-300',
  disponivel: 'bg-green-900 text-green-300',
  manutencao: 'bg-amber-900 text-amber-300',
  inativa: 'bg-[#1e3a5f] text-[#4a6080]',
}

const statusOptions = (Object.keys(statusLabel) as StatusEquipe[]).map((value) => ({
  value,
  label: statusLabel[value],
}))

export default async function EquipesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; limit?: string }>
}) {
  const { q, status, limit } = await searchParams
  const [equipes, veiculos, motoristas, checklists] = await Promise.all([
    getEquipes(),
    getVeiculos(),
    getMotoristas(),
    getChecklistsRecentes(),
  ])

  const ultimoTipo = ultimoTipoPorVeiculo(checklists)

  const enriquecidas = equipes.map((equipe) => {
    const veiculo = veiculos.find((v) => v.equipe_id === equipe.id)
    const motorista = motoristas.find((m) => m.equipe_id === equipe.id)
    const st = statusEquipe({
      ativo: equipe.ativo,
      veiculoStatus: veiculo?.status,
      ultimoTipo: veiculo ? ultimoTipo.get(veiculo.id) : undefined,
    })
    return { equipe, veiculo, motorista, status: st }
  })

  let filtradas = enriquecidas
  if (q) {
    const termo = q.toLowerCase()
    filtradas = filtradas.filter(
      (e) =>
        e.equipe.codigo.toLowerCase().includes(termo) ||
        e.veiculo?.placa.toLowerCase().includes(termo) ||
        e.motorista?.nome.toLowerCase().includes(termo)
    )
  }
  if (status) {
    filtradas = filtradas.filter((e) => e.status === status)
  }

  const limiteAtual = Math.max(PAGE_SIZE, Number(limit) || PAGE_SIZE)
  const visiveis = filtradas.slice(0, limiteAtual)

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-white">Gestão de Equipes</h1>
        <Link
          href="/sofia/equipes/nova"
          className="px-4 py-2 rounded-lg bg-[#f05a28] text-white text-sm font-medium hover:bg-[#d94e22] transition-colors"
        >
          + Nova Equipe
        </Link>
      </div>
      <p className="text-[#4a6080] text-sm mb-6">
        Aqui estão suas {equipes.length} equipes. Cada uma com o veículo vinculado e o status.
      </p>

      <form action="/sofia/equipes" className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Buscar por código, placa ou motorista..."
          className="flex-1 min-w-[240px] px-4 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white placeholder-[#4a6080] focus:outline-none focus:border-[#f05a28] text-sm"
        />
      </form>
      <div className="mb-6">
        <FilterSelect paramName="status" options={statusOptions} allLabel="Todos os Status" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {visiveis.map(({ equipe, veiculo, motorista, status: st }) => (
          <div key={equipe.id} className="rounded-xl border border-[#1e3a5f] bg-[#0d2050] p-5 hover:border-[#f05a28] transition-colors">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-[#4a6080] uppercase tracking-wider font-medium">Equipe</p>
                <p className="text-xl font-bold text-white mt-0.5">{equipe.codigo}</p>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusStyle[st]}`}>{statusLabel[st]}</span>
            </div>
            <div className="border-t border-[#1e3a5f] mt-4 pt-4 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[#4a6080] text-xs">Veículo</span>
                <span className="text-[#94a3b8] text-sm">{veiculo?.placa ?? '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#4a6080] text-xs">Motorista</span>
                <span className={`text-sm ${motorista ? 'text-[#94a3b8]' : 'text-[#4a6080] italic'}`}>
                  {motorista?.nome ?? 'Não atribuído'}
                </span>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-end gap-3">
              {!equipe.ativo && (
                <form action={toggleEquipeAction.bind(null, equipe.id, true)}>
                  <button type="submit" className="text-xs text-[#4a6080] hover:text-[#94a3b8] active:scale-95 transition-[color,transform]">
                    Ativar
                  </button>
                </form>
              )}
              {equipe.ativo && (
                <DeleteConfirmButton action={desativarEquipeAction} id={equipe.id} label="Desativar" />
              )}
            </div>
          </div>
        ))}
      </div>

      {visiveis.length === 0 && (
        <p className="px-4 py-12 text-center text-[#4a6080] rounded-xl border border-[#1e3a5f]">
          Nenhuma equipe encontrada.{' '}
          <Link href="/sofia/equipes/nova" className="text-[#f05a28] hover:underline">
            Criar primeira equipe →
          </Link>
        </p>
      )}

      {visiveis.length < filtradas.length && (
        <div className="flex justify-center mt-6">
          <Link
            href={`/sofia/equipes?${new URLSearchParams({
              ...(q ? { q } : {}),
              ...(status ? { status } : {}),
              limit: String(limiteAtual + PAGE_SIZE),
            }).toString()}`}
            className="px-4 py-2 rounded-lg border border-[#1e3a5f] text-[#94a3b8] text-sm font-medium hover:border-[#94a3b8] transition-colors"
          >
            Carregar mais equipes
          </Link>
        </div>
      )}
    </div>
  )
}
