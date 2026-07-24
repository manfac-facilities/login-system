import { getMotoristas, getEquipes } from '@/lib/sofia/queries'
import { classificarCnh, cnhStatus, type ClasseCnh } from '@/lib/sofia/motoristas'
import Link from 'next/link'
import StatCard from '@/components/sofia/StatCard'
import DeleteConfirmButton from '@/components/sofia/DeleteConfirmButton'
import { desativarMotoristaAction } from './_actions'

const PAGE_SIZE = 10

const filtroPills: { value: ClasseCnh | undefined; label: string }[] = [
  { value: undefined, label: 'Todos' },
  { value: 'vencidas', label: 'Vencidas' },
  { value: 'urgente', label: 'Vence em 30 dias' },
  { value: 'atencao', label: 'Atenção' },
  { value: 'regulares', label: 'Regulares' },
]

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/)
  return ((partes[0]?.[0] ?? '') + (partes[1]?.[0] ?? '')).toUpperCase()
}

export default async function MotoristasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cnh?: string; page?: string }>
}) {
  const { q, cnh, page } = await searchParams
  const [motoristas, equipes] = await Promise.all([getMotoristas(), getEquipes()])

  const ativos = motoristas.filter((m) => m.ativo)
  const vencidas = ativos.filter((m) => classificarCnh(m.cnh_vencimento) === 'vencidas')
  const urgente = ativos.filter((m) => classificarCnh(m.cnh_vencimento) === 'urgente')

  let filtrados = motoristas
  if (q) {
    const termo = q.toLowerCase()
    filtrados = filtrados.filter((m) => m.nome.toLowerCase().includes(termo) || m.cnh?.toLowerCase().includes(termo))
  }
  if (cnh) {
    filtrados = filtrados.filter((m) => classificarCnh(m.cnh_vencimento) === cnh)
  }

  // Sort: ativos first, inativos last (preserving alphabetical order within each group)
  filtrados = [...filtrados].sort((a, b) => {
    if (a.ativo === b.ativo) return 0
    return a.ativo ? -1 : 1
  })

  const paginaAtual = Math.max(1, Number(page) || 1)
  const inicio = (paginaAtual - 1) * PAGE_SIZE
  const pagina = filtrados.slice(inicio, inicio + PAGE_SIZE)
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE))

  function hrefCom(params: Record<string, string | undefined>) {
    const merged = { q, cnh, page: undefined, ...params }
    const usp = new URLSearchParams()
    for (const [k, v] of Object.entries(merged)) if (v) usp.set(k, v)
    const query = usp.toString()
    return query ? `/sofia/motoristas?${query}` : '/sofia/motoristas'
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-white">Motoristas</h1>
        <Link
          href="/sofia/motoristas/novo"
          className="px-4 py-2 rounded-lg bg-[#f05a28] text-white text-sm font-medium hover:bg-[#d94e22] transition-colors"
        >
          + Novo Motorista
        </Link>
      </div>
      <p className="text-[#4a6080] text-sm mb-6">Monitore as credenciais e status operacional da equipe.</p>

      <form action="/sofia/motoristas" className="mb-6">
        {cnh && <input type="hidden" name="cnh" value={cnh} />}
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Buscar motorista ou CNH..."
          className="w-full px-4 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white placeholder-[#4a6080] focus:outline-none focus:border-[#f05a28] text-sm"
        />
      </form>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Total Ativos" value={ativos.length} accent />
        <StatCard label="CNHs Vencidas" value={vencidas.length} sub="Ação imediata necessária" />
        <StatCard label="Vencem em 30 dias" value={urgente.length} sub="Agendar renovações" />
      </div>

      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs text-[#4a6080] uppercase tracking-wider font-medium">Filtrar por status:</span>
        {filtroPills.map((opt) => (
          <Link
            key={opt.label}
            href={hrefCom({ cnh: opt.value })}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              cnh === opt.value ? 'border-[#f05a28] text-[#f05a28]' : 'border-[#1e3a5f] text-[#94a3b8] hover:border-[#94a3b8]'
            }`}
          >
            {opt.label}
          </Link>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {pagina.map((m) => {
          const equipe = equipes.find((e) => e.id === m.equipe_id)
          const status = cnhStatus(m.cnh_vencimento)
          return (
            <div
              key={m.id}
              className="flex items-center justify-between px-4 py-3 rounded-xl border border-[#1e3a5f] bg-[#0d2050] hover:border-[#94a3b8] transition-colors"
            >
              <Link href={`/sofia/motoristas/${m.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-10 h-10 rounded-full bg-[#1e3a5f] text-white text-sm font-semibold flex items-center justify-center shrink-0">
                  {iniciais(m.nome)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-white text-sm font-medium">{m.nome}</p>
                    {!m.ativo && (
                      <span className="px-1.5 py-0.5 rounded text-xs bg-[#1e3a5f] text-[#4a6080]">Inativo</span>
                    )}
                  </div>
                  <p className="text-[#4a6080] text-xs font-mono">{m.cnh ?? '—'}</p>
                </div>
              </Link>
              <div className="flex items-center gap-6 shrink-0">
                <div className="text-right">
                  <p className="text-[#4a6080] text-xs uppercase tracking-wider">Status CNH</p>
                  <span className={`inline-block mt-0.5 px-2 py-0.5 rounded text-xs font-medium ${status.style}`}>{status.label}</span>
                </div>
                <div className="text-right hidden sm:block">
                  <p className="text-[#4a6080] text-xs uppercase tracking-wider">Equipe</p>
                  <p className="text-[#94a3b8] text-sm mt-0.5">{equipe?.codigo ?? '—'}</p>
                </div>
                {m.ativo && (
                  <DeleteConfirmButton action={desativarMotoristaAction} id={m.id} label="Desativar" itemLabel={`o motorista ${m.nome}`} />
                )}
              </div>
            </div>
          )
        })}
        {pagina.length === 0 && (
          <p className="px-4 py-12 text-center text-[#4a6080] rounded-xl border border-[#1e3a5f]">
            Nenhum motorista encontrado.{' '}
            <Link href="/sofia/motoristas/novo" className="text-[#f05a28] hover:underline">
              Cadastrar →
            </Link>
          </p>
        )}
      </div>

      {filtrados.length > 0 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-[#4a6080]">
            Mostrando {inicio + 1}-{Math.min(inicio + PAGE_SIZE, filtrados.length)} de {filtrados.length}
          </p>
          <div className="flex gap-2">
            <Link
              href={hrefCom({ page: String(Math.max(1, paginaAtual - 1)) })}
              aria-disabled={paginaAtual <= 1}
              className={`px-3 py-1.5 rounded-lg text-xs border border-[#1e3a5f] text-[#94a3b8] hover:border-[#94a3b8] transition-colors ${
                paginaAtual <= 1 ? 'pointer-events-none opacity-40' : ''
              }`}
            >
              ←
            </Link>
            <Link
              href={hrefCom({ page: String(Math.min(totalPaginas, paginaAtual + 1)) })}
              aria-disabled={paginaAtual >= totalPaginas}
              className={`px-3 py-1.5 rounded-lg text-xs border border-[#1e3a5f] text-[#94a3b8] hover:border-[#94a3b8] transition-colors ${
                paginaAtual >= totalPaginas ? 'pointer-events-none opacity-40' : ''
              }`}
            >
              →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
