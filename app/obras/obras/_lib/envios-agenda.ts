/**
 * Envios que contam para a agenda (Leva 4 §2.2): só os do lado CLIENTE com ao
 * menos um destinatário aceito (envio interno ou que falhou por completo, com
 * `destinatarios = {}`, não conta — mesma regra do `ultimosDiariosEnviados`).
 *
 * Referência de cada tipo: diário = `obras_envio.referencia` (date); semanal =
 * `obras_semanal.semana_inicio` via `semanal_id`; mensal/fase/entrega =
 * `obras_relatorio.referencia` via `relatorio_id` (a coluna do envio é date e
 * não serve a esses tipos). Sem o vínculo resolvido, o envio é ignorado.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { agendaDaObra, cobrarDesdeDe, type EnvioAgenda, type ItemAgenda } from './agenda'
import { etapasDaObra } from './relatorio-periodo'
import type { ObraGrande } from './leitura'

export type EnvioBruto = {
  tipo: string | null
  referencia: string | null
  lado: string | null
  destinatarios: string[] | null
  enviadoEm: string
  semanalId: string | null
  relatorioId: string | null
}

export function enviosDaAgenda(
  brutos: EnvioBruto[],
  semanais: ReadonlyMap<string, string>,
  relatorios: ReadonlyMap<string, string>,
): EnvioAgenda[] {
  const out: EnvioAgenda[] = []
  for (const e of brutos) {
    if (e.lado !== 'cliente' || !e.destinatarios?.length || !e.tipo) continue
    let referencia: string | null | undefined
    if (e.tipo === 'diario') referencia = e.referencia
    else if (e.tipo === 'semanal') referencia = e.semanalId ? semanais.get(e.semanalId) : null
    else if (e.tipo === 'mensal' || e.tipo === 'fase' || e.tipo === 'entrega') referencia = e.relatorioId ? relatorios.get(e.relatorioId) : null
    else continue
    if (referencia) out.push({ tipo: e.tipo, referencia, enviadoEm: e.enviadoEm })
  }
  return out
}

type Linha = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

/**
 * Agenda da obra para o painel e a aba Agenda. Dado opcional: se a leitura dos
 * envios falhar devolve null (quem chama não mostra a agenda nem os alertas
 * de comunicação, em vez de alertar em falso). Tabelas de vínculo que falham
 * só deixam sem efeito os envios daquele tipo (nunca derrubam a tela).
 */
export async function lerAgenda(
  supabase: SupabaseClient,
  obraId: string,
  og: ObraGrande,
  hoje: string,
): Promise<ItemAgenda[] | null> {
  const [envR, semR, relR] = await Promise.all([
    supabase
      .from('obras_envio')
      .select('tipo, referencia, lado, destinatarios, enviado_em, semanal_id, relatorio_id')
      .eq('obra_id', obraId)
      .eq('lado', 'cliente'),
    supabase.from('obras_semanal').select('id, semana_inicio').eq('obra_id', obraId),
    supabase.from('obras_relatorio').select('id, referencia').eq('obra_id', obraId),
  ])
  if (envR.error) return null
  const mapa = (r: { error: unknown; data: unknown }, ref: string) =>
    new Map<string, string>((r.error ? [] : ((r.data ?? []) as Linha[])).map((x) => [String(x.id), String(x[ref])]))
  const envios = enviosDaAgenda(
    ((envR.data ?? []) as Linha[]).map((e) => ({
      tipo: e.tipo ?? null,
      referencia: e.referencia ?? null,
      lado: e.lado ?? null,
      destinatarios: e.destinatarios ?? [],
      enviadoEm: String(e.enviado_em),
      semanalId: e.semanal_id ?? null,
      relatorioId: e.relatorio_id ?? null,
    })),
    mapa(semR, 'semana_inicio'),
    mapa(relR, 'referencia'),
  )
  const atividades = og.calc?.atividades ?? []
  return agendaDaObra({
    dataBase: og.versaoBase?.salvaEm ? (og.obra.data_base ?? null) : null,
    terminoProjetado: og.calc?.terminoProjetado ?? null,
    obraConcluida: atividades.length > 0 && atividades.every((a) => a.status === 'concluido' && !!a.fimReal),
    etapas: etapasDaObra(og).map((e) => ({ referencia: e.referencia, nome: e.nome, fimPrevisto: e.fimPrevisto, concluida: e.concluida })),
    feriados: og.feriados,
    envios,
    hojeIso: hoje,
    cobrarDesde: cobrarDesdeDe({ dataBase: og.obra.data_base ?? null, salvaEm: og.versaoBase?.salvaEm ?? null, envios, hojeIso: hoje }),
  })
}
