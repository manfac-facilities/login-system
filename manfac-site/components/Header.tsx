import Image from 'next/image'

const links = [
  { href: '#servicos', label: 'Serviços' },
  { href: '#abordagem', label: 'Como atuamos' },
  { href: '#case', label: 'Resultados' },
  { href: '#contato', label: 'Contato' },
]

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--background)]/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Image src="/logo-white.png" alt="Manfac Engenharia" width={154} height={42} priority />
        <nav className="hidden gap-8 text-sm text-[var(--muted)] md:flex">
          {links.map((link) => (
            <a key={link.href} href={link.href} className="transition-colors hover:text-white">
              {link.label}
            </a>
          ))}
        </nav>
        <a
          href="#contato"
          className="rounded-md bg-[var(--orange)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--orange-hover)]"
        >
          Fale com a gente
        </a>
      </div>
    </header>
  )
}
