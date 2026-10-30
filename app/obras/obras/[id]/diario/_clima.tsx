'use client'

import type { ReactNode } from 'react'
import type { Clima, RascunhoRdo } from './_tipos'

const OPCOES: { valor: Clima; rotulo: string; icone: ReactNode }[] = [
  {
    valor: 'sol',
    rotulo: 'Sol',
    icone: <path d="M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm0-5v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M19 5l-2 2M7 17l-2 2" />,
  },
  { valor: 'nublado', rotulo: 'Nublado', icone: <path d="M7 18a4 4 0 0 1-.5-7.97A6 6 0 0 1 18 9.5 4.25 4.25 0 0 1 17.5 18H7Z" /> },
  {
    valor: 'chuva',
    rotulo: 'Chuva',
    icone: <path d="M7 14a4 4 0 0 1-.5-7.97A6 6 0 0 1 18 5.5 4.25 4.25 0 0 1 17.5 14H7Zm1 3-1 3m5-3-1 3m5-3-1 3" />,
  },
  {
    valor: 'impraticavel',
    rotulo: 'Impraticável',
    icone: <path d="M7 13a4 4 0 0 1-.5-7.97A6 6 0 0 1 18 4.5 4.25 4.25 0 0 1 17.5 13H7Zm5 1-2.5 4h4L11 22" />,
  },
]

/** Clima da manhã e da tarde: dois grupos de chips (ícone SVG + texto, nunca só cor). */
export function ClimaTurnos({
  corpo,
  mudar,
  somenteLeitura,
}: {
  corpo: Pick<RascunhoRdo, 'climaManha' | 'climaTarde'>
  mudar: (p: Partial<RascunhoRdo>) => void
  somenteLeitura: boolean
}) {
  const turnos = [
    { nome: 'Manhã', campo: 'climaManha' as const },
    { nome: 'Tarde', campo: 'climaTarde' as const },
  ]
  return (
    <div className="flex flex-col gap-2">
      {turnos.map((t) => (
        <div key={t.campo} role="group" aria-label={`Clima da ${t.nome.toLowerCase()}`}>
          <p className="mb-1 text-xs font-semibold text-[#5a7380]">{t.nome}</p>
          <div className="flex flex-wrap gap-2">
            {OPCOES.map((o) => {
              const ativo = corpo[t.campo] === o.valor
              return (
                <button
                  key={o.valor}
                  type="button"
                  aria-pressed={ativo}
                  disabled={somenteLeitura}
                  onClick={() => mudar({ [t.campo]: ativo ? null : o.valor })}
                  className={
                    'inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-sm transition disabled:opacity-45 ' +
                    (ativo
                      ? 'border-[#00345e] bg-[#00345e] font-semibold text-white'
                      : 'border-[#dadad8] bg-white text-[#333336] hover:border-[#00345e]')
                  }
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    {o.icone}
                  </svg>
                  {o.rotulo}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
