import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { exigirObra } from '../../../_lib/guarda'
import { lerGaleria, type FotoGaleria } from '../../../_lib/ler'
import { Bloco, Vazio } from '../../../_ui/blocos'

export const dynamic = 'force-dynamic'

function agrupar(fotos: FotoGaleria[], por: 'data' | 'etapa'): { titulo: string; fotos: FotoGaleria[] }[] {
  const grupos = new Map<string, FotoGaleria[]>()
  for (const f of fotos) {
    const k = por === 'data' ? f.dataIso : f.etapa
    grupos.set(k, [...(grupos.get(k) ?? []), f])
  }
  const lista = [...grupos].map(([k, fs]) => ({ k, titulo: por === 'data' ? fs[0].data : k, fotos: fs }))
  // Por data: mais recente primeiro (a leitura já vem assim). Por etapa: "Geral" por último.
  if (por === 'etapa') lista.sort((a, b) => (a.k === 'Geral' ? 1 : b.k === 'Geral' ? -1 : a.k.localeCompare(b.k, 'pt-BR')))
  return lista
}

/** Galeria (Leva 5 §3.2): fotos dos diários validados/enviados, por data ou por etapa. URLs assinadas de 5 min. */
export default async function GaleriaPortal({
  params,
  searchParams,
}: {
  params: Promise<{ obraId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { obraId } = await params
  const { og } = await exigirObra(obraId)
  const por = (await searchParams).por === 'etapa' ? 'etapa' : 'data'
  const raiz = `/portal-obra/obras/${obraId}/galeria`
  const r = await lerGaleria(createAdminClient(), obraId, og)
  if (!r.ok) {
    return (
      <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-[15px] text-red-800">
        Não foi possível carregar as fotos agora. Tente novamente em alguns minutos.
      </p>
    )
  }
  if (!r.fotos.length) {
    return (
      <Bloco titulo="Galeria" id="b-galeria">
        <Vazio>As fotos aparecem aqui assim que os diários de obra forem validados.</Vazio>
      </Bloco>
    )
  }
  const opcao = (v: 'data' | 'etapa', rotulo: string) => (
    <Link
      href={v === 'data' ? raiz : `${raiz}?por=etapa`}
      aria-current={por === v ? 'true' : undefined}
      className={`inline-flex min-h-11 items-center rounded-full border px-4 text-[14px] font-semibold ${
        por === v ? 'border-(--obra-ink) bg-(--obra-ink) text-white' : 'border-(--obra-border) bg-(--obra-card) text-(--obra-ink)'
      }`}
    >
      {rotulo}
    </Link>
  )
  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Agrupar fotos">
        {opcao('data', 'Por data')}
        {opcao('etapa', 'Por etapa')}
      </div>
      {agrupar(r.fotos, por).map((g, i) => (
        <Bloco key={g.titulo} titulo={g.titulo} id={`g-${i}`}>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {g.fotos.map((f) => (
              <li key={f.id}>
                <a href={f.url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-lg border border-(--obra-border) bg-(--obra-trilho)">
                  {/* eslint-disable-next-line @next/next/no-img-element -- URL assinada do storage */}
                  <img src={f.url} alt={f.legenda || `Foto do diário de ${f.data}`} loading="lazy" className="aspect-square w-full object-cover" />
                </a>
                <p className="mt-1 text-[13px] leading-snug text-(--obra-muted-texto)">
                  {f.legenda ? `${f.legenda} · ` : ''}
                  <span className="obra-num">{por === 'etapa' ? f.data : f.etapa}</span>
                </p>
              </li>
            ))}
          </ul>
        </Bloco>
      ))}
    </div>
  )
}
