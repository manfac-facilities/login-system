import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Manfac — Página da obra',
  robots: { index: false, follow: false },
}

/** Portal do cliente: fora do middleware do hub, guarda própria (lib/portal-obra). Tema claro. */
export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-white text-slate-900">{children}</div>
}
