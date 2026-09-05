/**
 * Base de obras — `/obras/base`.
 *
 * Server Component fino: busca as obras, calcula os derivados uma vez e
 * entrega o resto à `_visao.tsx`.
 *
 * OS INDICADORES OLHAM SEMPRE A BASE INTEIRA, NUNCA O FILTRO. É a regra
 * explícita do mockup (:3178) e é por isso que `kpisDaBase` é chamada aqui,
 * sobre `todas`, e não lá dentro sobre a lista filtrada: filtrar por uma etapa
 * não pode fazer o painel zerar e dar a impressão de que a operação parou.
 */

import { createClient } from '@/lib/supabase/server'
import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { EstadoVazio, KPI } from '../_ui/primitivos'
import { derivar, hojeISO, type ObraRow } from '../_lib/tipos'
import VisaoBase from './_visao'
import { kpisDaBase } from './_regras'

export const dynamic = 'force-dynamic'

export default async function BaseDeObrasPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email || !(await hasSystemAccess(supabase, user.email, 'obras'))) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <EstadoVazio>Esta tela é de quem é responsável pelas obras</EstadoVazio>
      </div>
    )
  }

  const { data, error } = await supabase.from('obras_obra').select('*')

  const hoje = hojeISO()
  const obras = ((data ?? []) as ObraRow[]).map((o) => derivar(o, hoje))
  const kpis = kpisDaBase(obras)

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 sm:px-6">
      <header>
        <h1 className="text-xl font-semibold text-[#e8eef7]">Base de obras</h1>
        <p className="mt-0.5 text-xs text-[#94a3b8]">
          Cadastro vivo · da chegada do Field até a obra faturada, passando pelo diário do dia
        </p>
      </header>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
        {kpis.map((k) => (
          <KPI key={k.rotulo} rotulo={k.rotulo} valor={k.valor} cor={k.cor} />
        ))}
      </div>

      {error ? (
        <EstadoVazio>
          Não deu para carregar a base de obras. Recarregue a página em alguns instantes.
        </EstadoVazio>
      ) : obras.length === 0 ? (
        <EstadoVazio>
          Nenhuma obra cadastrada ainda. A carga inicial vem da importação da planilha.
        </EstadoVazio>
      ) : (
        <VisaoBase obras={obras} />
      )}
    </div>
  )
}
