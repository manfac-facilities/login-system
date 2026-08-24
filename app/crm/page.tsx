import { createAdminClient } from '@/lib/supabase/admin'
import LeadsTable from './_table'
import type { Lead } from '@/lib/leads/formato'

// force-dynamic: lead novo tem que aparecer na hora; página estática
// mostraria a lista do momento do build.
export const dynamic = 'force-dynamic'

export default async function CrmPage() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('site_leads')
    .select('*')
    .order('criado_em', { ascending: false })
    .limit(200)

  if (error) {
    console.error('[crm] falha ao ler site_leads:', error.message)
  }

  return (
    <main className="min-h-screen bg-[#0a1628] px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-bold text-white">Leads do site</h1>
        <p className="mt-1 text-sm text-[#94a3b8]">
          Quem preencheu o formulário em manfac.com.br, do mais recente para o mais antigo.
        </p>
        <div className="mt-8">
          <LeadsTable leads={(data ?? []) as Lead[]} />
        </div>
      </div>
    </main>
  )
}
