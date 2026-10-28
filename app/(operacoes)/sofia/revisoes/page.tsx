import { getRevisoes, getRevisoesAtrasadas } from '@/lib/sofia/queries'
import type { Revisao } from '@/lib/sofia/types'
import Link from 'next/link'
import { situacaoRevisaoView, formatarKm, type RevisaoTom } from '@/lib/sofia/revisaoStatus'
import { excluirRevisaoAction } from './_actions'
import DeleteConfirmButton from '@/components/sofia/DeleteConfirmButton'

type RevisaoComVeiculo = Revisao & {
  veiculos: { placa: string; km_atual: number | null } | null
  motoristas: { nome: string } | null
}

const statusStyle: Record<string, string> = {
  em_dia: 'bg-green-900 text-green-300',
  agendada: 'bg-blue-900 text-blue-300',
  atrasada: 'bg-red-900 text-red-300',
}

const statusLabel: Record<string, string> = {
  em_dia: 'Em dia',
  agendada: 'Agendada',
  atrasada: 'Atrasada',
}

const tomStyle: Record<RevisaoTom, string> = {
  verde: 'bg-green-900 text-green-300',
  ambar: 'bg-amber-900 text-amber-300',
  vermelho: 'bg-red-900 text-red-300',
  neutro: 'text-[#4a6080]',
}

const tipoLabel: Record<string, string> = {
  preventiva: 'Preventiva',
  corretiva: 'Corretiva',
}

export default async function RevisoesPage() {
  const [revisoes, atrasadas] = await Promise.all([getRevisoes(), getRevisoesAtrasadas()])
  const hoje = new Date().toISOString().split('T')[0]
  const lista = revisoes as RevisaoComVeiculo[]
  // Só a revisão mais recente de cada veículo+tipo é classificada; as anteriores foram substituídas.
  const maisRecentes = new Map<string, string>()
  for (const r of [...lista].sort((a, b) => b.created_at.localeCompare(a.created_at))) {
    const chave = `${r.veiculo_id}::${r.tipo}`
    if (!maisRecentes.has(chave)) maisRecentes.set(chave, r.id)
  }
  const idsMaisRecentes = new Set(maisRecentes.values())
  const venceEmBreve = lista.filter(
    (r) => idsMaisRecentes.has(r.id) && situacaoRevisaoView(r, r.veiculos?.km_atual, hoje).label === 'Vence em breve'
  ).length

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Revisões</h1>
          <p className="text-[#4a6080] text-sm mt-1">
            {atrasadas.length} manutenç{atrasadas.length !== 1 ? 'ões' : 'ão'} atrasada{atrasadas.length !== 1 ? 's' : ''}
            {venceEmBreve > 0 && ` · ${venceEmBreve} vence${venceEmBreve !== 1 ? 'm' : ''} em breve`}
          </p>
        </div>
        <Link
          href="/sofia/revisoes/nova"
          className="px-4 py-2 rounded-lg bg-[#f05a28] text-white text-sm font-medium hover:bg-[#d94e22] transition-colors"
        >
          + Registrar Revisão
        </Link>
      </div>

      <div className="rounded-xl border border-[#1e3a5f] overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e3a5f] bg-[#0d2050]">
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Veículo</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Motorista</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Tipo</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Fornecedor</th>
              <th className="text-right px-4 py-3 text-[#4a6080] font-medium">Valor</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Realizada em</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Próxima prevista</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {lista.map((r) => {
              const sit = idsMaisRecentes.has(r.id) ? situacaoRevisaoView(r, r.veiculos?.km_atual, hoje) : null
              return (
                <tr key={r.id} className="relative cursor-pointer border-b border-[#1e3a5f] hover:bg-[#0d2050] transition-colors">
                  <td className="px-4 py-3 text-white font-medium font-mono">
                    <Link href={`/sofia/revisoes/${r.id}`} className="after:absolute after:inset-0 after:content-['']">
                      {r.veiculos?.placa ?? '—'}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[#94a3b8]">{r.motoristas?.nome ?? '—'}</td>
                  <td className="px-4 py-3 text-[#94a3b8]">{tipoLabel[r.tipo]}</td>
                  <td className="px-4 py-3 text-[#94a3b8]">{r.fornecedor ?? '—'}</td>
                  <td className="px-4 py-3 text-white text-right font-medium">
                    {r.valor != null ? `R$ ${Number(r.valor).toFixed(2)}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-[#94a3b8]">
                    {r.data_realizada ? new Date(r.data_realizada).toLocaleDateString('pt-BR') : '—'}
                  </td>
                  <td className="px-4 py-3 text-[#94a3b8]">
                    {r.proxima_data
                      ? new Date(r.proxima_data).toLocaleDateString('pt-BR')
                      : r.proxima_km != null ? `${formatarKm(r.proxima_km)} km` : '—'}
                    {sit?.dicas.map((d) => (
                      <span key={d.texto} className={`block text-xs ${d.tom === 'vermelho' ? 'text-red-300' : d.tom === 'ambar' ? 'text-amber-300' : 'text-[#4a6080]'}`}>
                        {d.texto}
                      </span>
                    ))}
                  </td>
                  <td className="px-4 py-3">
                    {sit ? (
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${tomStyle[sit.tom]}`}>{sit.label}</span>
                    ) : (
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusStyle[r.status]}`}>{statusLabel[r.status]}</span>
                    )}
                  </td>
                  <td className="relative z-10 px-4 py-3 text-right">
                    <DeleteConfirmButton action={excluirRevisaoAction} id={r.id} itemLabel={`revisão de ${r.veiculos?.placa ?? 'veículo sem placa'}`} />
                  </td>
                </tr>
              )
            })}
            {revisoes.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-[#4a6080]">
                  Nenhuma revisão registrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {revisoes.length > 0 && (
        <p className="text-[#4a6080] text-xs mt-2">
          Clique em uma linha para ver o detalhe. &quot;Vence em breve&quot; = faltam 1.000 km ou menos, comparando com o KM atual do veículo (KM diário).
        </p>
      )}
    </div>
  )
}
