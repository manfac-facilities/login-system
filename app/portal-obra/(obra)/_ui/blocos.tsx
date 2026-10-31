import type { ReactNode } from 'react'
import Link from 'next/link'
import type { Sinal } from '@/app/obras/obras/_lib/cronograma'
import type { CronogramaCliente, ItemAguardando } from '../_lib/visao'
import type { DocumentoEnviado } from '../_lib/ler'
import type { SituacaoRelatorio } from '@/app/obras/obras/_lib/situacao'

/**
 * Peças da página do cliente (Leva 5 §3.2), no padrão do mockup aprovado
 * (Main.dc / Celular.dc): cartão branco de borda fina, título azul, texto
 * ≥ 14px, alvos ≥ 44px. Só recebem dados já filtrados pelo lado cliente.
 */
export function Bloco({ titulo, id, children, className = '', acao }: { titulo: string; id: string; children: ReactNode; className?: string; acao?: ReactNode }) {
  return (
    <section aria-labelledby={id} className={`min-w-0 rounded-2xl border border-(--obra-border) bg-(--obra-card) p-4 sm:p-6 ${className}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={id} className="text-[18px] font-bold text-(--obra-ink) sm:text-[20px]">
          {titulo}
        </h2>
        {acao}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  )
}

export function Vazio({ children }: { children: ReactNode }) {
  return <p className="text-[15px] text-(--obra-muted-texto)">{children}</p>
}

const CAIXA: Record<Sinal, { caixa: string; selo: string }> = {
  verde: { caixa: 'bg-[#e8f5ee] border-[#b9e0c9] text-[#14432b]', selo: 'bg-[#1f7a4d]' },
  amarelo: { caixa: 'bg-[#fff6dc] border-[#f0d78a] text-[#4d3500]', selo: 'bg-[#8a5a00]' },
  vermelho: { caixa: 'bg-[#fdeee6] border-[#f3c3a8] text-[#5e2200]', selo: 'bg-[#b33a00]' },
}

export function CaixaSinal({ sinal }: { sinal: CronogramaCliente['sinal'] }) {
  const c = CAIXA[sinal.tom]
  return (
    <section aria-label="Situação da obra" className={`rounded-2xl border px-4 py-4 sm:px-6 sm:py-5 ${c.caixa}`}>
      <div className="flex flex-wrap items-center gap-3">
        <span className={`inline-flex min-h-8 items-center rounded-full px-3.5 text-[13px] font-extrabold tracking-wider text-white uppercase ${c.selo}`}>
          {sinal.titulo}
        </span>
        <span className="text-[16px] font-semibold">{sinal.resumo}</span>
      </div>
      <p className="mt-3 max-w-4xl text-[15px] leading-relaxed sm:text-[16px]">{sinal.texto}</p>
    </section>
  )
}

const TOM_DESVIO = { ok: 'text-(--obra-verde-texto)', atencao: 'text-(--obra-yellow-texto)', atraso: 'text-[#9a2a00]' } as const

function Kpi({ rotulo, valor, sub, subClasse = 'text-(--obra-text)' }: { rotulo: string; valor: string; sub?: string | null; subClasse?: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-(--obra-border) bg-(--obra-card) p-3.5 sm:p-5">
      <p className="text-[12px] font-semibold text-(--obra-muted-texto) sm:text-[13px]">{rotulo}</p>
      <p className="obra-num mt-1 text-[26px] leading-tight font-extrabold text-(--obra-ink) sm:text-[34px]">{valor}</p>
      {sub ? <p className={`mt-1 text-[13px] sm:text-[14px] ${subClasse}`}>{sub}</p> : null}
    </div>
  )
}

export function Indicadores({ c }: { c: CronogramaCliente }) {
  return (
    <section aria-label="Indicadores" className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
      <Kpi rotulo="Avanço planejado até hoje" valor={c.previsto} />
      <Kpi rotulo="Avanço realizado" valor={c.realizado} sub={c.desvio} subClasse={`font-semibold ${TOM_DESVIO[c.tomDesvio]}`} />
      <Kpi rotulo="Entrega prevista" valor={c.entrega} sub={c.base ? `data da base: ${c.base}` : c.entregaCompleta} />
      {c.ppc ? (
        <Kpi
          rotulo="Compromissos da semana cumpridos"
          valor={c.ppc.valor}
          sub={`semana de ${c.ppc.semana}${c.ppc.naoCumpridos ? ` · ${c.ppc.naoCumpridos} não ${c.ppc.naoCumpridos === 1 ? 'cumprido' : 'cumpridos'}` : ''}`}
        />
      ) : null}
    </section>
  )
}

const diasUteis = (n: number) => `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(n)} ${n === 1 ? 'dia útil' : 'dias úteis'}`

export function PorQueMudou({ atraso }: { atraso: NonNullable<CronogramaCliente['atraso']> }) {
  const aria = atraso.causas.map((k) => `${k.quem} ${diasUteis(k.dias)}`).join(', ')
  return (
    <Bloco titulo="Por que a data de entrega mudou" id="b-atraso">
      <p className="text-[15px] text-(--obra-text)">
        De <span className="obra-num">{atraso.de}</span> para <span className="obra-num">{atraso.para}</span>: {diasUteis(atraso.total)} a mais, assim
        distribuídos:
      </p>
      <div role="img" aria-label={aria} className="mt-4 flex h-5 overflow-hidden rounded-md bg-(--obra-trilho)">
        {atraso.causas.map((k) => (
          <div key={k.chave} style={{ width: `${Math.round((k.dias / atraso.total) * 100)}%`, backgroundColor: k.cor }} />
        ))}
      </div>
      <ul className="mt-4 flex flex-col gap-3.5">
        {atraso.causas.map((k) => (
          <li key={k.chave} className="flex items-start gap-3">
            <span aria-hidden className="mt-1 size-3.5 shrink-0 rounded" style={{ backgroundColor: k.cor }} />
            <div className="min-w-0">
              <p className="text-[15px] font-bold text-(--obra-text)">
                {k.quem} · {diasUteis(k.dias)}
              </p>
              {k.motivos.length ? (
                <ul className="mt-0.5 text-[14px] leading-relaxed text-(--obra-muted-texto)">
                  {k.motivos.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </Bloco>
  )
}

export function Destaques({ itens }: { itens: string[] }) {
  return (
    <Bloco titulo="Destaques do período" id="b-destaques">
      <ul className="flex flex-col gap-3">
        {itens.map((t) => (
          <li key={t} className="flex items-start gap-2.5 text-[15px] leading-snug font-medium text-(--obra-text)">
            <svg aria-hidden width="20" height="20" viewBox="0 0 20 20" className="mt-0.5 shrink-0">
              <circle cx="10" cy="10" r="8" fill="none" stroke="#f85e0b" strokeWidth="2" />
              <path d="M6.5 10.2l2.4 2.4 4.6-4.8" fill="none" stroke="#00345e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </Bloco>
  )
}

export function CartaoAguardando({ item, raiz }: { item: ItemAguardando; raiz: string }) {
  return (
    <div className="rounded-xl border border-[#f6c7ad] bg-[#fff1ea] p-3.5 sm:p-4">
      <p className="text-[15px] font-bold text-[#7a2e00]">{item.titulo}</p>
      {item.detalhe ? <p className="mt-1 text-[14px] leading-relaxed text-(--obra-text)">{item.detalhe}</p> : null}
      <p className="mt-2 text-[13px] font-semibold text-[#7a2e00]">
        {item.tipo === 'impedimento' ? 'Aguardando' : 'Pendente'} desde <span className="obra-num">{item.desde}</span>
        {item.diasUteis > 0 ? ` (há ${diasUteis(item.diasUteis)})` : ''}
        {item.prazo ? (
          <>
            {' '}· {item.vencida ? 'prazo vencido em' : 'necessário até'} <span className="obra-num">{item.prazo}</span>
          </>
        ) : null}
      </p>
      <Link href={`${raiz}/mensagens`} className="mt-1 inline-flex min-h-11 items-center text-[14px] font-semibold text-(--obra-ink) underline underline-offset-2">
        Responder pela página da obra
      </Link>
    </div>
  )
}

export function ListaDocumentos({ docs, raiz }: { docs: DocumentoEnviado[]; raiz: string }) {
  return (
    <ul className="divide-y divide-(--obra-border)">
      {docs.map((d) => (
        <li key={d.envioId} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5 first:pt-0 last:pb-0">
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-(--obra-text)">{d.titulo}</p>
            <p className="text-[13px] text-(--obra-muted-texto)">{d.quando}</p>
          </div>
          <a
            href={`${raiz}/pdf/${d.envioId}`}
            target="_blank"
            rel="noopener"
            className="inline-flex min-h-11 items-center text-[15px] font-semibold text-(--obra-ink) underline underline-offset-2"
          >
            Abrir PDF<span className="sr-only">: {d.titulo}</span>
          </a>
        </li>
      ))}
    </ul>
  )
}

/**
 * "Situação para o cliente" (spec §7, Task 6): a explicação e as ações de
 * recuperação da última situação PUBLICADA pelo engenheiro, no tom do mockup
 * aprovado ("O que estamos fazendo para recuperar"). Sem publicação, não aparece.
 */
export function SlotSituacaoCliente({ situacao }: { situacao: SituacaoRelatorio | null }) {
  if (situacao === null) return null
  return (
    <Bloco titulo="Situação da obra" id="b-situacao">
      <p className="max-w-4xl text-[15px] leading-relaxed text-(--obra-text) sm:text-[16px]">{situacao.explicacao}</p>
      {situacao.acoes.length ? (
        <>
          <h3 className="mt-5 text-[16px] font-bold text-(--obra-ink) sm:text-[18px]">O que estamos fazendo para recuperar</h3>
          <ul className="mt-3 flex flex-col gap-3">
            {situacao.acoes.map((a, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <svg aria-hidden width="20" height="20" viewBox="0 0 20 20" className="mt-0.5 shrink-0">
                  <circle cx="10" cy="10" r="8" fill="none" stroke="#f85e0b" strokeWidth="2" />
                  <path d="M6.5 10.2l2.4 2.4 4.6-4.8" fill="none" stroke="#00345e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div>
                  <p className="text-[15px] leading-snug font-semibold text-(--obra-text)">{a.oque}</p>
                  {a.quando || a.efeito ? (
                    <p className="mt-0.5 text-[13px] text-(--obra-muted-texto)">{[a.quando, a.efeito].filter(Boolean).join(' · ')}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <p className="mt-4 text-[13px] text-(--obra-muted-texto)">
        Atualizado em <span className="obra-num">{situacao.atualizadoEm.slice(0, 5)}</span> por {situacao.por}
      </p>
    </Bloco>
  )
}
