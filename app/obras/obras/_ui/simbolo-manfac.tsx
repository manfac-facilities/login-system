import { TEMA_OBRA } from './tema'

/**
 * Símbolo isolado da Manfac (arco + losango), redesenhado em SVG a partir de
 * `public/logo.png` (medido pixel a pixel; conferido lado a lado com o PNG) —
 * não há arquivo vetorial oficial no repositório. Se aparecer, troque por ele.
 *
 * Geometria (viewBox 256×232, centro 128,132): anel r116 com vão r62, "pílula"
 * interna r28 que desce até o losango; a cunha a 45° com vértice logo acima do
 * losango corta o anel e a pílula; losango laranja de meia-diagonal 40.
 *
 * `cor` pinta os arcos (azul da marca em fundo claro; branco na sidebar azul).
 */
export default function SimboloManfac({
  tamanho = 32,
  cor = TEMA_OBRA.ink,
  titulo,
  className,
}: {
  /** Altura em px. */
  tamanho?: number
  cor?: string
  /** Sem título o símbolo é decorativo (aria-hidden). */
  titulo?: string
  className?: string
}) {
  return (
    <svg
      width={Math.round((tamanho * 256) / 232)}
      height={tamanho}
      viewBox="0 0 256 232"
      className={className}
      role={titulo ? 'img' : undefined}
      aria-label={titulo}
      aria-hidden={titulo ? undefined : true}
      focusable="false"
    >
      <defs>
        {/* Geometria idêntica em toda instância, então o id repetido é inofensivo. */}
        <clipPath id="manfac-simbolo-corte">
          <path d="M0 0H256V232H226L128 134L30 232H0Z" />
        </clipPath>
      </defs>
      <g fill={cor} clipPath="url(#manfac-simbolo-corte)">
        <path
          fillRule="evenodd"
          d="M12 132a116 116 0 1 0 232 0a116 116 0 1 0 -232 0ZM66 132a62 62 0 1 0 124 0a62 62 0 1 0 -124 0Z"
        />
        <path d="M100 232V132a28 28 0 0 1 56 0V232Z" />
      </g>
      <path d="M128 140L168 180L128 220L88 180Z" fill={TEMA_OBRA.orange} />
    </svg>
  )
}
