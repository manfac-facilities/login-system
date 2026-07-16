'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { NAV_ITEMS } from '@/lib/content'
import { isNavActive } from '@/lib/nav'

const SERVICOS_DROPDOWN = [
  { href: '/servicos/obras-e-reformas', label: 'Obras e Reformas Corporativas' },
  { href: '/servicos/novas-construcoes', label: 'Novas Construções' },
  { href: '/servicos/manutencao-predial', label: 'Manutenção Predial' },
  { href: '/servicos/hvac', label: 'Sistemas de Climatização (HVAC)' },
]

export default function Header() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [servOpen, setServOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--background)]/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="shrink-0" onClick={() => setOpen(false)}>
          <Image src="/logo.png" alt="Manfac Engenharia" width={154} height={42} priority />
        </Link>

        <nav className="hidden gap-8 text-sm text-[var(--muted)] md:flex">
          {NAV_ITEMS.map((item) => {
            const active = isNavActive(pathname, item.href)

            if (item.href === '/servicos') {
              return (
                <div
                  key={item.href}
                  className="group relative"
                  onMouseEnter={() => setServOpen(true)}
                  onMouseLeave={() => setServOpen(false)}
                >
                  <Link
                    href={item.href}
                    className={`relative flex items-center gap-1 pb-1 transition-colors hover:text-[var(--ink)] ${
                      active ? 'text-[var(--ink)]' : ''
                    }`}
                  >
                    {item.label}
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 12 12"
                      fill="none"
                      className={`transition-transform duration-200 ${servOpen ? 'rotate-180' : ''}`}
                    >
                      <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {active && (
                      <span className="absolute -bottom-1 left-0 h-px w-full bg-[var(--orange)]" />
                    )}
                  </Link>

                  {/* Dropdown */}
                  <div
                    className={`absolute left-1/2 top-full -translate-x-1/2 pt-3 transition-all duration-200 ${
                      servOpen ? 'pointer-events-auto opacity-100 translate-y-0' : 'pointer-events-none opacity-0 -translate-y-1'
                    }`}
                  >
                    <div className="min-w-56 rounded-xl border border-[var(--border)] bg-[var(--background)] shadow-lg">
                      <div className="p-1">
                        {SERVICOS_DROPDOWN.map((sub) => (
                          <Link
                            key={sub.href}
                            href={sub.href}
                            onClick={() => setServOpen(false)}
                            className="block rounded-lg px-4 py-2.5 text-sm text-[var(--muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--ink)]"
                          >
                            {sub.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative pb-1 transition-colors hover:text-[var(--ink)] ${
                  active ? 'text-[var(--ink)]' : ''
                }`}
              >
                {item.label}
                {active && (
                  <span className="absolute -bottom-1 left-0 h-px w-full bg-[var(--orange)]" />
                )}
              </Link>
            )
          })}
        </nav>

        <Link
          href="/contato"
          className="hidden rounded-md bg-[var(--orange)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--orange-hover)] md:inline-block"
        >
          Falar com especialista
        </Link>

        <button
          type="button"
          aria-label="Abrir menu"
          aria-expanded={open}
          className="text-[var(--ink)] md:hidden"
          onClick={() => setOpen((v) => !v)}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {open ? (
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <nav className="flex flex-col gap-1 border-t border-[var(--border)] px-6 py-4 text-sm md:hidden">
          {NAV_ITEMS.map((item) => (
            <div key={item.href}>
              <Link
                href={item.href}
                className="block rounded px-2 py-2 text-[var(--ink)] hover:bg-[var(--surface)]"
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
              {item.href === '/servicos' && (
                <div className="ml-4 mt-1 flex flex-col gap-1 border-l border-[var(--border)] pl-3">
                  {SERVICOS_DROPDOWN.map((sub) => (
                    <Link
                      key={sub.href}
                      href={sub.href}
                      onClick={() => setOpen(false)}
                      className="block rounded px-2 py-1.5 text-xs text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--ink)]"
                    >
                      {sub.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
      )}
    </header>
  )
}
