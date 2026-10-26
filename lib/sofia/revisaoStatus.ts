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
