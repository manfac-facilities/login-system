import { createClient } from '@/lib/supabase/server'

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
}

export default async function AuditPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('audit_log')
    .select('id, tabela, operacao, registro_id, descricao, created_at')
    .order('created_at', { ascending: false })
    .limit(200)

  const entries = (data ?? []) as LogEntry[]

  return (
    <div className="p-8">
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
