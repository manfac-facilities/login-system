/**
 * Identidade Manfac do módulo OBRAS (spec Leva 1 §4) — as mesmas cores de
 * `obras.css`, como constantes para SVG e `style` (Gantt, curva S, anéis).
 *
 * Contraste: as cores da marca (`orange`, `verde`, `vermelho`, `muted`) não
 * passam 4.5:1 como TEXTO pequeno sobre branco. Para texto use as variantes
 * `*Texto` (medidas ≥ 4.5:1 sobre `card` e `surface`); a cor cheia fica para
 * preenchimento, barra, ícone e borda (≥ 3:1).
 */
export const TEMA_OBRA = {
  ink: '#00345e',
  orange: '#f85e0b',
  orangeTexto: '#c44a08',
  yellow: '#f7cb15',
  yellowTexto: '#7a5c00',
  surface: '#f6f6f5',
  card: '#ffffff',
  border: '#dadad8',
  text: '#333336',
  muted: '#6e8894',
  mutedTexto: '#5a7380',
  /** A "foto" da base: sempre contorno/tracejado, nunca cor cheia. */
  base: '#9aa9b2',
  verde: '#1f9d55',
  verdeTexto: '#136c38',
  vermelho: '#d64545',
  vermelhoTexto: '#b23232',
  neutroTexto: '#4f5b62',
  trilho: '#e9e9e7',
} as const

export type TomObra = 'neutro' | 'positivo' | 'atencao' | 'negativo' | 'destaque'

/** Cor de texto (acessível) e de preenchimento por tom. */
export const COR_TOM: Record<TomObra, { texto: string; cheio: string }> = {
  neutro: { texto: TEMA_OBRA.ink, cheio: TEMA_OBRA.ink },
  positivo: { texto: TEMA_OBRA.verdeTexto, cheio: TEMA_OBRA.verde },
  atencao: { texto: TEMA_OBRA.yellowTexto, cheio: TEMA_OBRA.yellow },
  negativo: { texto: TEMA_OBRA.vermelhoTexto, cheio: TEMA_OBRA.vermelho },
  destaque: { texto: TEMA_OBRA.orangeTexto, cheio: TEMA_OBRA.orange },
}
