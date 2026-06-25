export function validateKmAtual(km: number): string | null {
  if (km === null || km === undefined || Number.isNaN(km)) return 'KM atual é obrigatório'
  if (km < 0) return 'KM atual não pode ser negativo'
  return null
}
