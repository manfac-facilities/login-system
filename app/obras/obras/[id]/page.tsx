import { createClient } from '@/lib/supabase/server'
import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { isAdmin } from '@/lib/auth/roles'
import type { ReactNode } from 'react'
import { hojeISO } from '../../_lib/tipos'
import { lerObraDaRequisicao } from './_obra-da-requisicao'
import { lerPlanos } from '../_lib/leitura'
import { dadosPpc } from './lookahead/_plano-tipos'
import { ultimosDiariosEnviados } from '../_lib/ultimo-diario'
import PainelObra, { type EstadoDiario } from '../_ui/painel'

export const dynamic = 'force-dynamic'

/** Aviso no tema claro do módulo (dentro do shell da obra). */
function EstadoVazio({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-(--obra-border) bg-(--obra-card) px-6 py-10 text-center text-[15px] text-(--obra-muted-texto)">
      {children}
    </div>
  )
}

export default async function PainelDaObraPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const permitido =
    !!user?.email &&
    ((await hasSystemAccess(supabase, user.email, 'obras')) || (await isAdmin(supabase, user.email)))
  if (!permitido) {
    return <EstadoVazio>Esta tela é de quem é responsável pelas obras</EstadoVazio>
  }

  const hoje = hojeISO()
  const r = await lerObraDaRequisicao(id, hoje)
  if (!r.ok) return <EstadoVazio>{r.erro}</EstadoVazio>

  const [rdoR, envioR, planosR] = await Promise.all([
    supabase.from('obras_rdo').select('estado').eq('obra_id', id).eq('data', hoje).maybeSingle(),
    ultimosDiariosEnviados(supabase, [id]),
    lerPlanos(supabase, id),
  ])
  if (rdoR.error || envioR.error) {
    return <EstadoVazio>Não deu para carregar o diário da obra. Recarregue a página em alguns instantes.</EstadoVazio>
  }
  const estado = (rdoR.data?.estado as EstadoDiario | undefined) ?? 'nao_iniciado'

  return (
    <PainelObra
      dados={r.dados}
      hoje={hoje}
      estadoDiario={estado}
      ultimoEnvio={envioR.ultimo.get(id) ?? null}
      ppcSemanas={planosR.ok ? dadosPpc(planosR.planos) : []}
    />
  )
}
