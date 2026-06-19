import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { atualizarStatusMultaAction, registrarDescontoMultaAction } from './_actions'
import type { Multa } from '@/lib/sofia/types'

type MultaComRelacoes = Multa & {
  veiculos: { placa: string } | null
  motoristas: { nome: string } | null
}

const statusStyle: Record<string, string> = {
  pendente: 'bg-amber-900 text-amber-300',
  validada: 'bg-blue-900 text-blue-300',
  descontada: 'bg-green-900 text-green-300',
}

const proximoStatus: Record<string, string> = {
  pendente: 'validada',
  validada: 'descontada',
}

export default async function MultasPage() {
  const supabase = await createClient()
  const { data: multas } = await supabase
    .from('multas')
    .select('*, veiculos(placa), motoristas(nome)')
    .order('data', { ascending: false })

  const totalPendente = (multas ?? [])
    .filter((m: MultaComRelacoes) => m.status === 'pendente')
    .reduce((sum: number, m: MultaComRelacoes) => sum + Number(m.valor), 0)

  const totalValidada = (multas ?? [])
    .filter((m: MultaComRelacoes) => m.status === 'validada')
    .reduce((sum: number, m: MultaComRelacoes) => sum + Number(m.valor), 0)

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Multas</h1>
          <div className="flex gap-6 mt-2">
            <p className="text-[#4a6080] text-sm">
              R$ {totalPendente.toFixed(2)} pendente de validação
            </p>
            <p className="text-[#4a6080] text-sm">
              R$ {totalValidada.toFixed(2)} validada, não descontada
            </p>
          </div>
        </div>
        <Link
          href="/sofia/multas/nova"
          className="px-4 py-2 rounded-lg bg-[#f05a28] text-white text-sm font-medium hover:bg-[#d94e22] transition-colors"
        >
          + Registrar Multa
        </Link>
      </div>

      <div className="rounded-xl border border-[#1e3a5f] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e3a5f] bg-[#0d2050]">
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Data</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Veículo</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Motorista</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Descrição</th>
              <th className="text-right px-4 py-3 text-[#4a6080] font-medium">Valor</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Desconto</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {(multas ?? []).map((m: MultaComRelacoes) => (
              <tr
                key={m.id}
                className="border-b border-[#1e3a5f] hover:bg-[#0d2050] transition-colors"
              >
                <td className="px-4 py-3 text-[#94a3b8]">
                  {new Date(m.data).toLocaleDateString('pt-BR')}
                </td>
                <td className="px-4 py-3 text-[#94a3b8] font-mono">
                  {m.veiculos?.placa ?? '—'}
                </td>
                <td className="px-4 py-3 text-[#94a3b8]">{m.motoristas?.nome ?? '—'}</td>
                <td className="px-4 py-3 text-white">{m.descricao}</td>
                <td className="px-4 py-3 text-white text-right font-medium">
                  R$ {Number(m.valor).toFixed(2)}
                </td>
                <td className="px-4 py-3 text-[#94a3b8] text-sm">
                  {m.tipo_desconto === 'nenhum' ? '—' : `${m.tipo_desconto === 'total' ? 'Total' : 'Parcial'} · R$ ${Number(m.valor_descontado ?? 0).toFixed(2)}`}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${statusStyle[m.status]}`}
                  >
                    {m.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {proximoStatus[m.status] && (
                    <form
                      action={atualizarStatusMultaAction.bind(
                        null,
                        m.id,
                        proximoStatus[m.status]
                      )}
                    >
                      <button
                        type="submit"
                        className="text-xs text-[#4a6080] hover:text-[#94a3b8] transition-colors"
                      >
                        → {proximoStatus[m.status]}
                      </button>
                    </form>
                  )}
                  <details className="mt-1">
                    <summary className="text-xs text-[#f05a28] cursor-pointer hover:underline">desconto</summary>
                    <form action={registrarDescontoMultaAction} className="flex flex-col gap-2 mt-2 p-3 rounded-lg border border-[#1e3a5f] bg-[#0a1628] text-left w-56">
                      <input type="hidden" name="id" value={m.id} />
                      <input
                        name="valor_descontado"
                        type="number"
                        step="0.01"
                        placeholder="Valor descontado"
                        defaultValue={m.valor_descontado ?? ''}
                        className="px-2 py-1.5 rounded bg-[#0f1f3d] border border-[#1e3a5f] text-white text-xs"
                      />
                      <select name="tipo_desconto" defaultValue={m.tipo_desconto} className="px-2 py-1.5 rounded bg-[#0f1f3d] border border-[#1e3a5f] text-white text-xs">
                        <option value="nenhum">Nenhum</option>
                        <option value="parcial">Parcial</option>
                        <option value="total">Total</option>
                      </select>
                      <label className="flex items-center gap-2 text-xs text-[#94a3b8]">
                        <input type="checkbox" name="autorizacao_assinada" value="true" defaultChecked={m.autorizacao_assinada} className="accent-[#f05a28]" />
                        Autorização assinada
                      </label>
                      <button type="submit" className="py-1.5 rounded bg-[#f05a28] text-white text-xs font-medium hover:bg-[#d94e22] transition-colors">
                        Salvar
                      </button>
                    </form>
                  </details>
                </td>
              </tr>
            ))}
            {(multas ?? []).length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-[#4a6080]">
                  Nenhuma multa registrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
