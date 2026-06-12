import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { logoutAction } from './actions'
import Logo from '@/components/ui/Logo'

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

      <div className="max-w-7xl mx-auto px-6 py-16 text-center">
        <h1 className="text-3xl font-bold text-white mb-3">
          Olá, {firstName}! 👋
        </h1>
        <p className="text-[#94a3b8] text-lg mb-8">
          Bem-vindo ao painel de operações da Manfac Facilities.
        </p>
        <div className="inline-block px-6 py-3 rounded-lg bg-[#0d2050] border border-[#1e3a5f] text-[#4a6080] text-sm">
          Dashboard operacional — em desenvolvimento
        </div>
      </div>
    </main>
  )
}
