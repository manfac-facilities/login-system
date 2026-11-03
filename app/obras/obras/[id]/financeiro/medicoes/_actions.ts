'use server'

/**
 * Server Actions das medições ao cliente (Fases B/C §2.4). Grava com o cliente da SESSÃO:
 * RLS + trigger `obras_medicao_cliente_guarda` conferem de novo (engenheiro da obra/mãe ou
 * admin, soma ≤ 100%, máquina de estados, nota emitida trava). Sem `export type` aqui.
 */

import { revalidatePath } from 'next/cache'
import { hojeISO } from '../../../../_lib/tipos'
import { lerObraGrande } from '../../../_lib/leitura'
import { erroDoBanco, parAceitavel, receitaEmCentavos, restanteDaOs, textoDeCentavos, textoDeCentesimos } from '../../../_lib/medicao'
import { autorizarOs } from '../_autorizar'
import type { MedicaoEntrada, Resultado, Situacao } from './_tipos'

const falha = (erro: string) => ({ ok: false as const, erro })
const ISO = /^\d{4}-\d{2}-\d{2}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const dataValida = (s: string) => ISO.test(s ?? '') && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s

const rev = (paginaId: string) => {
  revalidatePath(`/obras/obras/${paginaId}/financeiro/medicoes`)
  revalidatePath(`/obras/obras/${paginaId}/financeiro`)
}

/** Avanço físico de hoje da OS (centésimos); null sem cronograma ou se a leitura falhar. */
async function avancoDe(supabase: Parameters<typeof lerObraGrande>[0], osId: string): Promise<number | null> {
  const r = await lerObraGrande(supabase, osId, hojeISO())
  const pct = r.ok ? r.dados.calc?.realizado : undefined
  if (pct === undefined || pct === null || !Number.isFinite(pct)) return null
  return Math.min(10000, Math.max(0, Math.round(pct * 10000)))
}

export async function salvarMedicaoAction(paginaId: string, m: MedicaoEntrada): Promise<Resultado> {
  const auth = await autorizarOs(paginaId, m?.osId, 'registra medição ao cliente')
  if ('ok' in auth) return auth
  const { supabase, os } = auth

  if (!dataValida(m.inicio) || !dataValida(m.fim)) return falha('Informe o período (início e fim)')
  if (m.fim < m.inicio) return falha('O fim do período não pode ser antes do início')
  const receita = receitaEmCentavos(os.valor)
  if (receita === null) return falha('Informe o valor receita desta OS em Dados da obra antes de registrar a medição')
  const pct = m.percentualCentesimos
  const valor = m.valorCentavos
  if (!Number.isInteger(pct) || !Number.isInteger(valor)) return falha('Percentual e valor inválidos')
  if (pct < 1 || pct > 10000) return falha('O % liberado tem de estar entre 0,01% e 100%')
  if (valor <= 0) return falha('O valor liberado tem de ser maior que zero')
  if (os.cancelada) return falha('Esta OS foi cancelada: não recebe medição')

  // Restante da OS (medições não recusadas, menos esta): o banco soma só o %; aqui o R$ também.
  const { data: outras, error: eO } = await supabase
    .from('obras_medicao_cliente')
    .select('id, situacao, percentual_centesimos, valor_centavos')
    .eq('obra_id', os.id)
  if (eO) return falha('Não foi possível ler as medições da OS. Tente de novo.')
  const restante = restanteDaOs(
    receita,
    ((outras ?? []) as Record<string, unknown>[]).map((o) => ({
      id: String(o.id), situacao: String(o.situacao), percentualCentesimos: Number(o.percentual_centesimos), valorCentavos: Number(o.valor_centavos),
    })),
    m.id,
  )
  if (valor > restante.valor) {
    return falha(`O valor passa do restante da OS (R$ ${textoDeCentavos(Math.max(0, restante.valor))}, ${textoDeCentesimos(Math.max(0, restante.pct))}%)`)
  }
  if (!parAceitavel(receita, pct, valor, restante)) return falha('O % e o valor não batem com o valor receita da OS — digite um deles de novo')

  const linha = { periodo_inicio: m.inicio, periodo_fim: m.fim, percentual_centesimos: pct, valor_centavos: valor }
  if (m.id) {
    if (!UUID.test(m.id)) return falha('Medição não encontrada')
    const { data, error } = await supabase.from('obras_medicao_cliente').update(linha).eq('id', m.id).eq('obra_id', os.id).select('id')
    if (error) return falha(erroDoBanco(error, 'Não foi possível salvar a medição. Tente de novo.'))
    if (!data || (data as unknown[]).length === 0) return falha('Medição não encontrada')
  } else {
    const avanco = await avancoDe(supabase, os.id)
    // `numero` é dado pelo banco (max + 1 por OS); o 0 aqui é ignorado pelo trigger.
    const { error } = await supabase
      .from('obras_medicao_cliente')
      .insert({ ...linha, obra_id: os.id, numero: 0, avanco_centesimos: avanco, situacao: 'enviada' })
    if (error) return falha(erroDoBanco(error, 'Não foi possível registrar a medição. Tente de novo.'))
  }
  rev(paginaId)
  return { ok: true }
}

const SITUACOES: readonly Situacao[] = ['enviada', 'aprovada', 'recusada']

export async function mudarSituacaoMedicaoAction(paginaId: string, osId: string, medicaoId: string, situacao: Situacao): Promise<Resultado> {
  const auth = await autorizarOs(paginaId, osId, 'muda a situação da medição')
  if ('ok' in auth) return auth
  if (!SITUACOES.includes(situacao)) return falha('Situação inválida')
  if (!UUID.test(medicaoId ?? '')) return falha('Medição não encontrada')
  const { data, error } = await auth.supabase
    .from('obras_medicao_cliente')
    .update({ situacao })
    .eq('id', medicaoId)
    .eq('obra_id', auth.os.id)
    .select('id')
  if (error) return falha(erroDoBanco(error, 'Não foi possível mudar a situação. Tente de novo.'))
  if (!data || (data as unknown[]).length === 0) return falha('Medição não encontrada')
  rev(paginaId)
  return { ok: true }
}

export async function apagarMedicaoAction(paginaId: string, osId: string, medicaoId: string): Promise<Resultado> {
  const auth = await autorizarOs(paginaId, osId, 'apaga medição')
  if ('ok' in auth) return auth
  if (!auth.admin) return falha('Só administrador apaga medição ao cliente')
  if (!UUID.test(medicaoId ?? '')) return falha('Medição não encontrada')
  const { error } = await auth.supabase.from('obras_medicao_cliente').delete().eq('id', medicaoId).eq('obra_id', auth.os.id)
  if (error) return falha(erroDoBanco(error, 'Não foi possível apagar a medição. Tente de novo.'))
  rev(paginaId)
  return { ok: true }
}
