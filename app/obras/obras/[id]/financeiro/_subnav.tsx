import Link from 'next/link'

type Aba = 'resumo' | 'medicoes' | 'locacoes'

/**
 * Sub-navegação do Financeiro da obra: Resumo · Medições · Locações. Resumo e Medições só
 * para quem vê valores (`valores`); Locações para todo usuário do Obras (sem R$ para os demais).
 */
export default function SubnavFinanceiro({ obraId, atual, valores }: { obraId: string; atual: Aba; valores: boolean }) {
  const raiz = `/obras/obras/${obraId}/financeiro`
  const abas: { id: Aba; rotulo: string; href: string }[] = [
    ...(valores
      ? [
          { id: 'resumo' as const, rotulo: 'Resumo', href: raiz },
          { id: 'medicoes' as const, rotulo: 'Medições ao cliente', href: `${raiz}/medicoes` },
        ]
      : []),
    { id: 'locacoes', rotulo: 'Locações', href: `${raiz}/locacoes` },
  ]
  return (
    <nav aria-label="Seções do Financeiro" className="flex flex-wrap gap-2">
      {abas.map((a) => (
        <Link
          key={a.id}
          href={a.href}
          aria-current={a.id === atual ? 'page' : undefined}
          className={`inline-flex min-h-11 items-center rounded-lg border px-4 text-sm font-medium ${
            a.id === atual
              ? 'border-(--obra-ink) bg-(--obra-ink) text-white'
              : 'border-(--obra-border) bg-white text-(--obra-ink) hover:border-(--obra-orange-texto)'
          }`}
        >
          {a.rotulo}
        </Link>
      ))}
    </nav>
  )
}
