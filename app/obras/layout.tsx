import { Suspense } from 'react'
import Link from 'next/link'
import AbasObras from './_ui/abas-obras'
import FaixaComunicadosServidor from './_ui/faixa-comunicados-servidor'

/**
 * Esqueleto do módulo Controle de Obras.
 *
 * As abas são as do mockup aprovado (`shellHTML`, mockup-obras.html:2415),
 * na ordem: Diário do dia, Tarefas, Base de obras, Painel gerencial (em
 * `_ui/abas-obras.tsx`). A Ficha da obra NÃO é aba — abre a partir de qualquer
 * uma e volta para a origem. A Triagem também não: é o modo da Ficha quando a
 * etapa é "definir".
 *
 * O layout é Server Component: só as abas são cliente (usePathname). A faixa de
 * comunicados é buscada aqui no servidor, dentro de um Suspense sem fallback,
 * para não atrasar a página.
 *
 * Tema: hex literal em classe Tailwind arbitrária, como no resto do hub. Não
 * existe tailwind.config neste projeto (Tailwind v4 por @import em globals.css).
 */

export default function ObrasLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--background)' }}>
      <header className="border-b border-[#1e3a5f] bg-[#0d2050]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <Link
            href="/dashboard"
            className="text-[#94a3b8] text-sm hover:text-white transition-colors whitespace-nowrap"
          >
            ← Voltar ao Hub
          </Link>
          <span className="text-white text-sm font-semibold">Gestão de Obras</span>
        </div>
        <AbasObras />
      </header>
      <Suspense fallback={null}>
        <FaixaComunicadosServidor />
      </Suspense>
      <main>{children}</main>
    </div>
  )
}
