import { createClient } from '@/lib/supabase/server'
import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { isAdmin } from '@/lib/auth/roles'
import { EstadoVazio } from '../../../_ui/primitivos'
import { hojeISO } from '../../../_lib/tipos'
import {
  BLOCOS, MAX_FOTOS_APRESENTACAO, PRESETS, ROTULO_BLOCO, ROTULO_PRESET, lerParams, paramsParaQuery, slidesDe,
} from '../../_lib/apresentacao'
import { amostra, lerApresentacao } from '../../_lib/ler-apresentacao'
import { lerObraDaRequisicao } from '../_obra-da-requisicao'
import TelaCheia, { type FotoTela } from './_tela-cheia'

export const dynamic = 'force-dynamic'

const MAX_MINIATURAS = 60
const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
const CAMPO =
  'min-h-11 rounded-lg border border-(--obra-border) bg-white px-3 text-[14px] text-(--obra-text)'
const BOTAO_PRIMARIO =
  'inline-flex min-h-11 items-center rounded-lg bg-(--obra-ink) px-4 text-[14px] font-medium text-white hover:bg-(--obra-ink-escuro)'
const BOTAO_SECUNDARIO =
  'inline-flex min-h-11 items-center rounded-lg border border-(--obra-border) bg-white px-4 text-[14px] font-medium text-(--obra-ink) hover:bg-(--obra-surface)'

/**
 * Apresentação ao cliente (Leva 4 §2.4): período (presets + personalizado) e
 * blocos pela query string; tela cheia (um bloco por slide) e PDF paisagem.
 * Sempre a versão cliente; não grava nada; qualquer usuário com acesso à obra.
 */
export default async function ApresentacaoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { id } = await params
  const sp = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const email = user?.email?.trim().toLowerCase() ?? ''
  const permitido = !!email && ((await isAdmin(supabase, email)) || (await hasSystemAccess(supabase, email, 'obras')))
  if (!permitido) return <EstadoVazio>Esta tela é de quem é responsável pelas obras</EstadoVazio>

  const hoje = hojeISO()
  const lida = await lerObraDaRequisicao(id, hoje)
  if (!lida.ok) return <EstadoVazio>{lida.erro}</EstadoVazio>

  const p = lerParams(sp)
  const r = await lerApresentacao(supabase, id, hoje, p, lida.dados)
  if (!r.ok && r.status !== 400) return <EstadoVazio>{r.erro}</EstadoVazio>
  const dados = r.ok ? r.dados : null

  // Fotos escolhidas (já re-resolvidas) e miniaturas do seletor: URLs assinadas pela sessão.
  const escolhidas = dados?.fotos ?? []
  const idsEscolhidos = new Set(escolhidas.map((f) => f.id))
  const miniaturas = dados
    ? [...new Map([...escolhidas, ...amostra(dados.elegiveis, MAX_MINIATURAS)].map((f) => [f.id, f])).values()]
    : []
  const urls = new Map<string, string>()
  if (miniaturas.length) {
    const { data: assinadas } = await supabase.storage.from('obras-fotos').createSignedUrls(miniaturas.map((f) => f.path), 900)
    for (const s of assinadas ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl)
  }
  const fotosTela: FotoTela[] = escolhidas.flatMap((f) => {
    const url = urls.get(f.path)
    return url ? [{ url, legenda: f.legenda, data: f.data }] : []
  })

  const slides = dados ? slidesDe(dados.conteudo, fotosTela.length > 0) : []
  const query = dados ? paramsParaQuery(p, escolhidas.map((f) => f.id)) : ''
  const marcado = (b: (typeof BLOCOS)[number]) => p.blocos.includes(b)

  return (
    <div className="flex flex-col gap-5">
      <form method="get" className="flex flex-col gap-5 rounded-xl border border-(--obra-border) bg-(--obra-card) p-4 sm:p-5">
        <input type="hidden" name="f" value="1" />
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-[13px] font-semibold text-(--obra-ink)">Período</legend>
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            {PRESETS.map((x) => (
              <label key={x} className="flex min-h-11 items-center gap-2 text-[14px]">
                <input type="radio" name="periodo" value={x} defaultChecked={p.preset === x} className="size-4" />
                {ROTULO_PRESET[x]}
              </label>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[14px]">
            <label className="flex items-center gap-2">
              De
              <input type="date" name="de" defaultValue={p.de ?? ''} className={CAMPO} />
            </label>
            <label className="flex items-center gap-2">
              até
              <input type="date" name="ate" defaultValue={p.ate ?? ''} className={CAMPO} />
            </label>
            <span className="text-[12px] text-(--obra-muted-texto)">(só no período personalizado)</span>
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 text-[13px] font-semibold text-(--obra-ink)">Blocos</legend>
          <p className="text-[12px] text-(--obra-muted-texto)">Bloco sem dado no período some sozinho.</p>
          <div className="grid gap-x-5 sm:grid-cols-2">
            {BLOCOS.map((b) => (
              <label key={b} className="flex min-h-11 items-center gap-2 text-[14px]">
                <input type="checkbox" name="blocos" value={b} defaultChecked={marcado(b)} className="size-4" />
                {ROTULO_BLOCO[b]}
              </label>
            ))}
          </div>
        </fieldset>

        {dados && marcado('fotos') ? (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-[13px] font-semibold text-(--obra-ink)">
              Fotos (até {MAX_FOTOS_APRESENTACAO}) — dos diários validados do período
            </legend>
            {miniaturas.length ? (
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                {miniaturas.map((f) => {
                  const url = urls.get(f.path)
                  return (
                    <li key={f.id}>
                      <label className="flex min-h-11 cursor-pointer flex-col gap-1 text-[12px]">
                        {url ? (
                          // eslint-disable-next-line @next/next/no-img-element -- URL assinada do storage
                          <img src={url} alt={f.legenda || `Foto de ${dm(f.data)}`} loading="lazy" className="aspect-[4/3] w-full rounded-md object-cover" />
                        ) : (
                          <span className="flex aspect-[4/3] items-center justify-center rounded-md bg-(--obra-surface) text-(--obra-muted-texto)">
                            indisponível
                          </span>
                        )}
                        <span className="flex items-center gap-1.5">
                          <input type="checkbox" name="fotos" value={f.id} defaultChecked={idsEscolhidos.has(f.id)} className="size-4" />
                          <span className="obra-num">{dm(f.data)}</span>
                        </span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="text-[13px] text-(--obra-muted-texto)">Nenhuma foto de diário validado neste período.</p>
            )}
          </fieldset>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <button type="submit" className={BOTAO_SECUNDARIO}>
            Atualizar prévia
          </button>
        </div>
      </form>

      {!dados ? (
        <EstadoVazio>{r.ok ? '' : r.erro}</EstadoVazio>
      ) : (
        <section className="flex flex-col gap-3 rounded-xl border border-(--obra-border) bg-(--obra-card) p-4 sm:p-5" aria-label="Apresentação">
          <p className="text-[15px] font-semibold text-(--obra-ink)">{dados.conteudo.titulo}</p>
          <p className="obra-num text-[13px] text-(--obra-muted-texto)">{dados.conteudo.subtitulo}</p>
          <p className="text-[13px] text-(--obra-text)">
            {slides.length ? `${slides.length} slides: ${slides.map((b) => ROTULO_BLOCO[b]).join(' · ')}` : 'Nenhum bloco com dado neste período.'}
          </p>
          {slides.length ? (
            <div className="flex flex-wrap gap-3">
              <TelaCheia conteudo={dados.conteudo} fotos={fotosTela} />
              <a href={`/obras/obras/${encodeURIComponent(String(dados.og.obra.id))}/apresentacao/pdf?${query}`} className={BOTAO_PRIMARIO}>
                Baixar PDF
              </a>
            </div>
          ) : null}
        </section>
      )}
    </div>
  )
}
