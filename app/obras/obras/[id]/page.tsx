import { createClient } from '@/lib/supabase/server'
import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { isAdmin } from '@/lib/auth/roles'
import type { ReactNode } from 'react'
import { hojeISO } from '../../_lib/tipos'
import { lerObraDaRequisicao } from './_obra-da-requisicao'
import { lerPlanos, lerRestricoes } from '../_lib/leitura'
import { calcularAlertas } from '../_lib/alertas'
import { segundaDaSemana } from '../_lib/last-planner'
import { dadosPpc } from './lookahead/_plano-tipos'
import { ultimosDiariosEnviados } from '../_lib/ultimo-diario'
import PainelObra, { type EstadoDiario } from '../_ui/painel'
import FaixaAlertas from '../_ui/faixa-alertas'
import { somarDias } from './lookahead/_plano-tipos'

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

  const [rdoR, envioR, planosR, restR, semR] = await Promise.all([
    supabase.from('obras_rdo').select('estado').eq('obra_id', id).eq('data', hoje).maybeSingle(),
    ultimosDiariosEnviados(supabase, [id]),
    lerPlanos(supabase, id),
    lerRestricoes(supabase, id),
    supabase
      .from('obras_semanal')
      .select('semana_inicio, estado')
      .eq('obra_id', id)
      .gte('semana_inicio', somarDias(segundaDaSemana(hoje), -7)),
  ])
  if (rdoR.error || envioR.error) {
    return <EstadoVazio>Não deu para carregar o diário da obra. Recarregue a página em alguns instantes.</EstadoVazio>
  }
  const estado = (rdoR.data?.estado as EstadoDiario | undefined) ?? 'nao_iniciado'
  const ultimoEnvio = envioR.ultimo.get(id) ?? null
  // Alertas (Leva 3 §2.4): leitura que falhou não vira alerta falso — some só aquele alerta.
  const alertas = calcularAlertas({
    obraId: id,
    hoje,
    calc: r.dados.calc,
    baseSalva: !!r.dados.versaoBase?.salvaEm,
    dataBase: r.dados.obra.data_base ?? null,
    feriados: r.dados.feriados,
    ultimoDiarioEnviado: ultimoEnvio,
    semanais: ((semR.data ?? []) as { semana_inicio: string; estado: string }[]).map((x) => ({
      semanaInicio: x.semana_inicio,
      estado: x.estado,
    })),
    restricoes: restR.ok ? restR.restricoes : [],
  }).filter((a) => !(a.id === 'semanal' && semR.error))

  return (
    <div className="flex flex-col gap-4 lg:gap-5">
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
