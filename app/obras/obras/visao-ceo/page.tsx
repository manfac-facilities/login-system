import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/server'
import { hojeISO } from '../../_lib/tipos'
import { lerCarteira } from '../_lib/carteira-leitura'
import { podeVerVisaoCeo } from './_permissao'
import TelaVisaoCeo from './_tela'

export const dynamic = 'force-dynamic'

function Aviso({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="rounded-xl border border-dashed border-(--obra-border) bg-(--obra-card) px-6 py-10 text-center text-[15px] text-(--obra-muted-texto)">
        {children}
      </div>
    </div>
  )
}

/** Visão do CEO: carteira das obras OBRA, só leitura. Tudo com o cliente da SESSÃO. */
export default async function VisaoCeoPage() {
  const supabase = await createClient()
  if (!(await podeVerVisaoCeo(supabase))) return <Aviso>Esta tela é da administração</Aviso>

  const hoje = hojeISO()
  const r = await lerCarteira(supabase, hoje)
  if (!r.ok) return <Aviso>Não deu para ler as obras agora. Recarregue em instantes.</Aviso>
  return <TelaVisaoCeo obras={r.obras} hoje={hoje} lidoEm={new Date().toISOString()} />
}
