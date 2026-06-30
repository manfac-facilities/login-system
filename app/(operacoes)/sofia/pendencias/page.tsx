import { createClient } from '@/lib/supabase/server'
import {
  getSinistrosAbertos,
  getRevisoesAtrasadas,
  getDocumentosVencendo,
  getMotoristas,
  getPendenciasManuais,
} from '@/lib/sofia/queries'
import { mapAutomaticPendencias, calcularKpisPendencias, agruparGargalos } from '@/lib/sofia/pendencias'
import { atualizarStatusPendenciaAction } from './_actions'
import PendenciaForm from './_form'
import StatCard from '@/components/sofia/StatCard'
import PrintExportButton from '@/components/sofia/PrintExportButton'
import Link from 'next/link'

const PAGE_SIZE = 10

const statusStyle: Record<string, string> = {
  aberta: 'bg-red-900 text-red-300',
  em_andamento: 'bg-amber-900 text-amber-300',
  concluida: 'bg-green-900 text-green-300',
}

const statusLabel: Record<string, string> = {
  aberta: 'Aberta',
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
}

const proximoStatus: Record<string, string> = {
  aberta: 'em_andamento',
  em_andamento: 'concluida',
}

const origemLabel: Record<string, string> = {
  manual: 'Manual',
  multa: 'Multa',
  sinistro: 'Sinistro',
  manutencao: 'Manutenção',
  documento: 'Documentação',
  termo: 'Termo de uso',
}

export default async function PendenciasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  const { q, page } = await searchParams
  const supabase = await createClient()

  const [sinistros, revisoesAtrasadas, documentosVencendo, motoristas, manuais, { data: multasNaoDescontadas }, { data: termosAssinados }] =
    await Promise.all([
      getSinistrosAbertos(),
      getRevisoesAtrasadas(),
      getDocumentosVencendo(),
      getMotoristas(),
      getPendenciasManuais(),
      supabase.from('multas').select('*').neq('status', 'descontada'),
      supabase.from('motorista_documentos').select('motorista_id').eq('tipo', 'termo_uso').eq('assinado', true),
    ])

  const idsComTermo = new Set((termosAssinados ?? []).map((t) => t.motorista_id))
  const termosNaoAssinados = motoristas.filter((m) => m.ativo && !idsComTermo.has(m.id))

  const automaticas = mapAutomaticPendencias({
    multas: (multasNaoDescontadas ?? []).map((m) => ({ id: m.id, status: m.status, autorizacao_assinada: m.autorizacao_assinada, data: m.data, descricao: m.descricao })),
    sinistros: sinistros.map((s) => ({ id: s.id, status: s.status, data: s.data, descricao: s.descricao })),
    revisoesAtrasadas: revisoesAtrasadas.map((r) => ({ id: r.id, proxima_data: r.proxima_data })),
    documentosVencendo: documentosVencendo.map((d) => ({ id: d.id, tipo: d.tipo, vencimento: d.vencimento })),
    termosNaoAssinados: termosNaoAssinados.map((m) => ({ id: m.id, nome: m.nome })),
  })

  type Linha = {
    id: string | null
    descricao: string
    origem: string
    responsavel: string | null
    prazo: string | null
    proxima_acao: string | null
    status: string
    updated_at: string
  }

  const todas: Linha[] = [
    ...automaticas.map((a): Linha => ({ id: null, descricao: a.descricao, origem: a.origem, responsavel: null, prazo: a.prazo, proxima_acao: null, status: 'aberta', updated_at: '' })),
    ...manuais.map((p): Linha => ({ id: p.id, descricao: p.descricao, origem: p.origem, responsavel: p.responsavel, prazo: p.prazo, proxima_acao: p.proxima_acao, status: p.status, updated_at: p.updated_at })),
  ].sort((a, b) => {
    if (!a.prazo) return 1
    if (!b.prazo) return -1
    return a.prazo.localeCompare(b.prazo)
  })

  const hoje = new Date().toISOString().split('T')[0]
  const kpis = calcularKpisPendencias(todas, hoje)
  const gargalos = agruparGargalos(todas.map((t) => ({ origem: t.origem })))

  const filtradas = q ? todas.filter((p) => p.descricao.toLowerCase().includes(q.toLowerCase())) : todas

  const paginaAtual = Math.max(1, Number(page) || 1)
  const inicio = (paginaAtual - 1) * PAGE_SIZE
  const pagina = filtradas.slice(inicio, inicio + PAGE_SIZE)
  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / PAGE_SIZE))

  function hrefPagina(n: number) {
    const usp = new URLSearchParams()
    if (q) usp.set('q', q)
    if (n > 1) usp.set('page', String(n))
    const query = usp.toString()
    return query ? `/sofia/pendencias?${query}` : '/sofia/pendencias'
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Pendências & Plano de Ação</h1>
        <p className="text-[#4a6080] text-sm mt-1">{todas.length} pendência{todas.length !== 1 ? 's' : ''} no total</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Pendente" value={kpis.totalPendente} accent />
        <StatCard label="Urgência Alta" value={kpis.urgenciaAlta} sub="Prazos vencidos" />
        <StatCard label="Aguardando Terceiros" value={kpis.aguardandoTerceiros} sub="Itens em andamento" />
        <StatCard label="Resolvidos (Hoje)" value={kpis.resolvidosHoje} sub={`Eficiência ${kpis.eficiencia}%`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 flex flex-col gap-4">
          <form action="/sofia/pendencias">
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Buscar ações..."
              className="w-full px-4 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white placeholder-[#4a6080] focus:outline-none focus:border-[#f05a28] text-sm"
            />
          </form>

          <div className="rounded-xl border border-[#1e3a5f] overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1e3a5f] bg-[#0d2050]">
                  <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Descrição</th>
                  <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Origem</th>
                  <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Responsável</th>
                  <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Prazo</th>
                  <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Próxima ação</th>
                  <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {pagina.map((p, i) => {
                  const atrasada = !!p.prazo && p.prazo < hoje && p.status !== 'concluida'
                  return (
                    <tr
                      key={p.id ?? `auto-${i}`}
                      className={`border-b border-[#1e3a5f] hover:bg-[#0d2050] transition-colors ${
                        atrasada ? 'bg-red-950/40 border-l-2 border-l-red-500' : ''
                      }`}
                    >
                      <td className="px-4 py-3 text-white">{p.descricao}</td>
                      <td className="px-4 py-3 text-[#94a3b8]">{origemLabel[p.origem]}</td>
                      <td className="px-4 py-3 text-[#94a3b8]">{p.responsavel ?? '—'}</td>
                      <td className={`px-4 py-3 ${atrasada ? 'text-red-300' : 'text-[#94a3b8]'}`}>
                        {p.prazo ? new Date(p.prazo).toLocaleDateString('pt-BR') : '—'}
                      </td>
                      <td className="px-4 py-3 text-[#94a3b8]">{p.proxima_acao ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusStyle[p.status]}`}>
                          {statusLabel[p.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {p.id && proximoStatus[p.status] && (
                          <form action={atualizarStatusPendenciaAction.bind(null, p.id, proximoStatus[p.status])}>
                            <button type="submit" className="text-xs text-[#4a6080] hover:text-[#94a3b8] transition-colors active:scale-95 transition-transform">
                              → {statusLabel[proximoStatus[p.status]]}
                            </button>
                          </form>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {pagina.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-[#4a6080]">
                      Nenhuma pendência encontrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {filtradas.length > 0 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-[#4a6080]">
                Exibindo {pagina.length} de {filtradas.length} pendências
              </p>
              <div className="flex gap-2">
                <Link
                  href={hrefPagina(Math.max(1, paginaAtual - 1))}
                  aria-disabled={paginaAtual <= 1}
                  className={`px-3 py-1.5 rounded-lg text-xs border border-[#1e3a5f] text-[#94a3b8] hover:border-[#94a3b8] transition-colors ${
                    paginaAtual <= 1 ? 'pointer-events-none opacity-40' : ''
                  }`}
                >
                  Anterior
                </Link>
                <Link
                  href={hrefPagina(Math.min(totalPaginas, paginaAtual + 1))}
                  aria-disabled={paginaAtual >= totalPaginas}
                  className={`px-3 py-1.5 rounded-lg text-xs border border-[#1e3a5f] text-[#94a3b8] hover:border-[#94a3b8] transition-colors ${
                    paginaAtual >= totalPaginas ? 'pointer-events-none opacity-40' : ''
                  }`}
                >
                  Próxima
                </Link>
              </div>
            </div>
          )}

          {gargalos.length > 0 && (
            <div className="rounded-xl border border-[#1e3a5f] bg-[#0d2050] p-5">
              <p className="text-white font-medium mb-4">Gargalos por Categoria</p>
              <div className="flex flex-col gap-3">
                {gargalos.map((g) => (
                  <div key={g.origem}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-[#94a3b8] uppercase tracking-wider">{origemLabel[g.origem] ?? g.origem}</span>
                      <span className="text-xs text-[#4a6080]">{g.pct}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-[#1e3a5f] overflow-hidden">
                      <div className="h-full rounded-full bg-[#f05a28]" style={{ width: `${g.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <div>
            <h2 className="text-sm font-medium text-[#4a6080] uppercase tracking-wider mb-3">Adicionar item manual</h2>
            <PendenciaForm />
          </div>

          <div className="rounded-xl border border-[#1e3a5f] bg-[#0d2050] p-5">
            <p className="text-white font-medium mb-1.5">Relatório Consolidado</p>
            <p className="text-[#94a3b8] text-sm mb-3">
              Gere um PDF com todos os planos de ação vigentes e prazos, para auditoria.
            </p>
            <PrintExportButton label="Exportar para Auditoria" />
          </div>
        </div>
      </div>
    </div>
  )
}
