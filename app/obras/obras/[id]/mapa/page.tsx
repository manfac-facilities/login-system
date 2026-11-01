import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { isAdmin } from '@/lib/auth/roles'
import { hojeISO } from '../../../_lib/tipos'
import { lerFotosDoMapa, lerMapa } from '../../_lib/mapa-leitura'
import { lerObraDaRequisicao } from '../_obra-da-requisicao'
import { fotosRecentesPorAmbiente, montarMapaTela } from './_dados'
import { podeMontarMapa } from './_permissao'
import TelaMapa from './_tela'
import AvisoMapa from './_aviso'

export const dynamic = 'force-dynamic'

/** Validade das URLs assinadas (planta e fotos): curta, gerada a cada render no servidor. */
const VALIDADE_URL_S = 600

type Linha = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

export default async function MapaObraPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const email = user?.email?.trim().toLowerCase() ?? ''
  const permitido = !!email && ((await isAdmin(supabase, email)) || (await hasSystemAccess(supabase, email, 'obras')))
  if (!permitido) return <AvisoMapa>Esta tela é de quem é responsável pelas obras</AvisoMapa>

  const r = await lerObraDaRequisicao(id, hojeISO())
  if (!r.ok) return <AvisoMapa>{r.erro}</AvisoMapa>
  const { obra, calc } = r.dados
  const podeMontar = await podeMontarMapa(supabase, email, obra.engenheiro_email)

  const m = await lerMapa(supabase, id)
  if (!m.ok) return <AvisoMapa>Não deu para carregar o mapa. Recarregue a página.</AvisoMapa>
  const mapa = m.dados
  if (!mapa.ambientes.length) {
    return (
      <AvisoMapa>
        <p className="font-semibold text-(--obra-ink)">O mapa desta obra ainda não foi montado</p>
        <p className="text-(--obra-muted-texto)">
          Ambientes ligados às atividades do cronograma, com pontos de foto, coloridos pelo avanço.
        </p>
        {podeMontar ? (
          <Link
            href={`/obras/obras/${id}/mapa/montar`}
            className="flex min-h-11 items-center rounded-lg bg-(--obra-ink) px-4 font-semibold text-white hover:bg-(--obra-ink-escuro)"
          >
            Montar o mapa
          </Link>
        ) : (
          <p className="text-(--obra-muted-texto)">Quem monta é o engenheiro da obra ou um administrador.</p>
        )}
      </AvisoMapa>
    )
  }

  const [fR, iR] = await Promise.all([
    lerFotosDoMapa(supabase, id),
    supabase
      .from('obras_impedimento')
      .select('id, ambiente_id, descricao')
      .eq('obra_id', id)
      .eq('categoria', 'impedimento')
      .is('encerrado_em', null)
      .not('ambiente_id', 'is', null),
  ])
  if (!fR.ok || iR.error) return <AvisoMapa>Não deu para carregar o mapa. Recarregue a página.</AvisoMapa>

  // Só as fotos que a tela mostra ganham URL assinada.
  const caminhos = [...fotosRecentesPorAmbiente(mapa, fR.fotos).values()].flat().map((f) => f.path)
  const urls = new Map<string, string>()
  const storage = supabase.storage.from('obras-fotos')
  if (caminhos.length) {
    const { data: assinadas } = await storage.createSignedUrls(caminhos, VALIDADE_URL_S)
    for (const s of assinadas ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl)
  }
  let plantaUrl: string | null = null
  if (mapa.mapa.plantaPath) {
    const { data } = await storage.createSignedUrl(mapa.mapa.plantaPath, VALIDADE_URL_S)
    plantaUrl = data?.signedUrl ?? null
  }

  const tela = montarMapaTela({
    mapa,
    atividades: calc?.atividades ?? [],
    fotos: fR.fotos,
    impedimentos: ((iR.data ?? []) as Linha[]).map((i) => ({ id: i.id, ambienteId: i.ambiente_id, descricao: i.descricao })),
    urls,
    plantaUrl,
  })
  return <TelaMapa obraId={id} mapa={tela} podeMontar={podeMontar} />
}
