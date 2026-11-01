import type { ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { IBM_Plex_Mono } from 'next/font/google'
import '@/app/obras/obras/obras.css'
import { sessaoAtual } from './_lib/guarda'

/**
 * Casca do portal do cliente (Leva 5 §3.2): tema claro Manfac (os mesmos tokens
 * `--obra-*` do módulo), faixa azul com a marca, o e-mail da sessão e "Sair".
 * NÃO é guarda: cada página chama `exigirSessao`/`exigirObra` (o layout não
 * re-renderiza na navegação). Aqui a sessão só serve para mostrar o e-mail.
 */
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-plex-mono', display: 'swap' })

export default async function PortalObraLayout({ children }: { children: ReactNode }) {
  const sessao = await sessaoAtual()
  return (
    <div className={`obra-tema ${plexMono.variable}`}>
      <header className="bg-(--obra-ink) text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-2 sm:px-6">
          <Link href="/portal-obra/obras" className="flex min-h-11 items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-white">
            <Image src="/logo-white.png" alt="Manfac" width={106} height={29} priority />
            <span className="text-[14px] font-semibold tracking-wide text-white/90">Página da obra</span>
          </Link>
          {sessao ? (
            <div className="flex min-w-0 items-center gap-4 text-[14px]">
              <span className="hidden truncate text-white/85 sm:inline">{sessao.email}</span>
              <form action="/portal-obra/sair" method="post">
                <button type="submit" className="min-h-11 px-1 text-white underline underline-offset-2 hover:text-[#ffd9c4]">
                  Sair
                </button>
              </form>
            </div>
          ) : null}
        </div>
      </header>
      {children}
    </div>
  )
}
