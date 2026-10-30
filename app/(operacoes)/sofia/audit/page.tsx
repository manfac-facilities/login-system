import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { linhaHistoricoCorrecao, type CorrecaoAudit } from '@/lib/sofia/correcoes'

type LogEntry = {
  id: string
  tabela: string
  operacao: string
  registro_id: string | null
  descricao: string
  created_at: string
}

const BADGE: Record<string, string> = {
  criou: 'bg-green-900 text-green-300',
  atualizou: 'bg-blue-900 text-blue-300',
  excluiu: 'bg-red-900 text-red-300',
  desativou: 'bg-amber-900 text-amber-300',
  corrigiu: 'bg-purple-900 text-purple-300',
}

function Abas({ ativa }: { ativa: 'geral' | 'correcoes' }) {
  const cls = (on: boolean) =>
    `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
      on ? 'bg-[#f05a28] text-white' : 'border border-[#1e3a5f] text-[#94a3b8] hover:border-[#94a3b8]'
    }`
  return (
    <div className="flex gap-2 mb-6">
      <Link href="/sofia/audit" className={cls(ativa === 'geral')}>
        Registro de atividades
      </Link>
      <Link href="/sofia/audit?ver=correcoes" className={cls(ativa === 'correcoes')}>
        Histórico de correções
      </Link>
    </div>
  )
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ ver?: string }>
}) {
  const { ver } = await searchParams
  const supabase = await createClient()

  if (ver === 'correcoes') {
    const { data } = await supabase
      .from('audit_log')
      .select('id, tabela, registro_id, created_at, usuario_email, dados')
      .eq('operacao', 'corrigiu')
      .in('tabela', ['km_diario', 'abastecimentos'])
      .order('created_at', { ascending: false })
      .limit(200)
    const linhas = ((data ?? []) as (CorrecaoAudit & { id: string })[]).map((c) => ({
      id: c.id,
      ...linhaHistoricoCorrecao(c),
    }))

    return (
      <div className="p-8">
        <Abas ativa="correcoes" />
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Histórico de correções</h1>
          <p className="text-[#4a6080] text-sm mt-1">
            Toda correção de KM diário e de abastecimento fica aqui, com o valor de antes e o de depois.
          </p>
        </div>
        <div className="rounded-xl border border-[#1e3a5f] overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e3a5f] bg-[#0d2050]">
                {['Quando', 'Quem', 'O que foi corrigido', 'Antes', 'Depois', 'Motivo'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-[#4a6080] font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-[#4a6080]">
                    Nenhuma correção feita até agora.
                  </td>
                </tr>
              ) : (
                linhas.map((l) => (
                  <tr key={l.id} className="border-b border-[#1e3a5f] hover:bg-[#0d2050] transition-colors">
                    <td className="px-4 py-3 text-[#94a3b8] whitespace-nowrap">{l.quando}</td>
                    <td className="px-4 py-3 text-white" title={l.email}>{l.quem}</td>
                    <td className="px-4 py-3 text-[#94a3b8]">
                      {l.oque}
                      {l.kmVeiculo && <span className="block text-xs text-[#4a6080] mt-0.5">{l.kmVeiculo}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <s className="text-[#4a6080]">{l.antes}</s>
                    </td>
                    <td className="px-4 py-3 text-white">{l.depois}</td>
                    <td className="px-4 py-3 text-[#94a3b8]">{l.motivo}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  const { data } = await supabase
    .from('audit_log')
    .select('id, tabela, operacao, registro_id, descricao, created_at')
    .order('created_at', { ascending: false })
    .limit(200)

  const entries = (data ?? []) as LogEntry[]

  return (
    <div className="p-8">
      <Abas ativa="geral" />
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Registro de atividades</h1>
        <p className="text-[#4a6080] text-sm mt-1">Últimas 200 operações no sistema</p>
      </div>

      {entries.length === 0 ? (
        <p className="text-[#4a6080] text-sm">Nenhuma atividade registrada ainda.</p>
      ) : (
        <div className="rounded-xl border border-[#1e3a5f] overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e3a5f] bg-[#0d2050]">
                <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Data/Hora</th>
                <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Operação</th>
                <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Tabela</th>
                <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Descrição</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr
                  key={e.id}
                  className="border-b border-[#1e3a5f] hover:bg-[#0d2050] transition-colors"
                >
                  <td className="px-4 py-3 text-[#4a6080] whitespace-nowrap">
                    {new Date(e.created_at).toLocaleString('pt-BR')}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        BADGE[e.operacao] ?? 'bg-[#1e3a5f] text-[#94a3b8]'
                      }`}
                    >
                      {e.operacao}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#94a3b8] font-mono text-xs">{e.tabela}</td>
                  <td className="px-4 py-3 text-[#94a3b8]">{e.descricao}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
