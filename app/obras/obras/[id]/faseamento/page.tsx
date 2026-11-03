import { createClient } from '@/lib/supabase/server'
import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { isAdmin } from '@/lib/auth/roles'
import AvisoMapa from '../mapa/_aviso'
import { textoDaTrava, type TravaSnapshot } from './_lib/trava'
import { assinarPlanta, UUID } from './_pdf'
import { podeFasear } from './_permissao'
import { ILEGIVEL_RASCUNHO, carimboDe, carimboLegivel, faltaSqlFaseamento, lerCamadas, lerRegras, plantaEntraNoPdf, revisaoAberta } from './_regras'
import TelaFaseamento from './_tela'
import type { BaseDesenho, FaseTela, RevisaoResumo, RevisaoTela } from './_tipos'

export const dynamic = 'force-dynamic'

type Linha = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

const ERRO_LEITURA = 'Não deu para carregar o faseamento. Recarregue a página.'
const INDISPONIVEL = 'Faseamento ainda não está disponível nesta obra.'

/**
 * Planta de faseamento (Leva 6b §4). Lê pela sessão (RLS `obras_has_access`);
 * `podeFasear` só decide se a tela mostra os botões — as actions e o banco
 * conferem de novo. Abre a fase de `?fase=` (ou a primeira) na revisão em
 * rascunho; sem rascunho, na última emitida, com a base congelada nela.
 */
export default async function FaseamentoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ fase?: string }>
}) {
  const { id } = await params
  const { fase: faseParam } = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const email = user?.email?.trim().toLowerCase() ?? ''
  const permitido = !!email && ((await isAdmin(supabase, email)) || (await hasSystemAccess(supabase, email, 'obras')))
  if (!permitido) return <AvisoMapa>Esta tela é de quem é responsável pelas obras</AvisoMapa>
  if (!UUID.test(id)) return <AvisoMapa>Obra não encontrada</AvisoMapa>

  const [oR, fR, rR, eR] = await Promise.all([
    supabase
      .from('obras_obra')
      .select('id, os, loja, descricao, cliente, modalidade, engenheiro_email, coordenador_email, atividade_trava')
      .eq('id', id)
      .maybeSingle(),
    supabase.from('obras_fase').select('id, numero, nome, ordem').eq('obra_id', id).order('ordem').order('numero'),
    supabase.from('obras_fase_revisao').select('id, fase_id, revisao, status, emitida_em').eq('obra_id', id).order('revisao'),
    supabase.from('obras_envio').select('fase_revisao_id, enviado_em, resultado').eq('obra_id', id).eq('tipo', 'faseamento'),
  ])
  // Sem o SQL da leva 6b (coluna/tabela ausente): aviso, não erro.
  if ([oR.error, fR.error, rR.error].some(faltaSqlFaseamento)) return <AvisoMapa>{INDISPONIVEL}</AvisoMapa>
  if (oR.error || fR.error || rR.error) return <AvisoMapa>{ERRO_LEITURA}</AvisoMapa>
  const obra = oR.data as Linha | null
  if (!obra || obra.modalidade !== 'obra') return <AvisoMapa>Obra não encontrada</AvisoMapa>
  const podeEditar = await podeFasear(supabase, email, obra)

  // Envio é só para o rótulo "enviada dd/mm": falha na leitura não derruba a tela.
  const enviada = new Map<string, string>()
  for (const e of (eR.error ? [] : (eR.data ?? [])) as Linha[]) {
    if (e.resultado !== 'ok' || !e.fase_revisao_id) continue
    const k = String(e.fase_revisao_id)
    const atual = enviada.get(k)
    if (!atual || String(e.enviado_em) > atual) enviada.set(k, String(e.enviado_em))
  }
  const revisoes = ((rR.data ?? []) as Linha[]).map((r) => ({
    faseId: String(r.fase_id),
    resumo: {
      id: String(r.id),
      revisao: Number(r.revisao),
      status: r.status === 'emitida' ? 'emitida' : 'rascunho',
      emitidaEm: r.emitida_em ?? null,
      enviadaEm: enviada.get(String(r.id)) ?? null,
    } satisfies RevisaoResumo,
  }))
  const fases: FaseTela[] = ((fR.data ?? []) as Linha[]).map((f) => ({
    id: String(f.id),
    numero: Number(f.numero),
    nome: String(f.nome),
    revisoes: revisoes.filter((r) => r.faseId === String(f.id)).map((r) => r.resumo),
  }))
  const fase = fases.find((f) => f.id === faseParam) ?? fases[0] ?? null
  const aberta = fase ? revisaoAberta(fase.revisoes) : null

  let revisao: RevisaoTela | null = null
  let base: BaseDesenho = { url: null, largura: null, altura: null }
  if (fase && aberta) {
    const { data: row, error } = await supabase.from('obras_fase_revisao').select('*').eq('id', aberta.id).maybeSingle()
    if (error || !row) return <AvisoMapa>{ERRO_LEITURA}</AvisoMapa>
    const r = row as Linha
    const emitida = r.status === 'emitida'
    // Emitida: a base congelada nela. Rascunho: a planta atual do mapa (mapa ilegível = sem planta).
    let planta: Linha | null = emitida ? r : null
    if (!emitida) {
      const m = await supabase.from('obras_mapa').select('planta_path, planta_largura, planta_altura').eq('obra_id', id).maybeSingle()
      planta = m.error ? null : (m.data as Linha | null)
    }
    const url = await assinarPlanta(supabase, planta?.planta_path)
    base = {
      url,
      largura: url ? (planta?.planta_largura ?? null) : null,
      altura: url ? (planta?.planta_altura ?? null) : null,
      foraDoPdf: !!url && !plantaEntraNoPdf(String(planta?.planta_path)),
    }
    // Gravado que o schema recusa: mostra só o válido, avisa e deixa a revisão em leitura (nunca troca por [] calado).
    const camadas = lerCamadas(r.camadas)
    const regras = lerRegras(r.regras)
    const problemas = [
      camadas.ok ? null : 'Há camadas que não puderam ser lidas',
      regras.ok ? null : 'Há regras que não puderam ser lidas',
      carimboLegivel(r.carimbo) ? null : 'O carimbo gravado não pôde ser lido',
    ].filter(Boolean)
    revisao = {
      id: String(r.id),
      faseId: fase.id,
      revisao: Number(r.revisao),
      status: emitida ? 'emitida' : 'rascunho',
      camadas: camadas.camadas,
      regras: regras.regras,
      carimbo: carimboDe(r.carimbo, emitida ? Number(r.fase_numero) : fase.numero, obra.cliente),
      usaTrava: r.usa_trava === true,
      emitidaEm: r.emitida_em ?? null,
      emitidaPor: r.emitida_por ?? null,
      travaTexto: emitida ? textoDaTrava((r.trava_snapshot ?? null) as TravaSnapshot | null) : null,
      // Emitida: a "Nova revisão" copia só o que é legível, então destrava. Rascunho só fica assim por SQL manual (DIVIDAS).
      ilegivel: problemas.length
        ? `${problemas.join('; ')}. ${emitida ? 'Crie uma nova revisão a partir da última emitida para continuar.' : ILEGIVEL_RASCUNHO}`
        : null,
    }
  } else {
    // Sem fase ainda: o aviso de "sem planta" já vale para a primeira.
    const m = await supabase.from('obras_mapa').select('planta_path').eq('obra_id', id).maybeSingle()
    const url = m.error ? null : await assinarPlanta(supabase, (m.data as Linha | null)?.planta_path)
    base = { url, largura: null, altura: null }
  }

  return (
    <TelaFaseamento
      key={revisao ? `${revisao.id}-${revisao.status}` : 'vazio'}
      obraId={id}
      obra={{ nome: String(obra.loja ?? obra.descricao ?? obra.os ?? 'Obra').trim() || 'Obra', os: String(obra.os ?? '—') }}
      fases={fases}
      faseId={fase?.id ?? null}
      revisao={revisao}
      base={base}
      podeEditar={podeEditar}
      temTrava={obra.atividade_trava != null}
    />
  )
}
