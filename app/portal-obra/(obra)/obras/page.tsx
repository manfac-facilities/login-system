import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { lerSessao } from '@/lib/portal-obra/sessao'
import { createAdminClient } from '@/lib/supabase/admin'

/** Provisório (Leva 5, Task 2): a Task 4 substitui por "Minhas obras". Lista só as obras da sessão. */
export default async function MinhasObrasProvisorio() {
  const sessao = await lerSessao(await cookies())
  if (!sessao) redirect('/portal-obra')
  const { data, error } = await createAdminClient().from('obras_obra').select('id, loja, descricao').in('id', sessao.obras)
  if (error) {
    return (
      <main className="mx-auto max-w-xl px-4 py-10">
        <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          Não foi possível carregar suas obras agora. Tente novamente em alguns minutos.
        </p>
      </main>
    )
  }
  const obras = (data ?? []) as { id: string; loja: string | null; descricao: string | null }[]
  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <h1 className="text-2xl font-bold">Suas obras</h1>
      <ul className="mt-6 flex flex-col gap-2">
        {obras.map((o) => <li key={o.id} className="rounded-lg border border-slate-300 px-4 py-3">{o.loja || o.descricao || 'Obra'}</li>)}
      </ul>
      <form action="/portal-obra/sair" method="post" className="mt-8">
        <button type="submit" className="min-h-[44px] rounded-lg border border-slate-400 px-4 py-2 text-sm font-medium">Sair</button>
      </form>
    </main>
  )
}
