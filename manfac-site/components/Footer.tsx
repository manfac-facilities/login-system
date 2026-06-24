import Image from 'next/image'

export default function Footer() {
  return (
    <footer className="border-t border-[var(--border)] bg-[var(--surface)]">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-[var(--muted)] md:flex-row">
        <Image src="/logo.png" alt="Manfac Engenharia" width={121} height={33} />
        <p>© {new Date().getFullYear()} Manfac Engenharia. Todos os direitos reservados.</p>
      </div>
    </footer>
  )
}
