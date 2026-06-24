import BlueprintSection from './BlueprintSection'
import { PILARES } from '@/lib/content'

export default function QuemSomos() {
  return (
    <BlueprintSection index="02" label="Quem somos">
      <div className="grid gap-12 md:grid-cols-2 md:items-start">
        <div>
          <h2 className="text-2xl font-semibold leading-snug text-[var(--ink)] md:text-3xl">
            A Manfac é uma empresa de Engenharia especializada na gestão e execução de obras,
            reformas e manutenção predial para grandes operações.
          </h2>
          <p className="mt-4 text-[var(--muted)]">
            Nosso compromisso é impulsionar o sucesso dos nossos clientes através de operações
            mais organizadas, eficientes e transparentes.
          </p>
        </div>
        <div className="space-y-6">
          {PILARES.map((pilar) => (
            <div key={pilar.title} className="rounded-lg border-l-2 border-[var(--orange)] bg-[var(--surface)] p-6">
              <h3 className="font-semibold text-[var(--ink)]">{pilar.title}</h3>
              <p className="mt-2 text-sm text-[var(--muted)]">{pilar.description}</p>
            </div>
          ))}
        </div>
      </div>
    </BlueprintSection>
  )
}
