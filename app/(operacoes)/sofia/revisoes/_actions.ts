'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { podeGerirFrotas, requireGestorFrotas } from '@/lib/sofia/permissoes'
import { logAudit } from '@/lib/sofia/auditLog'
import { buscarTudo, hojeSP } from '@/lib/sofia/bases/leitura'
import { formatarKm } from '@/lib/sofia/revisaoStatus'
import { INTERVALO_REVISAO_KM_PADRAO, intervaloDoVeiculo, revisaoVigente, type RevisaoPrev } from '@/lib/sofia/revisaoPrevisao'
import {
  MAPA_GRAVACAO, MAX_LINHAS, contar, linhasParaGravar, paraCelulas, validarLinhas,
  type ContextoImportacao, type LinhaImportada,
} from '@/lib/sofia/revisaoImportacao'

type State = { error?: string; success?: boolean }

const inteiro = (v: FormDataEntryValue | null): number | null => {
  const s = String(v ?? '').trim()
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) ? Math.round(n) : NaN
}

export async function criarRevisaoAction(_prev: State, formData: FormData): Promise<State> {
  const veiculo_id = formData.get('veiculo_id') as string
  const motorista_id = (formData.get('motorista_id') as string) || null
  const tipo = formData.get('tipo') as string
  const fornecedor = ((formData.get('fornecedor') as string) ?? '').trim() || null
  const valor = formData.get('valor') ? Number(formData.get('valor')) : null
  const data_realizada = (formData.get('data_realizada') as string) || null
  const km_realizada = inteiro(formData.get('km_realizada'))
  const modoForm = formData.get('modo_proxima') as string
  const modo = modoForm === 'manual' || modoForm === 'nao' ? modoForm : 'auto'
  const proxima_km_form = inteiro(formData.get('proxima_km'))
  const observacoes = ((formData.get('observacoes') as string) ?? '').trim() || null
  const pecas_trocadas = ((formData.get('pecas_trocadas') as string) ?? '').trim() || null

  if (!veiculo_id || !tipo) return { error: 'Veículo e tipo são obrigatórios' }
  if (km_realizada == null || Number.isNaN(km_realizada) || km_realizada < 0) return { error: 'Informe o KM da revisão.' }
  if (modo === 'manual' && (proxima_km_form == null || Number.isNaN(proxima_km_form) || proxima_km_form < 0)) {
    return { error: 'Informe o KM da próxima revisão ou escolha outra opção.' }
  }

  const supabase = await createClient()
  const [{ data: veiculo, error: errVeiculo }, { data: anteriores, error: errRevisoes }] = await Promise.all([
    supabase.from('veiculos').select('id, km_atual, intervalo_revisao_km').eq('id', veiculo_id).maybeSingle(),
    supabase.from('revisoes').select('id, veiculo_id, tipo, km_realizada, data_realizada, created_at, proxima_km, proxima_data, prever_proxima').eq('veiculo_id', veiculo_id),
  ])
  if (errVeiculo || errRevisoes) return { error: 'Erro ao registrar revisão' }
  if (!veiculo) return { error: 'Veículo não encontrado' }

  // Data igual ou depois da vigente com KM menor = número digitado errado (não bloqueia histórico antigo).
  const vigente = revisaoVigente((anteriores ?? []) as RevisaoPrev[])
  if (vigente?.km_realizada != null && km_realizada < Number(vigente.km_realizada)) {
    const dataVig = vigente.data_realizada?.slice(0, 10) ?? null
    if (!data_realizada || !dataVig || data_realizada >= dataVig) {
      return {
        error: `O KM (${formatarKm(km_realizada)}) é menor que o da última revisão deste carro (${formatarKm(Number(vigente.km_realizada))}). Confira o número.`,
      }
    }
  }

  const prever_proxima = modo !== 'nao'
  // "auto" é sempre recalculado aqui, nunca o número que veio do navegador.
  const proxima_km = modo === 'auto' ? km_realizada + intervaloDoVeiculo(veiculo) : modo === 'manual' ? proxima_km_form : null
  const proxima_data = prever_proxima ? (formData.get('proxima_data') as string) || null : null

  const hoje = new Date().toISOString().split('T')[0]
  const status = proxima_data && proxima_data < hoje ? 'atrasada' : proxima_data ? 'agendada' : 'em_dia'

  const { error } = await supabase.from('revisoes').insert({
    veiculo_id, motorista_id, tipo, fornecedor, valor, data_realizada, km_realizada, proxima_data, proxima_km, status,
    observacoes, pecas_trocadas, prever_proxima, origem: 'manual',
  })

  if (error) return { error: 'Erro ao registrar revisão' }
  revalidatePath('/sofia/revisoes')
  revalidatePath('/sofia/revisoes/historico')
  return { success: true }
}

export interface ResultadoImportacaoRevisoes {
  error?: string
  importadas?: number
  avisosIncluidos?: number
  erros?: number
  repetidas?: number
}

/**
 * Grava a planilha de revisões. Só gestor/admin. As linhas que vêm do navegador são
 * revalidadas aqui contra o banco (placa, KM, data, repetidas) com a mesma função da prévia;
 * a gravação é um único insert (tudo ou nada).
 */
export async function importarRevisoesAction(linhas: LinhaImportada[], incluirAvisos: boolean): Promise<ResultadoImportacaoRevisoes> {
  const supabase = await createClient()
  const negado = await requireGestorFrotas(supabase)
  if (negado) return { error: negado }

  const recebidas = Array.isArray(linhas) ? linhas.filter((l) => l && typeof l === 'object') : []
  if (recebidas.length === 0) return { error: 'Nenhuma linha para importar' }
  if (recebidas.length > MAX_LINHAS) return { error: 'Arquivo grande demais' }

  let ctx: ContextoImportacao
  try {
    const [veiculos, existentes] = await Promise.all([
      buscarTudo<ContextoImportacao['veiculos'][number]>((a, b) =>
        supabase.from('veiculos').select('id, placa, km_atual, intervalo_revisao_km').order('id').range(a, b)),
      buscarTudo<ContextoImportacao['existentes'][number]>((a, b) =>
        supabase.from('revisoes').select('veiculo_id, km_realizada').order('id').range(a, b)),
    ])
    ctx = { hoje: hojeSP(), veiculos, existentes }
  } catch {
    return { error: 'Erro ao importar as revisões. Nada foi gravado.' }
  }

  const resultado = validarLinhas(recebidas.map(paraCelulas), MAPA_GRAVACAO, ctx)
  const gravar = linhasParaGravar(resultado, incluirAvisos === true)
  if (gravar.length === 0) return { error: 'Nenhuma linha para importar' }

  const intervalo = new Map(ctx.veiculos.map((v) => [v.id, intervaloDoVeiculo(v)]))
  const { error } = await supabase.from('revisoes').insert(
    gravar.map((l) => ({
      veiculo_id: l.veiculo_id,
      tipo: 'preventiva',
      fornecedor: l.oficina,
      valor: l.valor,
      data_realizada: l.data,
      km_realizada: l.km,
      proxima_km: (l.km as number) + (intervalo.get(l.veiculo_id as string) ?? INTERVALO_REVISAO_KM_PADRAO),
      prever_proxima: true,
      origem: 'importacao',
      status: 'em_dia',
      observacoes: l.obs,
      pecas_trocadas: l.pecas,
    }))
  )
  if (error) {
    console.error('[revisoes] importação falhou:', error)
    return { error: 'Erro ao importar as revisões. Nada foi gravado.' }
  }

  const c = contar(resultado)
  const avisosIncluidos = incluirAvisos === true ? c.aviso : 0
  await logAudit(
    'revisoes', 'criou', null,
    `Importação de planilha: ${gravar.length} revisões (${avisosIncluidos} avisos incluídos, ${c.erro} erros e ${c.dup} repetidas fora)`
  )
  revalidatePath('/sofia/revisoes')
  revalidatePath('/sofia/revisoes/historico')
  revalidatePath('/sofia')
  return { importadas: gravar.length, avisosIncluidos, erros: c.erro, repetidas: c.dup }
}

/** Intervalo próprio de revisão do veículo (ficha). Vazio = padrão de 10.000 km. Só gestor/admin. */
export async function definirIntervaloRevisaoAction(_prev: State, formData: FormData): Promise<State> {
  const id = formData.get('veiculo_id') as string
  if (!id) return { error: 'ID inválido' }
  const supabase = await createClient()
  const negado = await requireGestorFrotas(supabase)
  if (negado) return { error: negado }

  const valor = inteiro(formData.get('intervalo_revisao_km'))
  if (valor != null && (Number.isNaN(valor) || valor < 1000 || valor > 100000)) {
    return { error: 'Informe um intervalo entre 1.000 e 100.000 km, ou deixe vazio para usar o padrão (10.000 km).' }
  }

  const { error } = await supabase.from('veiculos').update({ intervalo_revisao_km: valor }).eq('id', id)
  if (error) return { error: 'Erro ao salvar o intervalo de revisão' }
  await logAudit(
    'veiculos', 'atualizou', id,
    `Intervalo de revisão: ${valor == null ? `padrão (${formatarKm(INTERVALO_REVISAO_KM_PADRAO)} km)` : `${formatarKm(valor)} km`}`
  )
  revalidatePath('/sofia/revisoes')
  revalidatePath(`/sofia/veiculos/${id}`)
  return { success: true }
}

export async function excluirRevisaoAction(_prev: State, formData: FormData): Promise<State> {
  const id = formData.get('id') as string
  if (!id) return { error: 'ID inválido' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email || !(await podeGerirFrotas(supabase)))
    return { error: 'Apenas administradores ou gestores de frotas podem excluir revisões' }

  const { error } = await supabase.from('revisoes').delete().eq('id', id)
  if (error) return { error: 'Erro ao excluir revisão' }
  revalidatePath('/sofia/revisoes')
  revalidatePath('/sofia/revisoes/historico')
  return { success: true }
}
