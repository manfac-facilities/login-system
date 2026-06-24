'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

export interface NavItem {
  label: string
  href: string
}

export interface NavSection {
  title: string
  items: NavItem[]
}

export const navSections: NavSection[] = [
  {
    title: 'Operação',
    items: [
      { label: 'Visão Geral', href: '/sofia' },
      { label: 'Equipes', href: '/sofia/equipes' },
      { label: 'Veículos', href: '/sofia/veiculos' },
      { label: 'Motoristas', href: '/sofia/motoristas' },
      { label: 'KM Diário', href: '/sofia/km' },
      { label: 'Checklist', href: '/sofia/checklist' },
    ],
  },
  {
    title: 'Ocorrências',
    items: [
      { label: 'Multas', href: '/sofia/multas' },
      { label: 'Sinistros', href: '/sofia/sinistros' },
    ],
  },
  {
    title: 'Manutenção & Documentos',
    items: [
      { label: 'Revisões', href: '/sofia/revisoes' },
      { label: 'Documentos', href: '/sofia/documentos' },
      { label: 'Abastecimento', href: '/sofia/abastecimento' },
    ],
  },
  {
    title: 'Gestão',
    items: [
      { label: 'Custos', href: '/sofia/custos' },
      { label: 'Disponibilidade', href: '/sofia/disponibilidade' },
      { label: 'Pendências', href: '/sofia/pendencias' },
    ],
  },
]

export const detailRoutes = [
  '/sofia/veiculos/[id]',
  '/sofia/motoristas/[id]',
  '/sofia/sinistros/[id]',
]

export function Sidebar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <>
      <div className="no-print md:hidden w-full flex items-center justify-between bg-[#0d2050] border-b border-[#1e3a5f] px-4 py-3 sticky top-0 z-30">
        <span className="text-white font-bold text-lg">GF</span>
        <button
          onClick={() => setOpen(true)}
          aria-label="Abrir menu"
          className="p-2 rounded-lg border border-[#1e3a5f] text-[#94a3b8]"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 5h14M3 10h14M3 15h14" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {open && (
        <div
          className="no-print md:hidden fixed inset-0 bg-black/60 z-40"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={`no-print fixed md:static inset-y-0 left-0 z-50 w-64 shrink-0 bg-[#0d2050] border-r border-[#1e3a5f] min-h-screen p-4 overflow-y-auto transition-transform duration-200 ease-in-out ${
          open ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0`}
      >
        <div className="flex items-center justify-between mb-6 px-2">
          <span className="text-white font-bold text-lg">Gestão de Frotas</span>
          <button
            onClick={() => setOpen(false)}
            aria-label="Fechar menu"
            className="md:hidden text-[#94a3b8] text-xl leading-none"
          >
            ×
          </button>
        </div>
        {navSections.map((section) => (
          <div key={section.title} className="mb-6">
            <div className="text-[#4a6080] text-xs uppercase tracking-wide font-semibold px-2 mb-2">
              {section.title}
            </div>
            {section.items.map((item) => {
              const isActive =
                item.href === '/sofia'
                  ? pathname === '/sofia'
                  : pathname === item.href || pathname.startsWith(item.href + '/')
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`block px-2 py-2 rounded text-sm mb-1 ${
                    isActive
                      ? 'bg-[#f05a28] text-white'
                      : 'text-[#94a3b8] hover:bg-[#1e3a5f] hover:text-white'
                  }`}
                >
                  {item.label}
                </Link>
              )
            })}
          </div>
        ))}
      </aside>
    </>
  )
}

export default Sidebar
