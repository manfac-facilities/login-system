import Link from 'next/link'
import type { Alerta } from '../_lib/alertas'
import { IconeAlerta } from './icones'

/** Faixa de alertas no topo do painel da obra (Leva 3 §2.4). Some quando não há nada valendo. */
export default function FaixaAlertas({ alertas }: { alertas: Alerta[] }) {
  if (!alertas.length) return null
  return (
    <section aria-label="Alertas da obra" className="flex flex-col gap-2">
      {alertas.map((a) => (
        <div
          key={a.id}
          className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-2 text-[14px] text-(--obra-text) ${
            a.tom === 'negativo' ? 'border-[#f0c2c2] bg-[#fdeeee]' : 'border-[#efd77a] bg-[#fdf6d8]'
          }`}
        >
          <p className="flex items-start gap-2">
            <span className={`mt-0.5 ${a.tom === 'negativo' ? 'text-(--obra-vermelho-texto)' : 'text-(--obra-yellow-texto)'}`}>
              <IconeAlerta tamanho={16} />
            </span>
            <span>{a.texto}</span>
          </p>
          <Link
            href={a.acao.href}
            className="inline-flex min-h-11 items-center text-[14px] font-medium text-(--obra-ink) underline underline-offset-2"
          >
            {a.acao.rotulo}
          </Link>
        </div>
      ))}
    </section>
  )
}
