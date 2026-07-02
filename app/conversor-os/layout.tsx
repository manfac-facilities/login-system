import Link from 'next/link'

export default function ConversorOsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--background)' }}>
      <header className="border-b border-[#1e3a5f] bg-[#0d2050] px-6 py-4">
        <Link href="/dashboard" className="text-[#94a3b8] text-sm hover:text-white transition-colors">
          ← Voltar ao Hub
        </Link>
      </header>
      <main>{children}</main>
    </div>
  )
}
