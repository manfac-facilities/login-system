import { createClient } from '@/lib/supabase/server'
import {
  getSinistrosAbertos,
  getRevisoesAtrasadas,
  getDocumentosVencendo,
  getMotoristas,
  getPendenciasManuais,
} from '@/lib/sofia/queries'
import { mapAutomaticPendencias } from '@/lib/sofia/pendencias'
import { atualizarStatusPendenciaAction } from './_actions'
import PendenciaForm from './_form'

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
  documento: 'Documento',
  termo: 'Termo de uso',
}

export default async function PendenciasPage() {
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

  type Linha = { id: string | null; descricao: string; origem: string; responsavel: string | null; prazo: string | null; proxima_acao: string | null; status: string }

  const todas: Linha[] = [
    ...automaticas.map((a): Linha => ({ id: null, descricao: a.descricao, origem: a.origem, responsavel: null, prazo: a.prazo, proxima_acao: null, status: 'aberta' })),
    ...manuais.map((p): Linha => ({ id: p.id, descricao: p.descricao, origem: p.origem, responsavel: p.responsavel, prazo: p.prazo, proxima_acao: p.proxima_acao, status: p.status })),
  ].sort((a, b) => {
    if (!a.prazo) return 1
    if (!b.prazo) return -1
    return a.prazo.localeCompare(b.prazo)
  })

  const hoje = new Date().toISOString().split('T')[0]

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Pendências & Plano de Ação</h1>
          <p className="text-[#4a6080] text-sm mt-1">{todas.length} pendência{todas.length !== 1 ? 's' : ''} no total</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 rounded-xl border border-[#1e3a5f] overflow-hidden">
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
              {todas.map((p, i) => {
                const atrasada = !!p.prazo && p.prazo < hoje && p.status !== 'concluida'
                return (
                  <tr key={p.id ?? `auto-${i}`} className={`border-b border-[#1e3a5f] hover:bg-[#0d2050] transition-colors ${atrasada ? 'bg-red-950/40' : ''}`}>
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
                          <button type="submit" className="text-xs text-[#4a6080] hover:text-[#94a3b8] transition-colors">
                            → {statusLabel[proximoStatus[p.status]]}
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                )
              })}
              {todas.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-[#4a6080]">
                    Nenhuma pendência registrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div>
          <h2 className="text-sm font-medium text-[#4a6080] uppercase tracking-wider mb-3">Adicionar item manual</h2>
          <PendenciaForm />
        </div>
      </div>
    </div>
  )
}
