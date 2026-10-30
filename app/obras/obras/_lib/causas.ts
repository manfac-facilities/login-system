/** Causas do não cumprido/não avançou e o responsável de cada uma (módulo folha, sem dependências de leitura). */
import type { Responsavel } from './cronograma'

export type CausaRdo = 'cliente' | 'material' | 'equipe' | 'clima' | 'projeto' | 'outro'

/** Rótulo da causa e responsável (spec §5.3: cada causa mapeada para um responsável; mapa confirmado pelo José em 31/10; outro sem responsável). */
export const CAUSA: Record<CausaRdo, { rotulo: string; resp: Responsavel | null }> = {
  cliente: { rotulo: 'Cliente / loja', resp: 'cliente' },
  material: { rotulo: 'Material', resp: 'manfac' },
  equipe: { rotulo: 'Equipe', resp: 'manfac' },
  clima: { rotulo: 'Clima', resp: 'clima' },
  projeto: { rotulo: 'Projeto', resp: 'cliente' },
  outro: { rotulo: 'Outro', resp: null },
}
