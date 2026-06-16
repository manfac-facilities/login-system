import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { logoutAction } from './actions'
import Logo from '@/components/ui/Logo'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const fullName = user.user_metadata?.full_name as string | undefined
  const firstName = fullName?.trim().split(/\s+/)[0] ?? 'Colaborador'

  return (
    <main className="min-h-screen" style={{ backgroundColor: 'var(--background)' }}>
      <header className="border-b border-[#1e3a5f] bg-[#0d2050]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Logo size="sm" />
          <div className="flex items-center gap-4">
            <span className="text-sm text-[#94a3b8]">{user.email}</span>
            <form action={logoutAction}>
              <button
                type="submit"
                className="text-sm text-[#94a3b8] hover:text-white transition-colors px-3 py-1.5 rounded border border-[#1e3a5f] hover:border-[#f05a28]"
              >
                Sair
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-white mb-3">
            Olá, {firstName}!
          </h1>
          <p className="text-[#94a3b8] text-lg">
            Bem-vindo ao Hub Manfac Facilities.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
          <Link
            href="/sofia"
            className="flex items-start gap-4 p-6 rounded-xl border border-[#1e3a5f] bg-[#0d2050] hover:border-[#f05a28] transition-colors group"
          >
            <span className="text-3xl">🚐</span>
            <div>
              <p className="text-white font-semibold group-hover:text-[#f05a28] transition-colors">
                Sistema Sofia
              </p>
              <p className="text-[#4a6080] text-sm mt-1">
                Operação de frota — KM, checklist, multas
              </p>
            </div>
          </Link>
          <div className="flex items-start gap-4 p-6 rounded-xl border border-dashed border-[#1e3a5f] opacity-40 cursor-not-allowed">
            <span className="text-3xl">📋</span>
            <div>
              <p className="text-white font-semibold">Em breve</p>
              <p className="text-[#4a6080] text-sm mt-1">Próximos módulos</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
