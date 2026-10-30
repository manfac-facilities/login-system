export const MARGEM_AVISO_KM = 1000

export type RevisaoSituacao = 'em_dia' | 'vence_em_breve' | 'atrasada'
export type RevisaoMotivo = 'data' | 'km'

export interface RevisaoClassificacao {
  situacao: RevisaoSituacao
  // Motivos que fazem a revisão estar atrasada. Vazio quando não está atrasada.
  motivos: RevisaoMotivo[]
  // Quantos km passaram do previsto (0 no limite). Só quando os motivos incluem 'km'.
  kmPassados: number | null
  // Quantos km faltam. Só quando vence_em_breve.
  kmRestantes: number | null
}

// `hoje` no formato YYYY-MM-DD. Por km, vence na igualdade (km_atual >= proxima_km).
export function classificarRevisao(
  r: { proxima_data: string | null; proxima_km: number | null },
  kmAtual: number | null | undefined,
  hoje: string
): RevisaoClassificacao {
  const motivos: RevisaoMotivo[] = []
  let kmPassados: number | null = null
  let kmRestantes: number | null = null

  if (r.proxima_data != null && r.proxima_data < hoje) motivos.push('data')
  if (r.proxima_km != null && kmAtual != null) {
    if (kmAtual >= r.proxima_km) {
      motivos.push('km')
      kmPassados = kmAtual - r.proxima_km
    } else if (r.proxima_km - kmAtual <= MARGEM_AVISO_KM) {
      kmRestantes = r.proxima_km - kmAtual
    }
  }

  const situacao: RevisaoSituacao =
    motivos.length > 0 ? 'atrasada' : kmRestantes != null ? 'vence_em_breve' : 'em_dia'
  return { situacao, motivos, kmPassados, kmRestantes }
}

export type RevisaoTom = 'verde' | 'ambar' | 'vermelho' | 'neutro'

export interface RevisaoSituacaoView {
  label: string
  tom: Exclude<RevisaoTom, 'neutro'>
  // Linhas de apoio: "faltam X km", "passou X km", "venceu há N dias".
  dicas: { texto: string; tom: RevisaoTom }[]
}

export const formatarKm = (n: number) => n.toLocaleString('pt-BR')

export function formatarDataIso(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

// Textos da situação como aprovados no mockup de 26/10/2026 (seção 1).
export function situacaoRevisaoView(
  r: { proxima_data: string | null; proxima_km: number | null },
  kmAtual: number | null | undefined,
  hoje: string
): RevisaoSituacaoView {
  const c = classificarRevisao(r, kmAtual, hoje)
  const porKm = c.motivos.includes('km')
  const porData = c.motivos.includes('data')

  let label = 'Em dia'
  let tom: RevisaoSituacaoView['tom'] = 'verde'
  if (porKm && porData) { label = 'Atrasada por KM e data'; tom = 'vermelho' }
  else if (porKm) { label = 'Atrasada por KM'; tom = 'vermelho' }
  else if (porData) { label = 'Atrasada por data'; tom = 'vermelho' }
  else if (c.situacao === 'vence_em_breve') { label = 'Vence em breve'; tom = 'ambar' }

  const dicas: RevisaoSituacaoView['dicas'] = []
  if (porKm) {
    dicas.push({ texto: `passou ${formatarKm(c.kmPassados ?? 0)} km`, tom: 'vermelho' })
  } else if (r.proxima_km != null && kmAtual != null) {
    dicas.push({
      texto: `faltam ${formatarKm(r.proxima_km - kmAtual)} km`,
      tom: c.situacao === 'vence_em_breve' ? 'ambar' : 'neutro',
    })
  }
  if (porData && r.proxima_data) {
    const dias = Math.round((Date.parse(hoje) - Date.parse(r.proxima_data)) / 86400000)
    dicas.push({ texto: `venceu há ${dias} ${dias === 1 ? 'dia' : 'dias'}`, tom: 'vermelho' })
  }
  return { label, tom, dicas }
}
