import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { exigirSessao } from '../_lib/guarda'

export const dynamic = 'force-dynamic'

/**
 * Minhas obras (Leva 5 §3.2): só as obras liberadas na sessão (modalidade OBRA).
 * Uma obra só → direto para ela.
 */
export default async function MinhasObras() {
  const sessao = await exigirSessao()
  const { data, error } = await createAdminClient()
    .from('obras_obra')
    .select('id, os, loja, descricao, modalidade')
    .in('id', sessao.obras)
  if (error) {
    return (
      <main className="mx-auto max-w-xl px-4 py-10">
        <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-[15px] text-red-800">
          Não foi possível carregar suas obras agora. Tente novamente em alguns minutos.
        </p>
      </main>
    )
  }
  const obras = ((data ?? []) as { id: string; os: string | null; loja: string | null; descricao: string | null; modalidade: string }[])
    .filter((o) => sessao.obras.includes(o.id) && o.modalidade === 'obra')
    .map((o) => ({ id: o.id, os: o.os, nome: o.loja?.trim() || o.descricao?.trim() || o.os || 'Obra' }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  if (obras.length === 1) redirect(`/portal-obra/obras/${obras[0].id}`)

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="text-[26px] font-extrabold text-(--obra-ink)">Suas obras</h1>
      {obras.length ? (
        <ul className="mt-6 flex flex-col gap-3">
          {obras.map((o) => (
            <li key={o.id}>
              <Link
                href={`/portal-obra/obras/${o.id}`}
                className="flex min-h-16 items-center justify-between gap-4 rounded-xl border border-(--obra-border) bg-(--obra-card) px-5 py-4 hover:border-(--obra-ink)"
              >
                <span className="min-w-0">
                  {o.os ? <span className="obra-num block text-[13px] text-(--obra-muted-texto)">OS {o.os}</span> : null}
                  <span className="block text-[17px] font-bold text-(--obra-ink)">{o.nome}</span>
                </span>
                <span className="shrink-0 text-[14px] font-semibold text-(--obra-ink) underline underline-offset-2">Abrir</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 text-[15px] text-(--obra-muted-texto)">Nenhuma obra disponível no momento.</p>
      )}
    </main>
  )
}
