import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import CurvaS from '@/app/obras/obras/_ui/curva-s'
import EvolucaoEtapas from '@/app/obras/obras/_ui/evolucao-etapas'
import { exigirVisao } from '../../_lib/guarda'
import { lerDocumentosEnviados } from '../../_lib/ler'
import { Bloco, CaixaSinal, CartaoAguardando, Destaques, Indicadores, ListaDocumentos, PorQueMudou, SlotSituacaoCliente, Vazio } from '../../_ui/blocos'

export const dynamic = 'force-dynamic'

/** Visão geral da obra no portal (Leva 5 §3.2). Bloco sem dado não aparece. */
export default async function VisaoGeral({ params }: { params: Promise<{ obraId: string }> }) {
  const { obraId } = await params
  const { og, visao } = await exigirVisao(obraId)
  const raiz = `/portal-obra/obras/${obraId}`
  const docs = await lerDocumentosEnviados(createAdminClient(), obraId, og)
  const ultimos = docs.ok ? docs.documentos.slice(0, 4) : []
  const c = visao.cronograma

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      {c ? <CaixaSinal sinal={c.sinal} /> : null}
      <SlotSituacaoCliente situacao={visao.situacao} />
      {c ? <Indicadores c={c} /> : (
        <Bloco titulo="Cronograma" id="b-sem-crono">
          <Vazio>O cronograma desta obra está sendo preparado pela engenharia da Manfac. Os indicadores aparecem aqui assim que ele for publicado.</Vazio>
        </Bloco>
      )}

      {c && (c.atraso || visao.highlights.length) ? (
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-5">
          {c.atraso ? <div className={visao.highlights.length ? 'lg:col-span-3' : 'lg:col-span-5'}><PorQueMudou atraso={c.atraso} /></div> : null}
          {visao.highlights.length ? (
            <div className={c.atraso ? 'lg:col-span-2' : 'lg:col-span-5'}><Destaques itens={visao.highlights.slice(0, 5)} /></div>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-5">
        {c ? (
          <div className="lg:col-span-3">
            <Bloco titulo="Curva de avanço" id="b-curva">
              <CurvaS base={c.curva.base} previsto={c.curva.previsto} realizado={c.curva.realizado} hoje={c.curva.hoje} dadosAte={c.curva.dadosAte} />
            </Bloco>
          </div>
        ) : null}
        <div className={c ? 'lg:col-span-2' : 'lg:col-span-5'}>
          <Bloco titulo="Aguardando vocês" id="b-aguardando">
            {visao.aguardando.length ? (
              <div className="flex flex-col gap-3">
                {visao.aguardando.slice(0, 3).map((i, k) => (
                  <CartaoAguardando key={k} item={i} raiz={raiz} />
                ))}
                {visao.aguardando.length > 3 ? (
                  <Link href={`${raiz}/aguardando`} className="inline-flex min-h-11 items-center text-[15px] font-semibold text-(--obra-ink) underline underline-offset-2">
                    Ver todos ({visao.aguardando.length})
                  </Link>
                ) : null}
              </div>
            ) : (
              <Vazio>Nada pendente do lado de vocês no momento.</Vazio>
            )}
          </Bloco>
        </div>
      </div>

      {c && c.linhasEtapa.length ? (
        <Bloco
          titulo="Avanço por etapa"
          id="b-etapas"
          acao={
            <Link href={`${raiz}/cronograma`} className="inline-flex min-h-11 items-center text-[14px] font-semibold text-(--obra-ink) underline underline-offset-2">
              Ver cronograma completo
            </Link>
          }
        >
          <p className="mb-3 text-[13px] text-(--obra-muted-texto)">Realizado (laranja) × previsto hoje (marcador azul) × base (tracejado) · dias úteis do fim da etapa contra a base</p>
          <EvolucaoEtapas linhas={c.linhasEtapa} />
        </Bloco>
      ) : null}

      {ultimos.length ? (
        <Bloco
          titulo="Últimas comunicações"
          id="b-comunicacoes"
          acao={
            <Link href={`${raiz}/relatorios`} className="inline-flex min-h-11 items-center text-[14px] font-semibold text-(--obra-ink) underline underline-offset-2">
              Ver todos
            </Link>
          }
        >
          <ListaDocumentos docs={ultimos} raiz={raiz} />
        </Bloco>
      ) : null}
    </div>
  )
}
