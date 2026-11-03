import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { isAdmin } from '@/lib/auth/roles'
import { hojeISO } from '../../../../../_lib/tipos'
import { fotosDoPonto } from '../../../../_lib/mapa'
import { lerFotosDoMapa } from '../../../../_lib/mapa-leitura'
import AvisoMapa from '../../_aviso'
import CompararPonto from './_comparar'

export const dynamic = 'force-dynamic'

/** Fotos por página da linha do tempo (as mais recentes); "Ver mais fotos" soma outra página. */
const POR_PAGINA = 60
const MAX_PAGINAS = 10

export default async function PontoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; pontoId: string }>
  searchParams: Promise<{ paginas?: string }>
}) {
  const { id, pontoId } = await params
  const { paginas: pParam } = await searchParams
  const paginas = Math.min(Math.max(Number.parseInt(pParam ?? '1', 10) || 1, 1), MAX_PAGINAS)
  const limite = paginas * POR_PAGINA
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const email = user?.email?.trim().toLowerCase() ?? ''
  const permitido = !!email && ((await isAdmin(supabase, email)) || (await hasSystemAccess(supabase, email, 'obras')))
  if (!permitido) return <AvisoMapa>Esta tela é de quem é responsável pelas obras</AvisoMapa>

  const { data: ponto, error } = await supabase
    .from('obras_ponto_foto')
    .select('id, numero, nome, ativo, ambiente_id, obras_ambiente(nome)')
    .eq('id', pontoId)
    .eq('obra_id', id)
    .maybeSingle()
  if (error) return <AvisoMapa>Não deu para carregar o ponto. Recarregue a página.</AvisoMapa>
  if (!ponto) return <AvisoMapa>Ponto não encontrado nesta obra</AvisoMapa>

  // As mais novas (uma a mais para saber se há outra página) + a primeira de todas (início × hoje).
  const [fR, primR] = await Promise.all([
    lerFotosDoMapa(supabase, id, { pontoId, limite: limite + 1 }),
    lerFotosDoMapa(supabase, id, { pontoId, limite: 1, ascendente: true }),
  ])
  if (!fR.ok || !primR.ok) return <AvisoMapa>Não deu para carregar as fotos do ponto. Recarregue a página.</AvisoMapa>
  const temMais = fR.fotos.length > limite
  const recentes = fR.fotos.slice(0, limite)
  const primeira = primR.fotos[0]
  const fotos = fotosDoPonto(
    pontoId,
    primeira && !recentes.some((f) => f.id === primeira.id) ? [primeira, ...recentes] : recentes,
  )

  const urls = new Map<string, string>()
  if (fotos.length) {
    const { data: assinadas } = await supabase.storage.from('obras-fotos').createSignedUrls(fotos.map((f) => f.path), 600)
    for (const s of assinadas ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl)
  }
  const amb = ponto.obras_ambiente as unknown as { nome: string } | { nome: string }[] | null
  const nomeAmbiente = (Array.isArray(amb) ? amb[0]?.nome : amb?.nome) ?? ''

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-(--obra-ink)">
            <span className="obra-num">Ponto {ponto.numero}</span> · {ponto.nome}
          </h2>
          <p className="text-sm text-(--obra-muted-texto)">
            {nomeAmbiente}
            {ponto.ativo ? '' : ' · ponto desativado'} · arraste para comparar
          </p>
        </div>
        <Link href={`/obras/obras/${id}/mapa`} className="flex min-h-11 items-center rounded-lg border border-(--obra-border) bg-(--obra-card) px-3 text-sm text-(--obra-ink)">
          Voltar ao mapa
        </Link>
      </header>
      <section className="rounded-xl border border-(--obra-border) bg-(--obra-card) p-4">
        <CompararPonto hoje={hojeISO()} fotos={fotos.map((f) => ({ ...f, url: urls.get(f.path) ?? null }))} />
        {temMais && paginas < MAX_PAGINAS ? (
          <Link
            href={`/obras/obras/${id}/mapa/ponto/${pontoId}?paginas=${paginas + 1}`}
            className="mt-3 flex min-h-11 w-fit items-center rounded-lg border border-(--obra-border) px-3 text-sm text-(--obra-ink)"
          >
            Ver mais fotos
          </Link>
        ) : temMais ? (
          <p className="mt-3 text-xs text-(--obra-muted-texto)">Mostrando as {limite} fotos mais recentes e a primeira.</p>
        ) : null}
      </section>
    </div>
  )
}
