/**
 * Revisão a cada 10 mil km — regra pura (sem banco, sem Date() sem `hoje`).
 * Spec: docs/superpowers/specs/2026-11-03-frotas-manutencao-e-bases-design.md §1.1.
 *
 * Vigente do carro = maior `km_realizada` (qualquer tipo); empate por `data_realizada`,
 * depois `created_at`. Nunca "a criada por último": histórico importado depois não vira vigente.
 */
import { MARGEM_AVISO_KM, formatarDataIso, formatarKm } from './revisaoStatus'

export const INTERVALO_REVISAO_KM_PADRAO = 10000

export interface RevisaoPrev {
  id: string
  veiculo_id: string
  tipo: string
  km_realizada: number | null
  data_realizada: string | null
  created_at: string
  proxima_km: number | null
  proxima_data: string | null
  prever_proxima: boolean
}

export interface VeiculoPrev {
  id: string
  placa: string
  modelo: string
  km_atual: number
  status: string
  intervalo_revisao_km: number | null
}

export interface LancamentoKmPrev {
  data: string
  km_atual: number
}

export type SituacaoCarro = 'atrasada' | 'breve' | 'dia' | 'semprev' | 'sembase'

export interface ClassificacaoCarro {
  s: SituacaoCarro
  vigente: RevisaoPrev | null
  /** próxima KM efetiva (null = sem previsão por KM) */
  proxima: number | null
  /** próxima calculada sozinha (km + intervalo) */
  auto: boolean
  falta: number | null
  passou: number | null
  media: number | null
  dias: number | null
  /** AAAA-MM-DD estimado pela média */
  quando: string | null
  porData: boolean
}

export type ItemFrota<V extends VeiculoPrev = VeiculoPrev> = ClassificacaoCarro & { veiculo: V }

export function intervaloDoVeiculo(v: { intervalo_revisao_km?: number | null }): number {
  return v.intervalo_revisao_km ?? INTERVALO_REVISAO_KM_PADRAO
}

const desc = (a: string | number | null, b: string | number | null): number => {
  if (a === b) return 0
  if (a === null) return 1
  if (b === null) return -1
  return a < b ? 1 : -1
}

export function revisaoVigente<R extends RevisaoPrev>(revs: R[]): R | null {
  if (revs.length === 0) return null
  return [...revs].sort(
    (a, b) =>
      desc(a.km_realizada == null ? null : Number(a.km_realizada), b.km_realizada == null ? null : Number(b.km_realizada)) ||
      desc(a.data_realizada, b.data_realizada) ||
      desc(a.created_at, b.created_at)
  )[0]
}

export function proximaEfetiva(rev: RevisaoPrev, intervalo: number): { km: number | null; auto: boolean } {
  if (!rev.prever_proxima) return { km: null, auto: false }
  const feita = rev.km_realizada == null ? null : Number(rev.km_realizada)
  if (rev.proxima_km != null) {
    const p = Number(rev.proxima_km)
    return { km: p, auto: feita != null && p === feita + intervalo }
  }
  if (feita != null) return { km: feita + intervalo, auto: true }
  return { km: null, auto: false }
}

const DIA = 86400000
const utc = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10))
export function somarDias(d: string, n: number): string {
  return new Date(utc(d) + n * DIA).toISOString().slice(0, 10)
}
const diasEntre = (de: string, ate: string) => Math.round((utc(ate) - utc(de)) / DIA)

/** Média km/dia dos lançamentos dos últimos 30 dias; < 2 dias distintos ou ≤ 0 → null. */
export function mediaKmDia(lancamentos: LancamentoKmPrev[], hoje: string): number | null {
  const limite = somarDias(hoje, -30)
  const recentes = lancamentos.filter((l) => l.data.slice(0, 10) >= limite && l.data.slice(0, 10) <= hoje)
  const dias = [...new Set(recentes.map((l) => l.data.slice(0, 10)))].sort()
  if (dias.length < 2) return null
  const kms = recentes.map((l) => Number(l.km_atual))
  const media = (Math.max(...kms) - Math.min(...kms)) / diasEntre(dias[0], dias[dias.length - 1])
  return media > 0 ? media : null
}

export function classificarCarro(
  veiculo: VeiculoPrev,
  revisoesDoCarro: RevisaoPrev[],
  lancamentosKm: LancamentoKmPrev[],
  hoje: string
): ClassificacaoCarro {
  const media = mediaKmDia(lancamentosKm, hoje)
  const base: ClassificacaoCarro = {
    s: 'sembase', vigente: null, proxima: null, auto: false, falta: null, passou: null, media, dias: null, quando: null, porData: false,
  }
  const vigente = revisaoVigente(revisoesDoCarro)
  if (!vigente) return base
  if (!vigente.prever_proxima) return { ...base, s: 'semprev', vigente }

  const { km: proxima, auto } = proximaEfetiva(vigente, intervaloDoVeiculo(veiculo))
  const proxData = vigente.proxima_data ? vigente.proxima_data.slice(0, 10) : null
  if (proxima == null && proxData == null) return { ...base, s: 'semprev', vigente }

  const kmAtual = Number(veiculo.km_atual)
  const porKm = proxima != null && kmAtual >= proxima
  const porData = proxData != null && proxData < hoje
  const comum = { ...base, vigente, proxima, auto, porData }
  if (porKm || porData) return { ...comum, s: 'atrasada', passou: porKm ? kmAtual - (proxima as number) : null }

  const falta = proxima == null ? null : proxima - kmAtual
  const s: SituacaoCarro = falta != null && falta <= MARGEM_AVISO_KM ? 'breve' : 'dia'
  const dias = falta != null && media != null ? Math.ceil(falta / media) : null
  return { ...comum, s, falta, dias, quando: dias == null ? null : somarDias(hoje, dias) }
}

const ORDEM: Record<SituacaoCarro, number> = { atrasada: 0, breve: 1, dia: 2, semprev: 3, sembase: 4 }

/** Um item por veículo não inativo, do mais urgente ao menos (e por falta). */
export function classificarFrota<V extends VeiculoPrev>(
  veiculos: V[],
  revisoes: RevisaoPrev[],
  lancamentos: (LancamentoKmPrev & { veiculo_id: string })[],
  hoje: string
): ItemFrota<V>[] {
  const revPor = new Map<string, RevisaoPrev[]>()
  for (const r of revisoes) revPor.set(r.veiculo_id, [...(revPor.get(r.veiculo_id) ?? []), r])
  const kmPor = new Map<string, LancamentoKmPrev[]>()
  for (const l of lancamentos) kmPor.set(l.veiculo_id, [...(kmPor.get(l.veiculo_id) ?? []), l])
  return veiculos
    .filter((v) => v.status !== 'inativo')
    .map((v) => ({ ...classificarCarro(v, revPor.get(v.id) ?? [], kmPor.get(v.id) ?? [], hoje), veiculo: v }))
    .sort((a, b) => ORDEM[a.s] - ORDEM[b.s] || (a.falta ?? 0) - (b.falta ?? 0))
}

export function contarCartoes(lista: ClassificacaoCarro[]) {
  return {
    atrasada: lista.filter((x) => x.s === 'atrasada').length,
    breve: lista.filter((x) => x.s === 'breve').length,
    d30: lista.filter((x) => x.s === 'dia' && x.dias != null && x.dias <= 30).length,
    sp: lista.filter((x) => x.s === 'semprev' || x.s === 'sembase').length,
  }
}

/** Textos do bloco 1.1 "O aviso" do mockup. */
export function textoPendencia(item: ItemFrota): { titulo: string; detalhe: string } {
  const titulo = `Revisão — ${item.veiculo.placa} (${item.veiculo.modelo})`
  if (item.s === 'atrasada') {
    if (item.passou != null && item.proxima != null) {
      return { titulo, detalhe: `passou ${formatarKm(item.passou)} km do previsto (${formatarKm(item.proxima)})` }
    }
    const d = item.vigente?.proxima_data
    return { titulo, detalhe: d ? `a data prevista (${formatarDataIso(d.slice(0, 10))}) já passou` : 'passou do previsto' }
  }
  if (item.falta != null && item.proxima != null) {
    const chega = item.dias != null ? ` · chega em ~${item.dias} dia${item.dias === 1 ? '' : 's'}` : ''
    return { titulo, detalhe: `faltam ${formatarKm(item.falta)} km para ${formatarKm(item.proxima)}${chega}` }
  }
  return { titulo, detalhe: '' }
}
