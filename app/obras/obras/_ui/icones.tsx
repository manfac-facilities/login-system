import type { ReactNode, SVGProps } from 'react'

/**
 * Ícones de traço do módulo OBRAS (desenho no estilo Lucide, 24×24, traço 1.75).
 * SVG inline porque o projeto não tem `lucide-react` — e nunca emoji (spec §4).
 * Decorativos por padrão (`aria-hidden`): o texto ao lado é quem dá o sentido.
 */
type Props = SVGProps<SVGSVGElement> & { tamanho?: number }

function Base({ tamanho = 18, children, ...resto }: Props & { children: ReactNode }) {
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...resto}
    >
      {children}
    </svg>
  )
}

export const IconePainel = (p: Props) => (
  <Base {...p}>
    <rect x="3" y="3" width="7" height="9" rx="1.5" />
    <rect x="14" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="12" width="7" height="9" rx="1.5" />
    <rect x="3" y="16" width="7" height="5" rx="1.5" />
  </Base>
)

export const IconeCronograma = (p: Props) => (
  <Base {...p}>
    <path d="M3 4v16h18" />
    <path d="M7 8h6" />
    <path d="M10 12h7" />
    <path d="M13 16h5" />
  </Base>
)

export const IconeDiario = (p: Props) => (
  <Base {...p}>
    <rect x="5" y="3" width="14" height="18" rx="2" />
    <path d="M9 3v3h6V3" />
    <path d="M9 11h6" />
    <path d="M9 15h4" />
  </Base>
)

export const IconeImpedimento = (p: Props) => (
  <Base {...p}>
    <path d="M8.2 2.5h7.6l5.7 5.7v7.6l-5.7 5.7H8.2l-5.7-5.7V8.2z" />
    <path d="M12 8v4.5" />
    <path d="M12 16h.01" />
  </Base>
)

export const IconeComunicacao = (p: Props) => (
  <Base {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3.5 6.5 8.5 6 8.5-6" />
  </Base>
)

export const IconeLookahead = (p: Props) => (
  <Base {...p}>
    <rect x="3" y="4" width="18" height="17" rx="2" />
    <path d="M3 9h18" />
    <path d="M8 2.5v3M16 2.5v3" />
    <path d="M7 14h10" />
  </Base>
)

export const IconeDocumentos = (p: Props) => (
  <Base {...p}>
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </Base>
)

export const IconeMais = (p: Props) => (
  <Base {...p}>
    <circle cx="5" cy="12" r="1" />
    <circle cx="12" cy="12" r="1" />
    <circle cx="19" cy="12" r="1" />
  </Base>
)

export const IconeVoltar = (p: Props) => (
  <Base {...p}>
    <path d="M19 12H5" />
    <path d="m11 18-6-6 6-6" />
  </Base>
)

export const IconeTrocar = (p: Props) => (
  <Base {...p}>
    <path d="m7 9 5-5 5 5" />
    <path d="m7 15 5 5 5-5" />
  </Base>
)

export const IconeCheck = (p: Props) => (
  <Base {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Base>
)

export const IconeAlerta = (p: Props) => (
  <Base {...p}>
    <path d="M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
  </Base>
)

export const IconeRelogio = (p: Props) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Base>
)

export const IconeCadeado = (p: Props) => (
  <Base {...p}>
    <rect x="4.5" y="11" width="15" height="10" rx="2" />
    <path d="M8 11V7.5a4 4 0 0 1 8 0V11" />
  </Base>
)

export const IconeAmpulheta = (p: Props) => (
  <Base {...p}>
    <path d="M6 2.5h12M6 21.5h12" />
    <path d="M7 2.5c0 5 10 5 10 9.5s-10 4.5-10 9.5" />
    <path d="M17 2.5c0 5-10 5-10 9.5s10 4.5 10 9.5" />
  </Base>
)

export const IconePlay = (p: Props) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m10 8.5 5 3.5-5 3.5z" />
  </Base>
)

export const IconeCirculoTracejado = (p: Props) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9" strokeDasharray="3.2 3.2" />
  </Base>
)

export const IconeCalendario = (p: Props) => (
  <Base {...p}>
    <rect x="3" y="4" width="18" height="17" rx="2" />
    <path d="M3 9h18" />
    <path d="M8 2.5v3M16 2.5v3" />
  </Base>
)

export const IconeCamadas = (p: Props) => (
  <Base {...p}>
    <path d="m12 3 9 5-9 5-9-5z" />
    <path d="m3 13 9 5 9-5" />
  </Base>
)
