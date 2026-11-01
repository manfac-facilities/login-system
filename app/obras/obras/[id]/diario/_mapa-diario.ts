/**
 * Leva 6: o que o passo Fotos do diário recebe do mapa (puro, testável).
 * Obra sem ambiente → null (diário de sempre, ambiente não obrigatório).
 */
import { fotosDoPonto, type FotoMapa } from '../../_lib/mapa'
import type { MapaDaObra } from '../../_lib/mapa-leitura'
import type { MapaDiario } from './_tipos'

/**
 * Pontos ativos da ronda, com a referência de ângulo = última foto do ponto em
 * dia ANTERIOR ao do diário. Devolve também os caminhos que precisam de URL assinada.
 */
export function montarMapaDiario(p: {
  mapa: MapaDaObra
  fotos: FotoMapa[]
  data: string
  atividades: { numero: number; descricao: string }[]
  urls?: Map<string, string>
}): { mapa: MapaDiario; caminhos: string[] } | null {
  if (!p.mapa.ambientes.length) return null
  const ativos = p.mapa.pontos.filter((x) => x.ativo)
  const referencia = new Map<string, FotoMapa>()
  for (const ponto of ativos) {
    const antes = fotosDoPonto(ponto.id, p.fotos).filter((f) => f.data < p.data)
    if (antes.length) referencia.set(ponto.id, antes[antes.length - 1])
  }
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
