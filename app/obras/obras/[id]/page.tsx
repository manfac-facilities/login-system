import { createClient } from '@/lib/supabase/server'
import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { isAdmin } from '@/lib/auth/roles'
import type { ReactNode } from 'react'
import { hojeISO } from '../../_lib/tipos'
import { lerObraDaRequisicao } from './_obra-da-requisicao'
import { lerPlanos, lerRestricoes } from '../_lib/leitura'
import { calcularAlertas } from '../_lib/alertas'
import { lerAgenda } from '../_lib/envios-agenda'
import { dadosPpc } from './lookahead/_plano-tipos'
import { ultimosDiariosEnviados } from '../_lib/ultimo-diario'
import PainelObra, { type EstadoDiario } from '../_ui/painel'
import FaixaAlertas from '../_ui/faixa-alertas'

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

  const [rdoR, envioR, planosR, restR, agenda] = await Promise.all([
    supabase.from('obras_rdo').select('estado').eq('obra_id', id).eq('data', hoje).maybeSingle(),
    ultimosDiariosEnviados(supabase, [id]),
    lerPlanos(supabase, id),
    lerRestricoes(supabase, id),
    lerAgenda(supabase, id, r.dados, hoje),
  ])
  if (rdoR.error || envioR.error) {
    return <EstadoVazio>Não deu para carregar o diário da obra. Recarregue a página em alguns instantes.</EstadoVazio>
  }
  const estado = (rdoR.data?.estado as EstadoDiario | undefined) ?? 'nao_iniciado'
  const ultimoEnvio = envioR.ultimo.get(id) ?? null
  // Alertas (Leva 3 §2.4): leitura que falhou não vira alerta falso — a agenda (null) só some os alertas de comunicação.
  const alertas = calcularAlertas({
    obraId: id,
    hoje,
    calc: r.dados.calc,
    agenda,
    restricoes: restR.ok ? restR.restricoes : [],
  })

  return (
    <div className="flex flex-col gap-4 lg:gap-5">
      <div className="flex justify-end">
        {/* Compras é outra app: <a> comum, nunca next/link. Pedir não mostra valores — qualquer usuário do Obras. */}
        <a
          href={`/compras/solicitacoes/nova?obra=${id}`}
          className="inline-flex min-h-11 items-center rounded-lg border border-(--obra-border) bg-white px-3 text-sm font-medium text-(--obra-ink) hover:border-(--obra-orange-texto)"
        >
          Pedir material
        </a>
      </div>
      <FaixaAlertas alertas={alertas} />
      <PainelObra
        dados={r.dados}
        hoje={hoje}
        estadoDiario={estado}
        ultimoEnvio={ultimoEnvio}
        ppcSemanas={planosR.ok ? dadosPpc(planosR.planos) : []}
      />
    </div>
  )
}
