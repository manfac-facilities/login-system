import { getEnvios } from '@/lib/sofia/extratos/leituras'
import { brl, dataBR } from '@/lib/sofia/extratos/agrupar'

const nomePlataforma = (p: string) => (p === 'ticketlog' ? 'Ticketlog' : 'Veloe')
const quando = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })

// D2 (28/10/2026): envios e saldos digitados são visíveis a todo o Frotas, com o e-mail de quem enviou.
export default async function HistoricoEnviosPage() {
  const envios = await getEnvios()

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-2xl font-bold text-white mb-1">Histórico de envios e saldos digitados</h1>
      <p className="text-[#94a3b8] text-sm mb-6">
        Cada envio fica registrado com quem enviou, quando e o saldo que a pessoa digitou.
      </p>
      {envios.length === 0 ? (
        <p className="px-4 py-12 text-center text-[#94a3b8] rounded-xl border border-dashed border-[#1e3a5f]">
          Nenhum envio ainda.
        </p>
      ) : (
        <div className="rounded-xl border border-[#1e3a5f] bg-[#0d2050] overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-[#4a6080] border-b border-[#1e3a5f]">
                <th className="px-3 py-2">Quando</th>
                <th className="px-3 py-2">Quem</th>
                <th className="px-3 py-2">Plataforma</th>
                <th className="px-3 py-2">Arquivo</th>
                <th className="px-3 py-2">Período</th>
                <th className="px-3 py-2 text-right">Saldo digitado</th>
                <th className="px-3 py-2 text-right">Novas</th>
                <th className="px-3 py-2 text-right">Ignoradas</th>
              </tr>
            </thead>
            <tbody>
              {envios.map((e) => (
                <tr key={e.id} className="border-b border-[#12294d] text-[#cbd5e1]">
                  <td className="px-3 py-2 whitespace-nowrap tabular-nums">{quando(e.enviado_em)}</td>
                  <td className="px-3 py-2">{e.enviado_por}</td>
                  <td className="px-3 py-2">{nomePlataforma(e.plataforma)}</td>
                  <td className="px-3 py-2 text-xs">{e.arquivo_nome}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {dataBR(e.periodo_inicio)} a {dataBR(e.periodo_fim)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-white">{e.saldo === null ? '—' : brl(e.saldo)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{e.linhas_novas}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{e.linhas_existentes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
