import { createClient } from '@/lib/supabase/server'
import {
  getEquipes, getVeiculos, getMotoristas, getMultasPendentes, getSinistrosAbertos,
  getDocumentosVencendo, getRevisoesAtrasadas, getRevisoesVenceEmBreve, getResponsabilidadesAtuais,
} from './queries'
import { getGastos, hojeSP } from './extratos/leituras'
import {
  frotaPorSituacao, diaUtilCobrado, equipesSemKm, classificarCnh, montarAcoes,
  somarCustosDoMes, agruparExtratosPorCentroCusto,
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
    equipes, veiculos, motoristas, multasPendentes, sinistrosAbertos, documentos, revAtrasadas, revBreve, responsabilidades,
    kmDoDia, multasMes, sinistrosMes, revisoesMes, abastecimentosMes, gastosExtrato,
  ] = await Promise.all([
    getEquipes(), getVeiculos(), getMotoristas(), getMultasPendentes(), getSinistrosAbertos(),
    getDocumentosVencendo(30), getRevisoesAtrasadas(), getRevisoesVenceEmBreve(), getResponsabilidadesAtuais(),
    diaKm
      ? lerTabela(supabase.from('km_diario').select('equipe_id').eq('data', diaKm), 'km_diario')
      : Promise.resolve([] as { equipe_id: string }[]),
    lerTabela(supabase.from('multas').select('valor, valor_descontado').gte('data', inicioMes), 'multas'),
    lerTabela(supabase.from('sinistros').select('valor_dano, valor_descontado').gte('data', inicioMes), 'sinistros'),
    lerTabela(supabase.from('revisoes').select('valor').gte('data_realizada', inicioMes), 'revisoes'),
    lerTabela(supabase.from('abastecimentos').select('valor').gte('data', inicioMes), 'abastecimentos'),
    getGastos({ de: inicioMes, ate: hoje }),
  ])

  const frota = frotaPorSituacao(veiculos, responsabilidades)
  const semKm = diaKm ? equipesSemKm({ equipes, responsabilidades, veiculos, kmDoDia }) : []
  const cnh = classificarCnh(motoristas, hoje, 30)
  const oficinaAtrasada = veiculos
    .filter((v) => v.status === 'manutencao' && v.previsao_retorno_oficina && v.previsao_retorno_oficina < hoje)
    .map((v) => v.placa)

  const acoes = montarAcoes(
    {
      revisoesAtrasadas: revAtrasadas.map((r) => ({ placa: r.placa, motivo: r.motivo })),
      revisoesBreve: revBreve.map((r) => ({ placa: r.placa, km_restantes: r.km_restantes })),
      equipesSemKm: semKm,
      diaKm,
      documentos: documentos.map((d) => ({
        placa: (d as unknown as { veiculos?: { placa?: string } | null }).veiculos?.placa ?? null,
        tipo: d.tipo,
        vencimento: d.vencimento,
      })),
      cnhVencidas: cnh.vencidas,
      cnhVencendo: cnh.vencendo,
      multasSemTratativa: multasPendentes.length,
      sinistrosAbertos: sinistrosAbertos.length,
      veiculosOficinaAtrasados: oficinaAtrasada,
    },
    hoje
  )

  return {
    hoje,
    inicioMes,
    frota,
    acoes,
    custos: somarCustosDoMes({
      veiculos, multas: multasMes, sinistros: sinistrosMes, revisoes: revisoesMes, abastecimentos: abastecimentosMes,
    }),
    qtdVeiculosCustos: veiculos.length,
    extratos: agruparExtratosPorCentroCusto(gastosExtrato),
  }
}
