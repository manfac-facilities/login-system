import { createClient } from '@/lib/supabase/server'
import type { Multa, Sinistro, KmExcedidoDesconto, AutorizacaoStatus } from '@/lib/sofia/types'
import {
  atualizarStatusMultaAction,
  registrarDescontoMultaAction,
  desfazerDescontoMultaAction,
  atualizarStatusDescontoSinistroAction,
  registrarDescontoSinistroAction,
  desfazerDescontoSinistroAction,
} from './_actions'
import { atualizarAutorizacaoMultaAction } from '../multas/_actions'
import { atualizarAutorizacaoSinistroAction } from '../sinistros/_actions'
import { atualizarAutorizacaoKmExcedidoAction } from '../km/_actions'
import { formatAutorizacaoLabel, autorizacaoBadgeClass } from '@/lib/sofia/autorizacao'

type LinhaDesconto = {
  origem: 'multa' | 'sinistro' | 'km_excedido'
  id: string
  data: string
  veiculoPlaca: string | null
  motoristaNome: string | null
  valor: number
  status: string
  valor_descontado: number | null
  tipo_desconto: string
  autorizacao_assinada: boolean
  autorizacao_status: AutorizacaoStatus
  autorizacao_solicitado_em: string | null
  km_contratual?: number
  km_realizado?: number
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

  const [{ data: multas }, { data: sinistros }, { data: excedidos }] = await Promise.all([
    supabase.from('multas').select('*, veiculos(placa), motoristas(nome)').order('data', { ascending: false }),
    supabase.from('sinistros').select('*, veiculos(placa), motoristas(nome)').order('data', { ascending: false }),
    supabase.from('km_excedido_desconto').select('*, veiculos(placa), motoristas(nome)').order('mes', { ascending: false }),
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
      autorizacao_status: m.autorizacao_status,
      autorizacao_solicitado_em: m.autorizacao_solicitado_em,
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
      autorizacao_status: s.autorizacao_status,
      autorizacao_solicitado_em: s.autorizacao_solicitado_em,
    })
  )

  const linhasKm: LinhaDesconto[] = (
    (excedidos ?? []) as (KmExcedidoDesconto & {
      veiculos: { placa: string } | null
      motoristas: { nome: string } | null
    })[]
  ).map((e) => ({
    origem: 'km_excedido',
    id: e.id,
    data: e.mes,
    veiculoPlaca: e.veiculos?.placa ?? null,
    motoristaNome: e.motoristas?.nome ?? null,
    valor: 0,
    status: 'km_excedido',
    valor_descontado: null,
    tipo_desconto: 'nenhum',
    autorizacao_assinada: false,
    autorizacao_status: e.autorizacao_status,
    autorizacao_solicitado_em: e.autorizacao_solicitado_em,
    km_contratual: e.km_contratual,
    km_realizado: e.km_realizado,
  }))

  const linhas = [...linhasMultas, ...linhasSinistros, ...linhasKm].sort(
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
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Autorização</th>
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

              const autorizacaoAction =
                l.origem === 'multa'
                  ? atualizarAutorizacaoMultaAction
                  : l.origem === 'sinistro'
                  ? atualizarAutorizacaoSinistroAction
                  : atualizarAutorizacaoKmExcedidoAction

              return (
                <tr key={`${l.origem}-${l.id}`} className="border-b border-[#1e3a5f] hover:bg-[#0d2050] transition-colors">
                  <td className="px-4 py-3">
                    {l.origem === 'km_excedido' ? (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-900 text-amber-300">
                        KM Excedido
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-[#1e3a5f] text-[#94a3b8]">
                        {l.origem === 'multa' ? 'Multa' : 'Sinistro'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[#94a3b8]">{new Date(l.data).toLocaleDateString('pt-BR')}</td>
                  <td className="px-4 py-3 text-[#94a3b8] font-mono">{l.veiculoPlaca ?? '—'}</td>
                  <td className="px-4 py-3 text-[#94a3b8]">{l.motoristaNome ?? '—'}</td>
                  <td className="px-4 py-3 text-white text-right font-medium">
                    {l.origem === 'km_excedido'
                      ? `+${((l.km_realizado ?? 0) - (l.km_contratual ?? 0)).toLocaleString('pt-BR')} km`
                      : `R$ ${Number(l.valor).toFixed(2)}`}
                  </td>
                  <td className="px-4 py-3">
                    {(() => {
                      const st = l.autorizacao_status
                      return (
                        <div className="flex flex-col gap-1">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium w-fit ${autorizacaoBadgeClass(st)}`}>
                            {formatAutorizacaoLabel(st, l.autorizacao_solicitado_em)}
                          </span>
                          <div className="flex gap-2">
                            {st === 'sem_solicitacao' && (
                              <form action={autorizacaoAction.bind(null, l.id)}>
                                <button name="status" value="solicitado" type="submit" className="text-xs text-amber-400 hover:underline active:scale-95 transition-transform">Solicitar</button>
                              </form>
                            )}
                            {st === 'solicitado' && (
                              <>
                                <form action={autorizacaoAction.bind(null, l.id)}>
                                  <button name="status" value="autorizado" type="submit" className="text-xs text-green-400 hover:underline active:scale-95 transition-transform">Autorizar</button>
                                </form>
                                <form action={autorizacaoAction.bind(null, l.id)}>
                                  <button name="status" value="sem_solicitacao" type="submit" className="text-xs text-[#4a6080] hover:underline active:scale-95 transition-transform">← Cancelar</button>
                                </form>
                              </>
                            )}
                            {st === 'autorizado' && (
                              <form action={autorizacaoAction.bind(null, l.id)}>
                                <button name="status" value="solicitado" type="submit" className="text-xs text-[#4a6080] hover:underline active:scale-95 transition-transform">← Revogar</button>
                              </form>
                            )}
                          </div>
                        </div>
                      )
                    })()}
                  </td>
                  <td className="px-4 py-3">
                    {l.origem === 'km_excedido' ? (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-[#1e3a5f] text-[#94a3b8]">—</span>
                    ) : (
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusStyle[l.status] ?? 'bg-[#1e3a5f] text-[#94a3b8]'}`}>
                        {l.status}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {l.origem !== 'km_excedido' && proximoStatus[l.status] && (
                      <form action={avancarAction.bind(null, l.id, proximoStatus[l.status])}>
                        <button type="submit" className="text-xs text-[#4a6080] hover:text-[#94a3b8] transition-colors active:scale-95 transition-transform">
                          → {proximoStatus[l.status]}
                        </button>
                      </form>
                    )}
                    {l.origem !== 'km_excedido' && l.status === 'descontada' && (
                      <form action={desfazerAction.bind(null, l.id)} className="mt-1">
                        <button type="submit" className="text-xs text-[#4a6080] hover:text-[#94a3b8] transition-colors active:scale-95 transition-transform">
                          desfazer desconto
                        </button>
                      </form>
                    )}
                    {l.origem !== 'km_excedido' && l.status === 'validada' && (
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
                            className="py-1.5 rounded bg-[#f05a28] text-white text-xs font-medium hover:bg-[#d94e22] transition-colors active:scale-95"
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
                <td colSpan={8} className="px-4 py-12 text-center text-[#4a6080]">
                  Nenhum lançamento de multa, sinistro ou KM excedido.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
