/**
 * Leva 6: o que o passo Fotos do diário recebe do mapa (puro, testável).
 * Obra sem ambiente → null (diário de sempre, ambiente não obrigatório).
 */
import type { FotoMapa } from '../../_lib/mapa'
import type { MapaDaObra } from '../../_lib/mapa-leitura'
import type { MapaDiario } from './_tipos'

/**
 * Pontos ativos da ronda, com a referência de ângulo = última foto do ponto em
 * dia ANTERIOR ao do diário (`lerReferenciasDosPontos`, uma por ponto).
 * Devolve também os caminhos que precisam de URL assinada.
 */
export function montarMapaDiario(p: {
  mapa: MapaDaObra
  /** pontoId → última foto anterior ao dia do diário. */
  referencias: Map<string, FotoMapa>
  atividades: { numero: number; descricao: string }[]
  urls?: Map<string, string>
}): { mapa: MapaDiario; caminhos: string[] } | null {
  if (!p.mapa.ambientes.length) return null
  const ativos = p.mapa.pontos.filter((x) => x.ativo)
  const referencia = new Map(ativos.flatMap((x) => (p.referencias.has(x.id) ? [[x.id, p.referencias.get(x.id)!] as const] : [])))
  return {
    caminhos: [...referencia.values()].map((f) => f.path),
    mapa: {
      ambientes: p.mapa.ambientes.map((a) => ({
        id: a.id,
        nome: a.nome,
        atividades: p.mapa.vinculos.filter((v) => v.ambienteId === a.id).map((v) => v.atividadeNumero),
      })),
      pontos: ativos.map((x) => {
        const ref = referencia.get(x.id)
        return {
          id: x.id,
          numero: x.numero,
          nome: x.nome,
          ambienteId: x.ambienteId,
          referenciaUrl: ref ? p.urls?.get(ref.path) ?? null : null,
          referenciaData: ref?.data ?? null,
        }
      }),
      atividades: p.atividades,
    },
  }
}
