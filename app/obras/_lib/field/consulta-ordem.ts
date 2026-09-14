/**
 * Consulta isolada da situação de uma ordem antiga no Field.
 *
 * A semântica de `archived` em `GET /orders/:id` ainda não foi provada com uma
 * ordem arquivada real. Por isso só booleano explícito decide; formato ausente
 * ou falha ficam inconclusivos e nunca autorizam herança de histórico.
 */

import type { HttpField } from './http'

export type SituacaoDaOrdemField = 'ativa' | 'arquivada' | 'inconclusiva'

export type ConsultaDaOrdemField = {
  situacao: SituacaoDaOrdemField
  motivo?: string
}

type OrdemConsultada = {
  archived?: boolean | null
}

export async function consultarSituacaoDaOrdemField(
  http: HttpField,
  idField: string,
): Promise<ConsultaDaOrdemField> {
  try {
    const ordem = await http.get<OrdemConsultada>(`/orders/${encodeURIComponent(idField)}`)
    if (ordem?.archived === true) return { situacao: 'arquivada' }
    if (ordem?.archived === false) return { situacao: 'ativa' }
    return {
      situacao: 'inconclusiva',
      motivo: 'a resposta da ordem antiga não informou archived como booleano',
    }
  } catch (erro) {
    return {
      situacao: 'inconclusiva',
      motivo: erro instanceof Error ? erro.message : 'falha desconhecida ao consultar a ordem antiga',
    }
  }
}
