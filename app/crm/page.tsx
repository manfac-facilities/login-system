import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hasSystemAccess } from '@/lib/auth/systemAccess'
import LeadsTable from './_table'
import type { Lead } from '@/lib/leads/formato'

const LIMITE = 200

// force-dynamic: lead novo tem que aparecer na hora; página estática
// mostraria a lista do momento do build.
export const dynamic = 'force-dynamic'

export default async function CrmPage() {
  // Defesa em profundidade: createAdminClient() ignora RLS e site_leads não
  // tem policy nenhuma — o middleware é hoje a única barreira, e a doc deste
  // Next classifica checagem de middleware/proxy como "optimistic"
  // (node_modules/next/dist/docs/01-app/02-guides/authentication.md),
  // mandando repetir a checagem real perto do dado. Sem isto, qualquer bug
  // ou reordenação futura no middleware expõe nome/telefone/e-mail de
  // cliente direto.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }
  if (!(await hasSystemAccess(supabase, user.email ?? '', 'crm'))) {
    redirect('/dashboard')
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('site_leads')
    .select('*')
    .order('criado_em', { ascending: false })
    .limit(LIMITE)

  if (error) {
    console.error('[crm] falha ao ler site_leads:', error.message)
  }

  const leads = (data ?? []) as Lead[]
  const truncado = !error && leads.length === LIMITE

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-bold text-white">Leads do site</h1>
      <p className="mt-1 text-sm text-[#94a3b8]">
        Quem preencheu o formulário em manfac.com.br, do mais recente para o mais antigo.
      </p>
      <div className="mt-8">
        {error ? (
          // Estado distinto do vazio, de propósito: um erro de leitura não
          // pode virar "nenhum lead chegou ainda" — isso afirmaria um fato
          // falso e faria o comercial parar de olhar a tela justo quando
          // ela mais importa.
          <p className="text-[#f05a28]">
            Não foi possível carregar os leads agora. Recarregue a página em alguns minutos; se persistir, avise o time técnico.
          </p>
        ) : (
          <LeadsTable leads={leads} />
        )}
      </div>
      {truncado && (
        <p className="mt-4 text-xs text-[#94a3b8]">
          Mostrando os {LIMITE} leads mais recentes.
        </p>
      )}
    </div>
  )
}
