interface AutomaticInputs {
  multas: { id: string; status: string; autorizacao_assinada: boolean; data: string; descricao: string }[]
  sinistros: { id: string; status: string; data: string; descricao: string }[]
  revisoesAtrasadas: { id: string; proxima_data: string | null }[]
  documentosVencendo: { id: string; tipo: string; vencimento: string }[]
  termosNaoAssinados: { id: string; nome: string }[]
}

export interface PendenciaAutomatica {
  descricao: string
  origem: 'multa' | 'sinistro' | 'manutencao' | 'documento' | 'termo'
  prazo: string | null
}

export function mapAutomaticPendencias(inputs: AutomaticInputs): PendenciaAutomatica[] {
  const result: PendenciaAutomatica[] = []

  for (const m of inputs.multas) {
    if (m.status !== 'descontada') {
      result.push({ descricao: `Multa sem tratativa: ${m.descricao}`, origem: 'multa', prazo: m.data })
    }
  }
  for (const s of inputs.sinistros) {
    if (s.status !== 'encerrado') {
      result.push({ descricao: `Sinistro sem encerramento: ${s.descricao}`, origem: 'sinistro', prazo: s.data })
    }
  }
  for (const r of inputs.revisoesAtrasadas) {
    result.push({ descricao: 'Manutenção atrasada', origem: 'manutencao', prazo: r.proxima_data })
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
  const urgenciaAlta = abertas.filter((p) => !!p.prazo && p.prazo < hoje).length
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
