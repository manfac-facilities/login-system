import { getSinistros } from '@/lib/sofia/queries'
import type { Sinistro, AutorizacaoStatus } from '@/lib/sofia/types'
import Link from 'next/link'
import { atualizarAutorizacaoSinistroAction, excluirSinistroAction } from './_actions'
import { formatAutorizacaoLabel, autorizacaoBadgeClass } from '@/lib/sofia/autorizacao'
import DeleteConfirmButton from '@/components/sofia/DeleteConfirmButton'

type SinistroComRelacoes = Sinistro & {
  veiculos: { placa: string } | null
  motoristas: { nome: string } | null
}

const statusStyle: Record<string, string> = {
  aberto: 'bg-red-900 text-red-300',
  em_tratativa: 'bg-amber-900 text-amber-300',
  encerrado: 'bg-green-900 text-green-300',
}

const statusLabel: Record<string, string> = {
  aberto: 'Aberto',
  em_tratativa: 'Em tratativa',
  encerrado: 'Encerrado',
}

const tipoLabel: Record<string, string> = {
  colisao: 'Colisão',
  furto: 'Furto',
  avaria: 'Avaria',
  outro: 'Outro',
}

export default async function SinistrosPage() {
  const sinistros = await getSinistros()

  const totalAberto = (sinistros as SinistroComRelacoes[])
    .filter((s) => s.status !== 'encerrado')
    .reduce((sum, s) => sum + Number(s.valor_dano ?? 0), 0)

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Sinistros</h1>
          <p className="text-[#4a6080] text-sm mt-1">
            R$ {totalAberto.toFixed(2)} em sinistros abertos
          </p>
        </div>
        <Link
          href="/sofia/sinistros/novo"
          className="px-4 py-2 rounded-lg bg-[#f05a28] text-white text-sm font-medium hover:bg-[#d94e22] transition-colors"
        >
          + Registrar Sinistro
        </Link>
      </div>

      <div className="rounded-xl border border-[#1e3a5f] overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e3a5f] bg-[#0d2050]">
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Data</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Veículo</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Motorista</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Tipo</th>
              <th className="text-right px-4 py-3 text-[#4a6080] font-medium">Valor do dano</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Desconto</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Autorização</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {(sinistros as SinistroComRelacoes[]).map((s) => (
              <tr key={s.id} className="border-b border-[#1e3a5f] hover:bg-[#0d2050] transition-colors">
                <td className="px-4 py-3 text-[#94a3b8]">{new Date(s.data).toLocaleDateString('pt-BR')}</td>
                <td className="px-4 py-3 text-[#94a3b8] font-mono">{s.veiculos?.placa ?? '—'}</td>
                <td className="px-4 py-3 text-[#94a3b8]">{s.motoristas?.nome ?? '—'}</td>
                <td className="px-4 py-3 text-white">{tipoLabel[s.tipo]}</td>
                <td className="px-4 py-3 text-white text-right font-medium">
                  R$ {Number(s.valor_dano ?? 0).toFixed(2)}
                </td>
                <td className="px-4 py-3 text-[#94a3b8] text-sm">
                  {s.tipo_desconto === 'nenhum' ? '—' : `${s.tipo_desconto === 'total' ? 'Total' : 'Parcial'} · R$ ${Number(s.valor_descontado ?? 0).toFixed(2)}`}
                </td>
                <td className="px-4 py-3">
                  {(() => {
                    const sinistroTyped = s as SinistroComRelacoes & { autorizacao_status?: string; autorizacao_solicitado_em?: string | null }
                    const st = (sinistroTyped.autorizacao_status ?? 'sem_solicitacao') as AutorizacaoStatus
                    const badgeClass = autorizacaoBadgeClass(st)
                    const label = formatAutorizacaoLabel(st, sinistroTyped.autorizacao_solicitado_em ?? null)
                    return (
                      <div className="flex flex-col gap-1">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium w-fit ${badgeClass}`}>{label}</span>
                        <div className="flex gap-2">
                          {st === 'sem_solicitacao' && (
                            <form action={atualizarAutorizacaoSinistroAction.bind(null, s.id)}>
                              <button name="status" value="solicitado" type="submit" className="text-xs text-amber-400 hover:underline">Solicitar</button>
                            </form>
                          )}
                          {st === 'solicitado' && (
                            <>
                              <form action={atualizarAutorizacaoSinistroAction.bind(null, s.id)}>
                                <button name="status" value="autorizado" type="submit" className="text-xs text-green-400 hover:underline">Autorizar</button>
                              </form>
                              <form action={atualizarAutorizacaoSinistroAction.bind(null, s.id)}>
                                <button name="status" value="sem_solicitacao" type="submit" className="text-xs text-[#4a6080] hover:underline">← Cancelar</button>
                              </form>
                            </>
                          )}
                          {st === 'autorizado' && (
                            <form action={atualizarAutorizacaoSinistroAction.bind(null, s.id)}>
                              <button name="status" value="solicitado" type="submit" className="text-xs text-[#4a6080] hover:underline">← Revogar</button>
                            </form>
                          )}
                        </div>
                      </div>
                    )
                  })()}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/sofia/sinistros/${s.id}`}
                    className={`px-2 py-0.5 rounded text-xs font-medium ${statusStyle[s.status]} hover:opacity-80 transition-opacity`}
                  >
                    {statusLabel[s.status]}
                  </Link>
                </td>
                <td className="px-4 py-3 text-right">
                  <DeleteConfirmButton action={excluirSinistroAction} id={s.id} />
                </td>
              </tr>
            ))}
            {sinistros.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-[#4a6080]">
                  Nenhum sinistro registrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
