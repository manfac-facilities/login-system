import Link from 'next/link'
import BlueprintSection from '../BlueprintSection'

export default function QuemSomosTeaser() {
  return (
    <BlueprintSection index="02" label="Quem somos">
      <h2 className="max-w-2xl text-2xl font-semibold leading-snug text-[var(--ink)] md:text-3xl">
        A Manfac é uma empresa de Engenharia especializada na gestão e execução de obras,
        reformas e manutenção predial para grandes operações.
      </h2>
      <Link
        href="/quem-somos"
        className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-[var(--orange)] hover:text-[var(--orange-hover)]"
      >
        Saiba mais sobre a Manfac →
      </Link>
    </BlueprintSection>
  )
}
