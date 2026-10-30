import { createClient } from '@/lib/supabase/server'
import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { isAdmin } from '@/lib/auth/roles'
import { Box, BoxB, BoxH, Campo, Campos, EstadoVazio } from '../../../_ui/primitivos'
import { hojeISO } from '../../../_lib/tipos'
import { impedimentosCalcDe, lerObraGrande, planoDe } from '../../_lib/leitura'
import { calcularCronograma } from '../../_lib/cronograma'
import TabelaCronograma, { type LinhaTabela } from './_tabela'

export const dynamic = 'force-dynamic'

const dataBR = (iso: string | null | undefined) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—')
const dataHoraBR = (ts: string) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short' }).format(new Date(ts))

type Linha = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

export default async function CronogramaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const email = user?.email?.trim().toLowerCase() ?? ''

  const admin = !!email && (await isAdmin(supabase, email))
  const permitido = admin || (!!email && (await hasSystemAccess(supabase, email, 'obras')))
  if (!permitido) return <EstadoVazio>Esta tela é de quem é responsável pelas obras</EstadoVazio>

  const hoje = hojeISO()
  const r = await lerObraGrande(supabase, id, hoje)
  if (!r.ok) return <EstadoVazio>{r.erro}</EstadoVazio>
  const { obra, calc, versaoBase, versaoVigente, rascunho, exec, impedimentos, feriados } = r.dados

  if (!calc) return <EstadoVazio>Esta OBRA ainda não tem cronograma.</EstadoVazio>

  const { data: versoesR, error: errV } = await supabase
    .from('obras_cronograma_versao')
    .select('id, numero, salva_em, salva_por')
    .eq('obra_id', id)
  if (errV) return <EstadoVazio>Não deu para carregar as versões. Recarregue a página.</EstadoVazio>
  const salvaPor = new Map(((versoesR ?? []) as Linha[]).map((v) => [v.id as string, (v.salva_por as string | null) ?? null]))

  // Com base salva e revisão em rascunho, a leitura calcula pela vigente; a
  // tabela mostra o rascunho (é o que se edita), calculado com a mesma execução.
  let exibida = calc
  if (rascunho && versaoVigente) {
    const { data: at, error } = await supabase.from('obras_atividade').select('*').eq('versao_id', rascunho.id)
    if (error) return <EstadoVazio>Não deu para carregar a revisão. Recarregue a página.</EstadoVazio>
    exibida = calcularCronograma({
      plano: planoDe((at ?? []) as Linha[], rascunho.id), exec, dataBase: obra.data_base ?? hoje, hoje, feriados,
      atividadeTrava: obra.atividade_trava, impedimentos: impedimentosCalcDe(impedimentos),
    })
  }

  const engenheiro = obra.engenheiro_email?.trim().toLowerCase() ?? ''
  const podeEditar = admin || (!!engenheiro && engenheiro === email)

  // Sem peso_valor no cliente: não é exibido e é dado interno.
  const linhas: LinhaTabela[] = exibida.atividades.map(({ pesoValor: _p, peso: _q, ...a }) => a) // eslint-disable-line @typescript-eslint/no-unused-vars

  const salvaPorBase = versaoBase ? salvaPor.get(versaoBase.id) : null

  return (
    <div className="flex flex-col gap-4">
      <Box>
        <BoxH>Versões do cronograma</BoxH>
        <BoxB className="flex flex-col gap-1 text-sm text-[#e8eef7]">
          {versaoBase?.salvaEm ? (
            <p>
              Base (v1) salva em {dataHoraBR(versaoBase.salvaEm)}
              {salvaPorBase ? <span className="text-[#94a3b8]"> por {salvaPorBase}</span> : null}
            </p>
          ) : (
            <p className="text-[#eab308]">Base (v1) ainda não salva — edite o rascunho e clique em “Salvar base”.</p>
          )}
          {versaoVigente && versaoVigente.numero > 1 ? (
            <p>
              Vigente: v{versaoVigente.numero} — {versaoVigente.motivo ?? 'sem motivo'}
              {versaoVigente.salvaEm ? (
                <span className="text-[#94a3b8]"> (salva em {dataHoraBR(versaoVigente.salvaEm)})</span>
              ) : null}
            </p>
          ) : null}
          {rascunho && versaoVigente ? (
            <p className="text-[#eab308]">
              Revisão v{rascunho.numero} em rascunho — a tabela abaixo mostra a revisão; painel e diário seguem a v
              {versaoVigente.numero} até ela ser salva.
            </p>
          ) : null}
        </BoxB>
      </Box>

      <Box>
        <BoxH>Término</BoxH>
        <BoxB>
          <Campos cols={3}>
            <Campo rotulo="Base (v1)">{dataBR(r.dados.terminoBase)}</Campo>
            <Campo rotulo={versaoVigente ? `Vigente (v${versaoVigente.numero})` : 'Vigente'}>
              {versaoVigente ? dataBR(calc.terminoPrevisto) : null}
            </Campo>
            <Campo rotulo="Projetado">{dataBR(calc.terminoProjetado)}</Campo>
          </Campos>
        </BoxB>
      </Box>

      <TabelaCronograma
        obraId={id}
        atividades={linhas}
        rascunho={rascunho ? { id: rascunho.id, numero: rascunho.numero } : null}
        temVigente={!!versaoVigente}
        podeEditar={podeEditar}
      />
    </div>
  )
}
