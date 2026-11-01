import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { hojeISO } from '../../../../_lib/tipos'
import { lerMapa } from '../../../_lib/mapa-leitura'
import { lerObraDaRequisicao } from '../../_obra-da-requisicao'
import { podeMontarMapa } from '../_permissao'
import AvisoMapa from '../_aviso'
import EditorMapa from './_editor'

export const dynamic = 'force-dynamic'

export default async function MontarMapaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const email = user?.email?.trim().toLowerCase() ?? ''

  const r = await lerObraDaRequisicao(id, hojeISO())
  if (!r.ok) return <AvisoMapa>{r.erro}</AvisoMapa>
  // Conferido no servidor (as actions conferem de novo, e o banco por último).
  if (!(await podeMontarMapa(supabase, email, r.dados.obra.engenheiro_email))) {
    return (
      <AvisoMapa>
        <p>Só o engenheiro da obra ou um administrador monta o mapa.</p>
        <Link href={`/obras/obras/${id}/mapa`} className="flex min-h-11 items-center font-semibold text-(--obra-orange-texto)">
          Voltar ao mapa
        </Link>
      </AvisoMapa>
    )
  }

  const m = await lerMapa(supabase, id)
  if (!m.ok) return <AvisoMapa>Não deu para carregar o mapa. Recarregue a página.</AvisoMapa>
  const { mapa, ambientes, pontos, vinculos } = m.dados

  let plantaUrl: string | null = null
  if (mapa.plantaPath) {
    const { data } = await supabase.storage.from('obras-fotos').createSignedUrl(mapa.plantaPath, 600)
    plantaUrl = data?.signedUrl ?? null
  }

  return (
    <EditorMapa
      obraId={id}
      configurado={m.dados.configurado}
      modo={mapa.modo}
      planta={{ url: plantaUrl, largura: mapa.plantaLargura, altura: mapa.plantaAltura }}
      ambientes={ambientes.map((a) => ({
        ...a,
        atividades: vinculos.filter((v) => v.ambienteId === a.id).map((v) => v.atividadeNumero),
      }))}
      pontos={pontos}
      atividades={(r.dados.calc?.atividades ?? []).map((a) => ({ numero: a.numero, etapa: a.etapa, descricao: a.descricao }))}
    />
  )
}
