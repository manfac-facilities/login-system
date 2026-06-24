import { createClient } from '@/lib/supabase/server'
import type { Multa, Sinistro } from '@/lib/sofia/types'
import {
  atualizarStatusMultaAction,
  registrarDescontoMultaAction,
  desfazerDescontoMultaAction,
  atualizarStatusDescontoSinistroAction,
  registrarDescontoSinistroAction,
  desfazerDescontoSinistroAction,
} from './_actions'

type LinhaDesconto = {
  origem: 'multa' | 'sinistro'
  id: string
  data: string
  veiculoPlaca: string | null
  motoristaNome: string | null
  valor: number
  status: string
  valor_descontado: number | null
  tipo_desconto: string
  autorizacao_assinada: boolean
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

export default async function DescontosPage() {
  const supabase = await createClient()

  const [{ data: multas }, { data: sinistros }] = await Promise.all([
    supabase.from('multas').select('*, veiculos(placa), motoristas(nome)').order('data', { ascending: false }),
    supabase.from('sinistros').select('*, veiculos(placa), motoristas(nome)').order('data', { ascending: false }),
  ])

  const linhasMultas: LinhaDesconto[] = (multas ?? []).map(
    (m: Multa & { veiculos: { placa: string } | null; motoristas: { nome: string } | null }) => ({
      origem: 'multa',
      id: m.id,
      data: m.data,
      veiculoPlaca: m.veiculos?.placa ?? null,
      motoristaNome: m.motoristas?.nome ?? null,
      valor: m.valor,
      status: m.status,
      valor_descontado: m.valor_descontado,
      tipo_desconto: m.tipo_desconto,
      autorizacao_assinada: m.autorizacao_assinada,
    })
  )

  const linhasSinistros: LinhaDesconto[] = (sinistros ?? []).map(
    (s: Sinistro & { veiculos: { placa: string } | null; motoristas: { nome: string } | null }) => ({
      origem: 'sinistro',
      id: s.id,
      data: s.data,
      veiculoPlaca: s.veiculos?.placa ?? null,
      motoristaNome: s.motoristas?.nome ?? null,
      valor: s.valor_dano ?? 0,
      status: s.status_desconto,
      valor_descontado: s.valor_descontado,
      tipo_desconto: s.tipo_desconto,
      autorizacao_assinada: s.autorizacao_assinada,
    })
  )

  const linhas = [...linhasMultas, ...linhasSinistros].sort(
    (a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()
  )

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-white mb-8">Descontos</h1>

      <div className="rounded-xl border border-[#1e3a5f] overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e3a5f] bg-[#0d2050]">
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Origem</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Data</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Veículo</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Motorista</th>
              <th className="text-right px-4 py-3 text-[#4a6080] font-medium">Valor</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => {
              const avancarAction =
                l.origem === 'multa' ? atualizarStatusMultaAction : atualizarStatusDescontoSinistroAction
              const registrarAction =
                l.origem === 'multa' ? registrarDescontoMultaAction : registrarDescontoSinistroAction
              const desfazerAction =
                l.origem === 'multa' ? desfazerDescontoMultaAction : desfazerDescontoSinistroAction

              return (
                <tr key={`${l.origem}-${l.id}`} className="border-b border-[#1e3a5f] hover:bg-[#0d2050] transition-colors">
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-[#1e3a5f] text-[#94a3b8]">
                      {l.origem === 'multa' ? 'Multa' : 'Sinistro'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#94a3b8]">{new Date(l.data).toLocaleDateString('pt-BR')}</td>
                  <td className="px-4 py-3 text-[#94a3b8] font-mono">{l.veiculoPlaca ?? '—'}</td>
                  <td className="px-4 py-3 text-[#94a3b8]">{l.motoristaNome ?? '—'}</td>
                  <td className="px-4 py-3 text-white text-right font-medium">R$ {Number(l.valor).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusStyle[l.status]}`}>
                      {l.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {proximoStatus[l.status] && (
                      <form action={avancarAction.bind(null, l.id, proximoStatus[l.status])}>
                        <button type="submit" className="text-xs text-[#4a6080] hover:text-[#94a3b8] transition-colors">
                          → {proximoStatus[l.status]}
                        </button>
                      </form>
                    )}
                    {l.status === 'descontada' && (
                      <form action={desfazerAction.bind(null, l.id)} className="mt-1">
                        <button type="submit" className="text-xs text-[#4a6080] hover:text-[#94a3b8] transition-colors">
                          desfazer desconto
                        </button>
                      </form>
                    )}
                    {l.status === 'validada' && (
                      <details className="mt-1">
                        <summary className="text-xs text-[#f05a28] cursor-pointer hover:underline">desconto</summary>
                        <form
                          action={registrarAction}
                          className="flex flex-col gap-2 mt-2 p-3 rounded-lg border border-[#1e3a5f] bg-[#0a1628] text-left w-56"
                        >
                          <input type="hidden" name="id" value={l.id} />
                          <input
                            name="valor_descontado"
                            type="number"
                            step="0.01"
                            placeholder="Valor descontado"
                            defaultValue={l.valor_descontado ?? ''}
                            className="px-2 py-1.5 rounded bg-[#0f1f3d] border border-[#1e3a5f] text-white text-xs"
                          />
                          <select
                            name="tipo_desconto"
                            defaultValue={l.tipo_desconto}
                            className="px-2 py-1.5 rounded bg-[#0f1f3d] border border-[#1e3a5f] text-white text-xs"
                          >
                            <option value="nenhum">Nenhum</option>
                            <option value="parcial">Parcial</option>
                            <option value="total">Total</option>
                          </select>
                          <label className="flex items-center gap-2 text-xs text-[#94a3b8]">
                            <input
                              type="checkbox"
                              name="autorizacao_assinada"
                              value="true"
                              defaultChecked={l.autorizacao_assinada}
                              className="accent-[#f05a28]"
                            />
                            Autorização assinada
                          </label>
                          <button
                            type="submit"
                            className="py-1.5 rounded bg-[#f05a28] text-white text-xs font-medium hover:bg-[#d94e22] transition-colors"
                          >
                            Salvar
                          </button>
                        </form>
                      </details>
                    )}
                  </td>
                </tr>
              )
            })}
            {linhas.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-[#4a6080]">
                  Nenhum lançamento de multa ou sinistro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
