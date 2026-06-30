import { createClient } from '@/lib/supabase/server'
import { getMotoristaDocumentos } from '@/lib/sofia/queries'
import { notFound } from 'next/navigation'
import { marcarTermoAssinadoAction } from './_actions'
import DeleteConfirmButton from '@/components/sofia/DeleteConfirmButton'
import { desativarMotoristaAction } from '../_actions'

type HistoricoVeiculo = {
  id: string
  inicio: string
  fim: string | null
  created_at: string
  veiculo_id: string
  veiculos: { placa: string; modelo: string; km_contratual_mensal: number | null } | null
  equipes: { codigo: string } | null
}

type Multa = {
  id: string
  data: string
  descricao: string | null
  valor: number
  status: string
  tipo_desconto: string
  autorizacao_status: string | null
  autorizacao_solicitado_em: string | null
}

type Sinistro = {
  id: string
  data: string
  tipo: string
  descricao: string
  valor_dano: number | null
  status: string
  tipo_desconto: string
  autorizacao_status: string | null
  autorizacao_solicitado_em: string | null
}

type Abastecimento = {
  id: string
  data: string
  valor: number
  litros: number | null
  posto: string | null
  veiculos: { placa: string } | null
}

type KmExcedido = {
  veiculo_id: string
  mes: string
  km_contratual: number
  km_realizado: number
  autorizacao_status: string
  autorizacao_solicitado_em: string | null
}

function diasText(solicitadoEm: string | null): string | null {
  if (!solicitadoEm) return null
  const d = Math.floor((Date.now() - new Date(solicitadoEm).getTime()) / 86400000)
  return d === 0 ? 'hoje' : `há ${d} dia${d !== 1 ? 's' : ''}`
}

const STATUS_BADGE: Record<string, string> = {
  autorizado: 'bg-green-900 text-green-300',
  solicitado: 'bg-amber-900 text-amber-300',
  sem_solicitacao: 'bg-[#1e3a5f] text-[#94a3b8]',
}

function authLabel(st: string, solicitadoEm: string | null): string {
  if (st === 'autorizado') return 'Autorizado'
  if (st === 'solicitado') {
    const dias = diasText(solicitadoEm)
    return dias ? `Solicitado · ${dias}` : 'Solicitado'
  }
  return 'Sem solicitação'
}

export default async function MotoristaDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [
    { data: motorista, error },
    documentos,
    { data: historicoVeiculos },
    { data: multas },
    { data: sinistros },
  ] = await Promise.all([
    supabase.from('motoristas').select('*, equipes(codigo)').eq('id', id).single(),
    getMotoristaDocumentos(id),
    supabase
      .from('veiculo_responsabilidade_historico')
      .select('id, inicio, fim, created_at, veiculo_id, veiculos(placa, modelo, km_contratual_mensal), equipes(codigo)')
      .eq('motorista_id', id)
      .order('inicio', { ascending: false }),
    supabase
      .from('multas')
      .select('id, data, descricao, valor, status, tipo_desconto, autorizacao_status, autorizacao_solicitado_em')
      .eq('motorista_id', id)
      .order('data', { ascending: false }),
    supabase
      .from('sinistros')
      .select('id, data, tipo, descricao, valor_dano, status, tipo_desconto, autorizacao_status, autorizacao_solicitado_em')
      .eq('motorista_id', id)
      .order('data', { ascending: false }),
  ])

  if (error) throw error
  if (!motorista) notFound()

  const historico = (historicoVeiculos ?? []) as unknown as HistoricoVeiculo[]
  const veiculoIds = [...new Set(historico.map((h) => h.veiculo_id).filter(Boolean))]

  const veiculoAtual = historico.find((h) => h.fim === null)

  // Parallel: abastecimentos + KM data para o veículo atual
  const mesAtual = new Date().toISOString().slice(0, 7) + '-01'
  const [{ data: abastecimentos }, { data: kmDiario }, { data: kmExcedidosData }] = await Promise.all([
    veiculoIds.length > 0
      ? supabase
          .from('abastecimentos')
          .select('id, data, valor, litros, posto, veiculos(placa)')
          .in('veiculo_id', veiculoIds)
          .order('data', { ascending: false })
          .limit(30)
      : Promise.resolve({ data: [] as Abastecimento[] }),
    veiculoAtual?.veiculo_id
      ? supabase
          .from('km_diario')
          .select('km_atual, data')
          .eq('veiculo_id', veiculoAtual.veiculo_id)
          .gte('data', mesAtual.slice(0, 7) + '-01')
          .lt('data', new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString().slice(0, 10))
          .order('data', { ascending: true })
      : Promise.resolve({ data: [] as { km_atual: number; data: string }[] }),
    veiculoAtual?.veiculo_id
      ? supabase
          .from('km_excedido_desconto')
          .select('*')
          .eq('veiculo_id', veiculoAtual.veiculo_id)
      : Promise.resolve({ data: [] as KmExcedido[] }),
  ])

  const termo = documentos.find((d) => d.tipo === 'termo_uso')
  const multasList = (multas ?? []) as unknown as Multa[]
  const sinistrosList = (sinistros ?? []) as unknown as Sinistro[]
  const abastecimentosList = (abastecimentos ?? []) as unknown as Abastecimento[]
  const kmExcedidos = (kmExcedidosData ?? []) as unknown as KmExcedido[]

  // KM diário do mês atual
  const kmDiarioMes = (kmDiario ?? []) as { km_atual: number; data: string }[]
  const kmInicio = kmDiarioMes.length > 0 ? kmDiarioMes[0].km_atual : null
  const kmFim = kmDiarioMes.length > 0 ? kmDiarioMes[kmDiarioMes.length - 1].km_atual : null
  const kmRodados = kmInicio != null && kmFim != null ? kmFim - kmInicio : null
  const kmContratual = veiculoAtual?.veiculos?.km_contratual_mensal ?? null
  const kmDisponivel = kmContratual != null && kmRodados != null ? kmContratual - kmRodados : null

  const kmExcedidoMesAtual = kmExcedidos.find(
    (e) => e.mes === mesAtual || e.mes.startsWith(mesAtual.slice(0, 7))
  )

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-white">{motorista.nome}</h1>
          {!motorista.ativo && (
            <span className="px-2 py-0.5 rounded text-xs bg-[#1e3a5f] text-[#4a6080]">Inativo</span>
          )}
        </div>
        <p className="text-[#4a6080] text-sm mt-1">
          CNH {motorista.cnh ?? '—'} · {motorista.equipes?.codigo ?? 'sem equipe'}
          {motorista.contato ? ` · ${motorista.contato}` : ''}
        </p>
      </div>

      {/* Termo de uso */}
      <h2 className="text-sm font-medium text-[#4a6080] uppercase tracking-wider mb-3">
        Documentos assinados
      </h2>
      <div className="flex items-center justify-between p-4 rounded-xl border border-[#1e3a5f] bg-[#0d2050] mb-8">
        <div>
          <p className="text-white text-sm font-medium">Termo de Uso de Veículo</p>
          {termo?.assinado && (
            <p className="text-[#4a6080] text-xs mt-1">
              Assinado em {new Date(termo.data_assinatura!).toLocaleDateString('pt-BR')}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`px-2 py-0.5 rounded text-xs font-medium ${
              termo?.assinado ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'
            }`}
          >
            {termo?.assinado ? 'Assinado' : 'Pendente'}
          </span>
          <form action={marcarTermoAssinadoAction.bind(null, id, !termo?.assinado)}>
            <button type="submit" className="text-xs text-[#f05a28] hover:underline">
              {termo?.assinado ? 'Marcar como pendente' : 'Marcar como assinado'}
            </button>
          </form>
        </div>
      </div>

      {/* KM do mês */}
      {veiculoAtual && (
        <>
          <h2 className="text-sm font-medium text-[#4a6080] uppercase tracking-wider mb-3">
            KM do mês — {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
          </h2>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div className="p-3 rounded-xl border border-[#1e3a5f] bg-[#0d2050] text-center">
              <p className="text-[#4a6080] text-xs mb-1">Contratado</p>
              <p className="text-white font-mono font-medium">
                {kmContratual != null ? `${kmContratual.toLocaleString('pt-BR')} km` : '—'}
              </p>
            </div>
            <div className="p-3 rounded-xl border border-[#1e3a5f] bg-[#0d2050] text-center">
              <p className="text-[#4a6080] text-xs mb-1">Utilizado</p>
              <p className={`font-mono font-medium ${kmRodados != null && kmContratual != null && kmRodados > kmContratual ? 'text-red-400' : 'text-white'}`}>
                {kmRodados != null ? `${kmRodados.toLocaleString('pt-BR')} km` : '—'}
              </p>
            </div>
            <div className="p-3 rounded-xl border border-[#1e3a5f] bg-[#0d2050] text-center">
              <p className="text-[#4a6080] text-xs mb-1">Disponível</p>
              <p className={`font-mono font-medium ${kmDisponivel != null && kmDisponivel < 0 ? 'text-red-400' : 'text-green-400'}`}>
                {kmDisponivel != null ? `${kmDisponivel.toLocaleString('pt-BR')} km` : '—'}
              </p>
            </div>
          </div>
          {kmExcedidoMesAtual && (
            <div className="p-3 rounded-xl border border-red-900 bg-red-950/20 mb-8">
              <p className="text-red-400 text-xs font-medium mb-1">KM excedido neste mês</p>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGE[kmExcedidoMesAtual.autorizacao_status] ?? STATUS_BADGE.sem_solicitacao}`}>
                {authLabel(kmExcedidoMesAtual.autorizacao_status, kmExcedidoMesAtual.autorizacao_solicitado_em)}
              </span>
            </div>
          )}
          {!kmExcedidoMesAtual && <div className="mb-8" />}
        </>
      )}

      {/* Multas e descontos */}
      <h2 className="text-sm font-medium text-[#4a6080] uppercase tracking-wider mb-3">
        Multas e descontos
      </h2>
      {multasList.length === 0 ? (
        <p className="text-[#4a6080] text-sm mb-8">Nenhuma multa registrada para este motorista.</p>
      ) : (
        <div className="flex flex-col gap-2 mb-8">
          {multasList.map((m) => {
            const st = m.autorizacao_status ?? 'sem_solicitacao'
            return (
              <div
                key={m.id}
                className="flex items-start justify-between px-4 py-3 rounded-lg border border-[#1e3a5f] bg-[#0d2050]"
              >
                <div>
                  <p className="text-white text-sm font-medium">R$ {m.valor.toFixed(2)}</p>
                  <p className="text-[#94a3b8] text-xs">{m.descricao ?? '—'}</p>
                  <p className="text-[#4a6080] text-xs">{new Date(m.data).toLocaleDateString('pt-BR')}</p>
                </div>
                <span className={`px-2 py-0.5 rounded text-xs font-medium shrink-0 ${STATUS_BADGE[st] ?? STATUS_BADGE.sem_solicitacao}`}>
                  {authLabel(st, m.autorizacao_solicitado_em)}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Sinistros e descontos */}
      <h2 className="text-sm font-medium text-[#4a6080] uppercase tracking-wider mb-3">
        Sinistros e descontos
      </h2>
      {sinistrosList.length === 0 ? (
        <p className="text-[#4a6080] text-sm mb-8">Nenhum sinistro registrado para este motorista.</p>
      ) : (
        <div className="flex flex-col gap-2 mb-8">
          {sinistrosList.map((s) => {
            const st = s.autorizacao_status ?? 'sem_solicitacao'
            return (
              <div
                key={s.id}
                className="flex items-start justify-between px-4 py-3 rounded-lg border border-[#1e3a5f] bg-[#0d2050]"
              >
                <div>
                  <p className="text-white text-sm font-medium capitalize">{s.tipo} — R$ {(s.valor_dano ?? 0).toFixed(2)}</p>
                  <p className="text-[#94a3b8] text-xs">{s.descricao}</p>
                  <p className="text-[#4a6080] text-xs">{new Date(s.data).toLocaleDateString('pt-BR')}</p>
                </div>
                <span className={`px-2 py-0.5 rounded text-xs font-medium shrink-0 ${STATUS_BADGE[st] ?? STATUS_BADGE.sem_solicitacao}`}>
                  {authLabel(st, s.autorizacao_solicitado_em)}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Histórico de abastecimento */}
      <h2 className="text-sm font-medium text-[#4a6080] uppercase tracking-wider mb-3">
        Histórico de abastecimento
      </h2>
      {abastecimentosList.length === 0 ? (
        <p className="text-[#4a6080] text-sm mb-8">Nenhum abastecimento registrado para os veículos deste motorista.</p>
      ) : (
        <div className="rounded-xl border border-[#1e3a5f] overflow-x-auto mb-8">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e3a5f] bg-[#0d2050]">
                <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Data</th>
                <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Placa</th>
                <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Litros</th>
                <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Valor</th>
                <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Posto</th>
              </tr>
            </thead>
            <tbody>
              {abastecimentosList.map((a) => (
                <tr key={a.id} className="border-b border-[#1e3a5f] last:border-0">
                  <td className="px-4 py-3 text-[#94a3b8]">{new Date(a.data).toLocaleDateString('pt-BR')}</td>
                  <td className="px-4 py-3 text-white font-mono">{a.veiculos?.placa ?? '—'}</td>
                  <td className="px-4 py-3 text-[#94a3b8]">{a.litros != null ? `${a.litros} L` : '—'}</td>
                  <td className="px-4 py-3 text-white">R$ {a.valor.toFixed(2)}</td>
                  <td className="px-4 py-3 text-[#94a3b8]">{a.posto ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Histórico de veículos */}
      <h2 className="text-sm font-medium text-[#4a6080] uppercase tracking-wider mb-3">
        Histórico de veículos
      </h2>
      {historico.length === 0 ? (
        <p className="text-[#4a6080] text-sm">Nenhuma troca de veículo registrada ainda.</p>
      ) : (
        <div className="flex flex-col gap-3 border-l-2 border-[#1e3a5f] pl-4">
          {historico.map((h) => (
            <div key={h.id} className="relative">
              <span className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-[#f05a28]" />
              <p className="text-white text-sm font-mono">{h.veiculos?.placa ?? '—'}</p>
              <p className="text-[#94a3b8] text-xs">{h.veiculos?.modelo ?? ''}</p>
              <p className="text-[#4a6080] text-xs">{h.equipes?.codigo ?? '—'}</p>
              <p className="text-[#4a6080] text-xs">
                {new Date(h.inicio).toLocaleDateString('pt-BR')} →{' '}
                {h.fim ? new Date(h.fim).toLocaleDateString('pt-BR') : 'atual'}
              </p>
              <p className="text-[#4a6080] text-xs">
                Registrado em {new Date(h.created_at).toLocaleString('pt-BR')}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Zona de perigo */}
      {motorista.ativo && (
        <div className="mt-10 p-4 rounded-xl border border-red-800 bg-red-950/20">
          <h2 className="text-sm font-medium text-red-400 uppercase tracking-wider mb-3">Zona de Perigo</h2>
          <p className="text-[#94a3b8] text-sm mb-3">
            Desativar este motorista remove-o das listagens ativas. O histórico de multas, sinistros e checklists é preservado.
          </p>
          <DeleteConfirmButton action={desativarMotoristaAction} id={motorista.id} label="Desativar Motorista" />
        </div>
      )}
    </div>
  )
}
