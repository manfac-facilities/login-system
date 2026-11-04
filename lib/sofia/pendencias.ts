import { formatarKm, formatarDataIso } from './revisaoStatus'
import type { MultaEtapa } from './multaEtapas'

interface AutomaticInputs {
  multas: MultaPendenciaInput[]
  sinistros: { id: string; status: string; data: string; descricao: string }[]
  revisoesAtrasadas: { id: string; placa: string | null; proxima_data: string | null; proxima_km: number | null; km_passados: number | null; motivo?: 'data' | 'km' }[]
  documentosVencendo: { id: string; tipo: string; vencimento: string }[]
  termosNaoAssinados: { id: string; nome: string }[]
}

export interface MultaPendenciaInput {
  id: string
  etapa: MultaEtapa
  prazo_indicacao: string | null
  placa: string | null
  tipo_infracao: string | null
  descricao: string | null
}

export type GrupoPendencia = 'a_fazer' | 'aguardando_terceiros'

export interface PendenciaAutomatica {
  descricao: string
  origem: 'multa' | 'sinistro' | 'manutencao' | 'documento' | 'termo'
  prazo: string | null
  // KM previsto, para pendência de revisão atrasada só por KM (não tem prazo em data).
  prazoKm?: number
  // Multa: 'aguardando_terceiros' (pedido/autorizado) não conta como atrasada (spec 2026-11-03 §2.11).
  grupo?: GrupoPendencia
}

/**
 * Pendência de uma multa pela etapa atual (textos do mockup, spec §2.11).
 * Reusada pelo e-mail diário. descontada/contestada → null (não aparece).
 */
export function pendenciaDaMulta(m: MultaPendenciaInput): PendenciaAutomatica | null {
  const placa = m.placa?.trim() || 'veículo sem placa'
  const tipo = m.tipo_infracao?.trim() ? m.tipo_infracao.trim().toLowerCase() : m.descricao?.trim() || 'sem detalhes adicionais'
  const base = `${placa}, ${tipo}`
  const prazo = m.prazo_indicacao ?? null
  const aFazer = (descricao: string, comPrazo: boolean): PendenciaAutomatica => ({
    descricao,
    origem: 'multa',
    prazo: comPrazo ? prazo : null,
    grupo: 'a_fazer',
  })
  switch (m.etapa) {
    case 'registrada':
      return aFazer(`Confirmar o condutor: ${base}`, true)
    case 'condutor':
      return aFazer(`Aguardando aceite do termo pelo motorista: ${base}`, true)
    case 'termo':
      return aFazer(
        prazo ? `Indicar o condutor ao órgão até ${formatarDataIso(prazo)}: ${base}` : `Indicar o condutor ao órgão: ${base}`,
        true
      )
    case 'indicado':
      return aFazer(`Aguardando validação do gestor da equipe: ${base}`, false)
    case 'validada':
      return aFazer(`Lançar o boleto da locadora: ${base}`, false)
    case 'cobrada':
      return aFazer(`Solicitar o desconto: ${base}`, false)
    case 'solicitado':
      return {
        descricao: `Multa enviada para desconto, aguardando autorização: ${base}`,
        origem: 'multa',
        prazo: null,
        grupo: 'aguardando_terceiros',
      }
    case 'autorizado':
      return {
        descricao: `Desconto autorizado, aguardando o RH descontar em folha: ${base}`,
        origem: 'multa',
        prazo: null,
        grupo: 'aguardando_terceiros',
      }
    default:
      return null
  }
}

export function mapAutomaticPendencias(inputs: AutomaticInputs): PendenciaAutomatica[] {
  const result: PendenciaAutomatica[] = []

  for (const m of inputs.multas) {
    const p = pendenciaDaMulta(m)
    if (p) result.push(p)
  }
  for (const s of inputs.sinistros) {
    if (s.status !== 'encerrado') {
      result.push({ descricao: `Sinistro sem encerramento: ${s.descricao}`, origem: 'sinistro', prazo: s.data })
    }
  }
  for (const r of inputs.revisoesAtrasadas) {
    const placa = r.placa ?? 'veículo sem placa'
    if (r.motivo === 'km') {
      result.push({
        descricao: `Manutenção atrasada por KM: ${placa} — passou ${formatarKm(r.km_passados ?? 0)} km do previsto`,
        origem: 'manutencao',
        prazo: r.proxima_data,
        prazoKm: r.proxima_km ?? undefined,
      })
    } else {
      result.push({
        descricao: `Manutenção atrasada por data: ${placa} — prevista para ${r.proxima_data ? formatarDataIso(r.proxima_data) : 'data não informada'}`,
        origem: 'manutencao',
        prazo: r.proxima_data,
      })
    }
  }
  for (const d of inputs.documentosVencendo) {
    result.push({ descricao: `Documento (${d.tipo}) vencendo`, origem: 'documento', prazo: d.vencimento })
  }
  for (const t of inputs.termosNaoAssinados) {
    result.push({ descricao: `Termo de uso não assinado: ${t.nome}`, origem: 'termo', prazo: null })
  }

  return result
}

interface PendenciaKpiRow {
  prazo: string | null
  // Presente só em revisão atrasada por KM: já está vencida, conta como urgência alta.
  prazoKm?: number
  status: string
  updated_at: string
}

export interface KpisPendencias {
  totalPendente: number
  urgenciaAlta: number
  aguardandoTerceiros: number
  resolvidosHoje: number
  eficiencia: number
}

export function calcularKpisPendencias(todas: PendenciaKpiRow[], hoje: string): KpisPendencias {
  const abertas = todas.filter((p) => p.status !== 'concluida')
  const urgenciaAlta = abertas.filter((p) => p.prazoKm != null || (!!p.prazo && p.prazo < hoje)).length
  const aguardandoTerceiros = abertas.filter((p) => p.status === 'em_andamento').length
  const resolvidosHoje = todas.filter((p) => p.status === 'concluida' && p.updated_at.startsWith(hoje)).length
  const denom = resolvidosHoje + abertas.length
  const eficiencia = denom === 0 ? 0 : Math.round((resolvidosHoje / denom) * 100)

  return { totalPendente: abertas.length, urgenciaAlta, aguardandoTerceiros, resolvidosHoje, eficiencia }
}

export interface GargaloCategoria {
  origem: string
  count: number
  pct: number
}

export function agruparGargalos(todas: { origem: string }[]): GargaloCategoria[] {
  if (todas.length === 0) return []
  const counts = new Map<string, number>()
  for (const p of todas) counts.set(p.origem, (counts.get(p.origem) ?? 0) + 1)
  return Array.from(counts.entries())
    .map(([origem, count]) => ({ origem, count, pct: Math.round((count / todas.length) * 100) }))
    .sort((a, b) => b.count - a.count)
}
