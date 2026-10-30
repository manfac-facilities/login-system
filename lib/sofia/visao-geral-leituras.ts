import { createClient } from '@/lib/supabase/server'
import {
  getEquipes, getVeiculos, getMotoristas, getMultasPendentes,
  getRevisoesAtrasadas, getRevisoesVenceEmBreve,
} from './queries'
import { getGastos, hojeSP } from './extratos/leituras'
import {
  frotaPorSituacao, diaUtilCobrado, equipesSemKm, classificarCnh, montarAcoes,
  somarCustosDoMes, agruparExtratosPorCentroCusto, documentosAVencer, carrosNaOficina,
} from './visao-geral'

/** Tudo pela RLS do usuário. Qualquer falha propaga para o error.tsx de /sofia. */
export async function carregarVisaoGeral() {
  const hoje = hojeSP()
  const inicioMes = `${hoje.slice(0, 7)}-01`
  const diaKm = diaUtilCobrado(hoje)
  const supabase = await createClient()

  const lerTabela = async <T,>(q: PromiseLike<{ data: T[] | null; error: unknown }>, nome: string): Promise<T[]> => {
    const { data, error } = await q
    if (error) {
      console.error(`[sofia/visao-geral] ${nome} falhou:`, error)
      throw new Error('Erro ao carregar dados do sistema. Recarregue a página; se persistir, avise o suporte.')
    }
    return data ?? []
  }

  const [
    equipes, veiculos, motoristas, multasPendentes, sinistrosAbertos, documentosTodos, revAtrasadas, revBreve, revisoesCriadas,
    kmDoDia, multasMes, sinistrosMes, revisoesMes, abastecimentosMes, gastosExtrato,
  ] = await Promise.all([
    getEquipes(), getVeiculos(), getMotoristas(), getMultasPendentes(),
    lerTabela(
      supabase.from('sinistros').select('status, veiculos(placa)').neq('status', 'encerrado'),
      'sinistros_abertos'
    ),
    lerTabela(
      supabase.from('documentos_veiculo').select('veiculo_id, tipo, vencimento, created_at, veiculos(placa)'),
      'documentos_veiculo'
    ),
    getRevisoesAtrasadas(), getRevisoesVenceEmBreve(),
    lerTabela(supabase.from('revisoes').select('veiculo_id, created_at'), 'revisoes_criadas'),
    diaKm
      ? lerTabela(supabase.from('km_diario').select('equipe_id').eq('data', diaKm), 'km_diario')
      : Promise.resolve([] as { equipe_id: string }[]),
    lerTabela(supabase.from('multas').select('valor, valor_descontado').gte('data', inicioMes), 'multas'),
    lerTabela(supabase.from('sinistros').select('valor_dano, valor_descontado').gte('data', inicioMes), 'sinistros'),
    lerTabela(supabase.from('revisoes').select('valor').gte('data_realizada', inicioMes), 'revisoes'),
    lerTabela(supabase.from('abastecimentos').select('valor').gte('data', inicioMes), 'abastecimentos'),
    getGastos({ de: inicioMes, ate: hoje }),
  ])

  // Carro da equipe = cadastro do veículo (veiculos.equipe_id), como a base de Veículos e o e-mail diário:
  // criar/editar veículo grava equipe_id sem passar pelo histórico de responsabilidade.
  const responsabilidades = veiculos
    .filter((v) => v.equipe_id)
    .map((v) => ({ veiculo_id: v.id, equipe_id: v.equipe_id as string }))
  const frota = frotaPorSituacao(veiculos, responsabilidades)
  const semKm = diaKm ? equipesSemKm({ equipes, responsabilidades, veiculos, kmDoDia }) : []
  const cnh = classificarCnh(motoristas, hoje, 60)
  const oficinaAtrasada = veiculos
    .filter((v) => v.status === 'manutencao' && v.previsao_retorno_oficina && v.previsao_retorno_oficina < hoje)
    .map((v) => v.placa)

  const documentos = documentosAVencer(documentosTodos, hoje, 30)
  const placaRel = (r: unknown): string | null =>
    (Array.isArray(r) ? r[0]?.placa : (r as { placa?: string } | null)?.placa) ?? null
  const desdePorVeiculo = new Map<string, string>()
  for (const r of revisoesCriadas) {
    const a = desdePorVeiculo.get(r.veiculo_id)
    if (!a || r.created_at > a) desdePorVeiculo.set(r.veiculo_id, r.created_at)
  }

  const acoes = montarAcoes(
    {
      revisoesAtrasadas: revAtrasadas.map((r) => ({ placa: r.placa, motivo: r.motivo })),
      revisoesBreve: revBreve.map((r) => ({ placa: r.placa, km_restantes: r.km_restantes })),
      equipesSemKm: semKm,
      diaKm,
      documentos: documentos.map((d) => ({ placa: placaRel(d.veiculos), tipo: d.tipo, vencimento: d.vencimento })),
      cnhVencidas: cnh.vencidas,
      cnhVencendo: cnh.vencendo,
      multas: multasPendentes,
      sinistros: sinistrosAbertos.map((x) => ({ placa: placaRel(x.veiculos), status: x.status })),
      veiculosOficinaAtrasados: oficinaAtrasada,
    },
    hoje
  )

  return {
    hoje,
    inicioMes,
    frota,
    acoes,
    oficina: carrosNaOficina(veiculos, desdePorVeiculo, hoje),
    custos: somarCustosDoMes({
      veiculos, multas: multasMes, sinistros: sinistrosMes, revisoes: revisoesMes, abastecimentos: abastecimentosMes,
    }),
    qtdVeiculosCustos: veiculos.length,
    extratos: agruparExtratosPorCentroCusto(gastosExtrato),
  }
}
