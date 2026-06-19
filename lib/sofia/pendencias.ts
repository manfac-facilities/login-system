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
