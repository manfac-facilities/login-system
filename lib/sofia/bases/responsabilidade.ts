/**
 * Resolução de equipe/motorista pelo histórico de responsabilidade
 * (`veiculo_responsabilidade_historico`), na data do registro.
 *
 * `atribuir_responsabilidade_veiculo` fecha o trecho anterior com `fim = dia da troca`
 * e abre o novo com `inicio = dia da troca`: no dia da troca os dois casam, e vale o
 * mais recente (maior `inicio`; empate, o criado por último).
 */

export interface TrechoBruto {
  veiculo_id: string
  equipe_id: string | null
  motorista_id: string | null
  inicio: string
  fim: string | null
  created_at: string
}

export function resolverNaData<T extends TrechoBruto>(
  trechos: T[],
  veiculoId: string,
  data: string
): T | null {
  let melhor: T | null = null
  for (const t of trechos) {
    if (t.veiculo_id !== veiculoId) continue
    if (t.inicio > data) continue
    if (t.fim !== null && t.fim < data) continue
    if (
      melhor === null ||
      t.inicio > melhor.inicio ||
      (t.inicio === melhor.inicio && t.created_at > melhor.created_at)
    ) {
      melhor = t
    }
  }
  return melhor
}
