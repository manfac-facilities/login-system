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

const filtroPills: { value: string | undefined; label: string }[] = [
  { value: undefined, label: 'Todos' },
  { value: 'ativo', label: 'Ativos' },
  { value: 'manutencao', label: 'Manutenção' },
  { value: 'inativo', label: 'Inativos' },
]

export default async function VeiculosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>
}) {
  const { q, status } = await searchParams
  const [veiculos, equipes] = await Promise.all([getVeiculos(), getEquipes()])

  let filtrados = veiculos
  if (q) {
    const termo = q.toLowerCase()
    filtrados = filtrados.filter(
      (v) =>
        v.placa.toLowerCase().includes(termo) ||
        v.modelo.toLowerCase().includes(termo)
    )
  }
  if (status) {
    filtrados = filtrados.filter((v) => v.status === status)
  }

  function hrefCom(params: Record<string, string | undefined>) {
    const merged = { q, status, ...params }
    const usp = new URLSearchParams()
    for (const [k, v] of Object.entries(merged)) if (v) usp.set(k, v)
    const query = usp.toString()
    return query ? `/sofia/veiculos?${query}` : '/sofia/veiculos'
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Veículos</h1>
          <p className="text-[#4a6080] text-sm mt-1">
            {filtrados.length}
            {filtrados.length !== veiculos.length ? ` de ${veiculos.length}` : ''} veículos
            {q || status ? ' encontrados' : ' cadastrados'}
          </p>
        </div>
        <Link
          href="/sofia/veiculos/novo"
          className="px-4 py-2 rounded-lg bg-[#f05a28] text-white text-sm font-medium hover:bg-[#d94e22] transition-colors"
        >
          + Novo Veículo
        </Link>
      </div>

      <form action="/sofia/veiculos" className="mb-4">
        {status && <input type="hidden" name="status" value={status} />}
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Buscar por placa ou modelo..."
          className="w-full px-4 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white placeholder-[#4a6080] focus:outline-none focus:border-[#f05a28] text-sm"
        />
      </form>

      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <span className="text-xs text-[#4a6080] uppercase tracking-wider font-medium">Filtrar por status:</span>
        {filtroPills.map((opt) => (
          <Link
            key={opt.label}
            href={hrefCom({ status: opt.value })}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              status === opt.value ? 'border-[#f05a28] text-[#f05a28]' : 'border-[#1e3a5f] text-[#94a3b8] hover:border-[#94a3b8]'
            }`}
          >
            {opt.label}
          </Link>
        ))}
      </div>

      <div className="rounded-xl border border-[#1e3a5f] overflow-x-auto">
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
            {filtrados.map((v) => {
              const equipe = equipes.find((e) => e.id === v.equipe_id)
              return (
                <tr
                  key={v.id}
                  className="border-b border-[#1e3a5f] hover:bg-[#0d2050] transition-colors"
                >
                  <td className="px-4 py-3 text-white font-medium font-mono">
                    <Link href={`/sofia/veiculos/${v.id}`} className="hover:text-[#f05a28] transition-colors">
                      {v.placa}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[#94a3b8]">
                    {v.modelo}
                    {v.ano != null ? ` · ${v.ano}` : ''}
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
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-[#4a6080]">
                  {veiculos.length === 0 ? (
                    <>
                      Nenhum veículo cadastrado.{' '}
                      <Link href="/sofia/veiculos/novo" className="text-[#f05a28] hover:underline">
                        Adicionar primeiro →
                      </Link>
                    </>
                  ) : (
                    <>
                      Nenhum veículo encontrado com esse filtro.{' '}
                      <Link href="/sofia/veiculos" className="text-[#f05a28] hover:underline">
                        Limpar filtros
                      </Link>
                    </>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
