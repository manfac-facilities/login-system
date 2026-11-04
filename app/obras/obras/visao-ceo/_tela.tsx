'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import {
  contarTravas, excecoesDoDia, filtrarCarteira, ordenarCarteira, resumoCarteira,
  type DinheiroCarteira, type Estado, type FiltroCarteira, type ObraCarteira, type Quem, type SinalCliente, type Trava,
} from '../_lib/carteira'
import { brl, pctTexto } from '../_lib/financeiro-tela'
import { ESTILO_SITUACAO, PilulaExibida, PilulaSinal } from '../_ui/pilula-situacao'
import SimboloManfac from '../_ui/simbolo-manfac'
import { TEMA_OBRA as T } from '../_ui/tema'

/**
 * Visão do CEO (spec 2026-11-04 §5; mockup aprovado). Só leitura: filtro e obra aberta ficam no
 * estado local. Dinheiro só aparece quando a obra deixa ver; senão o motivo em texto, nunca zero.
 * Cor nunca é o único sinal: toda cor vem com rótulo.
 */

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`
const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`
const pct = (f: number | null) => (f === null ? '—' : `${Math.round(f * 100)}%`)
const largura = (f: number | null) => `${Math.min(100, Math.max(0, (f ?? 0) * 100))}%`

const FILTROS: { id: FiltroCarteira; rotulo: string }[] = [
  { id: 'todas', rotulo: 'Todas' },
  { id: 'risco', rotulo: 'Atrasadas e atenção' },
  { id: 'cliente', rotulo: 'Esperando o cliente' },
  { id: 'manfac', rotulo: 'Esperando a Manfac' },
  { id: 'terceiros', rotulo: 'Esperando terceiros' },
  { id: 'no_prazo', rotulo: 'No prazo' },
  { id: 'faturando', rotulo: 'Faturando' },
]

const ROTULO_QUEM: Record<Quem, string> = { cliente: 'Cliente', manfac: 'Manfac', terceiros: 'Terceiros' }
const ESTILO_QUEM: Record<Quem, (typeof ESTILO_SITUACAO)[keyof typeof ESTILO_SITUACAO]> = {
  cliente: ESTILO_SITUACAO.aguardando_cliente,
  manfac: ESTILO_SITUACAO.em_andamento,
  terceiros: ESTILO_SITUACAO.travada,
}

function PilulaQuem({ quem }: { quem: Quem }) {
  const e = ESTILO_QUEM[quem]
  return (
    <span
      className={'inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-[12px] font-semibold leading-4' + (e.hachura ? ' obra-hachura' : '')}
      style={{ color: e.texto, backgroundColor: e.fundo, borderColor: e.borda }}
    >
      {ROTULO_QUEM[quem]}
    </span>
  )
}

const TOM: Record<SinalCliente['tom'], { cor: string; texto: string; rotulo: string }> = {
  ruim: { cor: T.vermelho, texto: T.vermelhoTexto, rotulo: 'Ruim:' },
  atencao: { cor: '#e0b400', texto: T.yellowTexto, rotulo: 'Atenção:' },
  ok: { cor: T.verde, texto: T.verdeTexto, rotulo: 'Bom:' },
  indisponivel: { cor: T.muted, texto: T.mutedTexto, rotulo: 'Sem leitura:' },
}

const COR_SINAL = { vermelho: T.vermelho, amarelo: T.yellow, verde: T.verde } as const

const Bolinha = ({ cor, tam = 8 }: { cor: string; tam?: number }) => (
  <span aria-hidden="true" className="mt-[5px] flex-none rounded-full" style={{ width: tam, height: tam, background: cor }} />
)

function textoEstado(estado: Estado, dinheiro: DinheiroCarteira): string {
  switch (estado.tipo) {
    case 'sem_cronograma': return 'Sem cronograma'
    case 'faturando':
      return dinheiro.ok && dinheiro.aFaturar !== null
        ? `Execução concluída · faltam ${brl(dinheiro.aFaturar)} a faturar`
        : 'Execução concluída'
    case 'parada': return `Parada há ${plural(estado.diasUteis, 'dia útil', 'dias úteis')}`
    case 'frente_parada': return 'Andando, frente parada'
    case 'comecou': return `Começou em ${ddmm(estado.em)}`
    case 'andando': return estado.comAtraso ? 'Andando com atraso' : 'Andando'
  }
}

const textoDesvio = (d: number | null) => (!d || d <= 0 ? 'mantida' : `+${plural(d, 'dia útil', 'dias úteis')}`)

function quandoTrava(t: Trava): { texto: string; vencida: boolean } {
  if (t.vencida && t.prazo) return { texto: `venceu em ${ddmm(t.prazo)}`, vencida: true }
  if (t.prazo) return { texto: `prazo ${ddmm(t.prazo)}`, vencida: false }
  return { texto: `desde ${ddmm(t.desde)}`, vencida: false }
}

const SEM_VALOR = { sem_permissao: 'Sem permissão para ver valores', leitura: 'Não foi possível ler os valores' } as const

function Quadro({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section aria-label={titulo} className="flex flex-col gap-2.5 rounded-xl border border-(--obra-border) bg-(--obra-card) px-[18px] py-4">
      <h2 className="text-[12px] font-medium text-(--obra-muted-texto)">{titulo}</h2>
      {children}
    </section>
  )
}

function Barra({ valor, cor }: { valor: number | null; cor: string }) {
  return (
    <span aria-hidden="true" className="block h-[7px] overflow-hidden rounded-full bg-(--obra-trilho)">
      <span className="block h-full rounded-full" style={{ width: largura(valor), background: cor }} />
    </span>
  )
}

function Rotulo({ children }: { children: ReactNode }) {
  return <span className="block text-[11px] text-(--obra-muted-texto) min-[1061px]:hidden">{children}</span>
}

const COLUNAS =
  'grid-cols-1 gap-x-5 gap-y-3.5 min-[561px]:grid-cols-2 min-[1061px]:grid-cols-[1.25fr_0.95fr_1.25fr_1.7fr_1.35fr_1.2fr_28px] min-[1061px]:items-center'

function DinheiroLinha({ d }: { d: DinheiroCarteira }) {
  if (!d.ok) return <span className="text-[12px] text-(--obra-muted-texto)">{SEM_VALOR[d.motivo]}</span>
  if (d.valor === null)
    return (
      <>
        <span className="text-[12px] text-(--obra-muted-texto)">Valor da obra não informado</span>
        <span className="text-[12px] text-(--obra-muted-texto)">Faturado <span className="obra-num text-(--obra-text)">{brl(d.faturado)}</span></span>
      </>
    )
  const fat = d.valor > 0 ? d.faturado / d.valor : null
  return (
    <>
      <span className="text-[12px] text-(--obra-muted-texto)">
        Faturado <span className="obra-num font-semibold text-(--obra-text)">{pct(fat)}</span> de <span className="obra-num">{brl(d.valor)}</span>
      </span>
      <Barra valor={fat} cor={T.ink} />
      <span className="text-[12px] text-(--obra-muted-texto)">
        {d.acimaDoValor ? 'Faturado acima do valor' : <>A faturar <span className="obra-num text-(--obra-text)">{brl(d.aFaturar ?? 0)}</span></>}
      </span>
    </>
  )
}

function Detalhe({ o }: { o: ObraCarteira }) {
  const d = o.dinheiro
  const linha = (rotulo: string, valor: ReactNode, forte = false) => (
    <>
      <dt className="text-(--obra-muted-texto)">{rotulo}</dt>
      <dd className={'obra-num text-right' + (forte ? ' font-semibold' : '')}>{valor}</dd>
    </>
  )
  const cartao = 'flex flex-col gap-2.5 rounded-[10px] border border-(--obra-border) bg-(--obra-card) px-4 py-3.5'
  const h3 = 'text-[13px] font-semibold text-(--obra-ink)'
  return (
    <div className="flex flex-col gap-3.5 border-t border-(--obra-trilho) bg-[#fafaf9] px-5 py-[18px]">
      <div className="grid grid-cols-1 gap-6 rounded-[10px] border border-(--obra-border) bg-(--obra-card) px-[18px] py-4 min-[1061px]:grid-cols-[1.7fr_1fr]">
        <div className="flex min-w-0 flex-col gap-2.5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h3 className={h3}>Andamento por etapa</h3>
            <span className="flex gap-3 text-[11px] text-(--obra-muted-texto)">
              <span className="flex items-center gap-1"><span aria-hidden="true" className="h-1.5 w-3.5 rounded-full bg-(--obra-orange)" />realizado</span>
              <span className="flex items-center gap-1"><span aria-hidden="true" className="h-3 w-0.5 bg-(--obra-ink)" />onde deveria estar hoje</span>
            </span>
          </div>
          {o.etapas.length === 0 ? (
            <p className="text-[13px] text-(--obra-muted-texto)">Sem cronograma</p>
          ) : (
            o.etapas.map((e) => (
              <div key={e.nome} className="grid grid-cols-2 items-center gap-3 border-b border-[#f0f0ee] py-1.5 min-[1061px]:grid-cols-[minmax(0,1fr)_170px_150px]">
                <span className="text-[13px] font-medium text-(--obra-text)">{e.nome}</span>
                <span className="flex flex-col gap-[3px]">
                  <span aria-hidden="true" className="relative h-2 rounded-full bg-(--obra-trilho)">
                    <span className="absolute inset-y-0 left-0 rounded-full bg-(--obra-orange)" style={{ width: largura(e.realizado) }} />
                    <span className="absolute -top-[3px] -bottom-[3px] -ml-px w-0.5 bg-(--obra-ink)" style={{ left: largura(e.previsto) }} />
                  </span>
                  <span className="obra-num text-[11px] text-(--obra-muted-texto)">{pct(e.realizado)} · previsto {pct(e.previsto)}</span>
                </span>
                <span><PilulaExibida situacao={e.situacao} /></span>
              </div>
            ))
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-3.5">
          <div className="flex flex-col gap-1.5">
            <h3 className={h3}>Esta semana</h3>
            <p className="text-[13px] text-(--obra-text)">
              {o.semana === null
                ? 'Sem plano da semana'
                : `Plano com ${plural(o.semana.planejadas, 'atividade', 'atividades')}, ${plural(o.semana.cumpridas, 'concluída', 'concluídas')}` +
                  (o.semana.ppc === null ? '.' : ` (PPC ${pct(o.semana.ppc)}).`) +
                  (o.semana.causas ? ` Não cumpridas: ${o.semana.causas}.` : '')}
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <h3 className={h3}>Últimos diários</h3>
            {o.diarios.length === 0 ? (
              <p className="text-[12px] text-(--obra-muted-texto)">Nenhum diário validado ainda.</p>
            ) : (
              o.diarios.map((x) => (
                <p key={x.data} className="grid grid-cols-[44px_1fr] gap-2 text-[12px] text-(--obra-text)">
                  <span className="obra-num text-(--obra-muted-texto)">{ddmm(x.data)}</span>
                  <span>{x.texto}</span>
                </p>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 min-[1061px]:grid-cols-[1.25fr_1fr_1fr]">
        <div className={cartao}>
          <h3 className={h3}>O que está travando</h3>
          {o.travas.length === 0 ? (
            <p className="text-[13px] text-(--obra-verde-texto)">
              Nenhuma restrição aberta.{o.semana?.ppc != null ? <> PPC da semana: <span className="obra-num">{pct(o.semana.ppc)}</span>.</> : null}
            </p>
          ) : (
            <>
              {o.travas.map((t, i) => {
                const q = quandoTrava(t)
                return (
                  <div key={i} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 border-b border-[#f0f0ee] pb-2">
                    <span className="text-[13px] font-medium text-(--obra-text)">{t.descricao}</span>
                    <PilulaQuem quem={t.quem} />
                    <span className="text-[12px] text-(--obra-muted-texto)">{t.tipo} · desde <span className="obra-num">{ddmm(t.desde)}</span></span>
                    <span className={'text-right text-[12px] font-medium ' + (q.vencida ? 'text-(--obra-vermelho-texto)' : 'text-(--obra-muted-texto)')}>{q.texto}</span>
                  </div>
                )
              })}
              {o.semana?.ppc != null ? (
                <p className="text-[12px] text-(--obra-muted-texto)">PPC da semana: <span className="obra-num text-(--obra-text)">{pct(o.semana.ppc)}</span></p>
              ) : null}
            </>
          )}
        </div>

        <div className={cartao}>
          <h3 className={h3}>Sinais da relação com o cliente</h3>
          {o.sinais.map((s) => (
            <p key={s.chave} className="flex items-start gap-2 text-[13px] text-(--obra-text)">
              <Bolinha cor={TOM[s.tom].cor} tam={10} />
              <span><span className="font-medium" style={{ color: TOM[s.tom].texto }}>{TOM[s.tom].rotulo}</span> {s.texto}</span>
            </p>
          ))}
        </div>

        <div className={cartao}>
          <h3 className={h3}>Dinheiro da obra</h3>
          {d.ok ? (
            <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 text-[13px]">
              {linha('Valor da obra', d.valor === null ? 'Valor da obra não informado' : brl(d.valor))}
              {linha(`Faturado (${plural(d.notas, 'nota', 'notas')})`, brl(d.faturado))}
              {linha('A faturar', d.acimaDoValor ? 'faturado acima do valor' : d.aFaturar === null ? '—' : brl(d.aFaturar), true)}
              {linha('Custo realizado', brl(d.custoRealizado))}
              {linha('Custo comprometido', brl(d.custoComprometido))}
              {linha('Margem realizada', pctTexto(d.margemPct))}
            </dl>
          ) : (
            <p className="text-[13px] text-(--obra-muted-texto)">{SEM_VALOR[d.motivo]}</p>
          )}
          <div className="rounded-lg border border-dashed border-[#efd77a] bg-[#fdf6d8] px-3 py-2.5 text-[12px] text-(--obra-yellow-texto)">
            <p className="font-semibold">Orçado × realizado: ainda sem orçado</p>
            <p className="mt-0.5">Esta obra não tem orçado cadastrado. Quando o orçado da obra existir, aqui aparece o gasto comparado ao orçado e ao avanço.</p>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Link href={`/obras/obras/${o.id}`} className="text-[13px] font-semibold text-(--obra-ink) no-underline hover:text-(--obra-orange-texto)">
          Abrir a obra →
        </Link>
      </div>
    </div>
  )
}

function Linha({ o, aberta, alternar }: { o: ObraCarteira; aberta: boolean; alternar: () => void }) {
  const tp = o.travaPrincipal
  const curtos = o.sinais.filter((s) => s.curto)
  const q = tp ? quandoTrava(tp) : null
  const desvio = textoDesvio(o.desvioDiasUteis)
  return (
    <article className="overflow-hidden rounded-xl border bg-(--obra-card)" style={{ borderColor: o.sinal === 'vermelho' && o.estado.tipo !== 'faturando' ? '#efc2c2' : T.border }}>
      <button
        type="button"
        aria-expanded={aberta}
        aria-controls={`obra-${o.id}`}
        onClick={alternar}
        className={`grid ${COLUNAS} w-full cursor-pointer rounded-xl px-5 py-[18px] text-left hover:bg-[#fbfbfa]`}
      >
        <span className="block min-w-0">
          <span className="obra-num block text-[12px] text-(--obra-muted-texto)">OS {o.os ?? '—'}</span>
          <span className="block text-[16px] font-semibold text-(--obra-ink)">{o.loja ?? '—'}</span>
          <span className="block truncate text-[12px] text-(--obra-muted-texto)">{o.engenheiro ?? 'Engenheiro não informado'}</span>
        </span>

        <span className="flex flex-col items-start gap-1.5">
          <Rotulo>Situação</Rotulo>
          {o.estado.tipo === 'faturando' ? <PilulaExibida situacao="concluida" /> : <PilulaSinal sinal={o.sinal} />}
          <span className="text-[12px] font-medium text-(--obra-text)">{textoEstado(o.estado, o.dinheiro)}</span>
        </span>

        <span className="flex flex-col gap-[5px]">
          <Rotulo>Avanço e entrega</Rotulo>
          {(['Realizado', 'Previsto'] as const).map((r) => {
            const v = r === 'Realizado' ? o.realizado : o.previsto
            return (
              <span key={r} className="grid grid-cols-[62px_1fr_34px] items-center gap-1.5 text-[11px] text-(--obra-muted-texto)">
                {r}
                <Barra valor={v} cor={r === 'Realizado' ? T.orange : T.ink} />
                <span className="obra-num text-right text-(--obra-text)">{pct(v)}</span>
              </span>
            )
          })}
          <span className="text-[12px] text-(--obra-text)">
            Entrega{' '}
            <span className="obra-num">
              {o.terminoBase ? ddmm(o.terminoBase) : '—'}
              {o.terminoProjetado && o.terminoProjetado !== o.terminoBase ? ` → ${ddmm(o.terminoProjetado)}` : ''}
            </span>{' '}
            <span className={'font-medium ' + (desvio === 'mantida' ? 'text-(--obra-verde-texto)' : 'text-(--obra-vermelho-texto)')}>{desvio}</span>
          </span>
        </span>

        <span className="flex flex-col items-start gap-1.5">
          <Rotulo>Por que / quem destrava</Rotulo>
          <span className="text-[13px] text-(--obra-text)">{tp ? tp.descricao : 'Nada travando'}</span>
          {tp && q ? (
            <span className="flex flex-wrap items-center gap-1.5">
              <PilulaQuem quem={tp.quem} />
              <span className={'text-[12px] ' + (q.vencida ? 'text-(--obra-vermelho-texto)' : 'text-(--obra-muted-texto)')}>{q.texto}</span>
            </span>
          ) : null}
        </span>

        <span className="flex flex-col gap-1">
          <Rotulo>Relação com o cliente</Rotulo>
          {curtos.length === 0 ? (
            <span className="flex items-start gap-1.5 text-[12px] text-(--obra-text)"><Bolinha cor={T.verde} />Sem sinais ruins</span>
          ) : (
            curtos.map((s) => (
              <span key={s.chave} className="flex items-start gap-1.5 text-[12px] text-(--obra-text)">
                <Bolinha cor={TOM[s.tom].cor} />
                {s.curto}
              </span>
            ))
          )}
        </span>

        <span className="flex flex-col gap-[5px]">
          <Rotulo>Dinheiro</Rotulo>
          <DinheiroLinha d={o.dinheiro} />
        </span>

        <span aria-hidden="true" className="hidden justify-center text-(--obra-muted-texto) min-[1061px]:flex">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: aberta ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </button>
      {aberta ? <div id={`obra-${o.id}`}><Detalhe o={o} /></div> : null}
    </article>
  )
}

const fmtLido = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })

export default function TelaVisaoCeo({ obras, hoje, lidoEm }: { obras: ObraCarteira[]; hoje: string; lidoEm: string }) {
  const [filtro, setFiltro] = useState<FiltroCarteira>('todas')
  const [aberta, setAberta] = useState<string | null>(null)

  const ordenadas = ordenarCarteira(obras)
  const lista = filtrarCarteira(ordenadas, filtro)
  const travas = contarTravas(ordenadas)
  const excecoes = excecoesDoDia(ordenadas)
  const resumo = resumoCarteira(ordenadas)
  const sinalDe = new Map(ordenadas.map((o) => [o.id, o.sinal]))

  const s = resumo.porSinal
  const emAndamento = s.vermelho + s.amarelo + s.verde + s.sem
  const somadas = ordenadas.length - resumo.foraDasSomas
  const fora = resumo.foraDasSomas > 0
    ? <p className="text-[12px] text-(--obra-muted-texto)">{plural(resumo.foraDasSomas, 'obra fora das somas', 'obras fora das somas')} (valores indisponíveis)</p>
    : null

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6 lg:py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <SimboloManfac tamanho={40} />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.1em] text-(--obra-orange-texto) uppercase">Gestão de Obras</p>
            <h1 className="text-[26px] leading-tight font-semibold tracking-tight text-(--obra-ink)">Visão do CEO</h1>
            <p className="text-[13px] text-(--obra-muted-texto)">Todas as obras · só leitura</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <p className="obra-num text-[13px] text-(--obra-muted-texto)">{ddmm(hoje)}/{hoje.slice(0, 4)} · atualizado {fmtLido.format(new Date(lidoEm))}</p>
          <Link href="/obras/obras" className="text-[13px] font-semibold text-(--obra-ink) hover:text-(--obra-orange-texto)">← Lista de obras</Link>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 min-[561px]:grid-cols-2 min-[1061px]:grid-cols-4">
        <Quadro titulo="Como estão as obras">
          <p className="flex items-baseline gap-2">
            <span className="obra-num text-[28px] font-semibold text-(--obra-ink)">{emAndamento}</span>
            <span className="text-(--obra-muted-texto)">em andamento</span>
          </p>
          {emAndamento > 0 ? (
            <div aria-hidden="true" className="flex h-2 gap-0.5 overflow-hidden rounded-full">
              {s.vermelho ? <span style={{ flex: s.vermelho, background: T.vermelho }} /> : null}
              {s.amarelo ? <span style={{ flex: s.amarelo, background: T.yellow }} /> : null}
              {s.verde ? <span style={{ flex: s.verde, background: T.verde }} /> : null}
              {s.sem ? <span style={{ flex: s.sem, background: T.trilho }} /> : null}
            </div>
          ) : null}
          <p className="flex flex-wrap gap-x-3 gap-y-1 text-[12px]">
            <span className="text-(--obra-vermelho-texto)">{plural(s.vermelho, 'atrasada', 'atrasadas')}</span>
            <span className="text-(--obra-yellow-texto)">{s.amarelo} em atenção</span>
            <span className="text-(--obra-verde-texto)">{s.verde} no prazo</span>
            {s.sem ? <span className="text-(--obra-muted-texto)">{s.sem} sem cronograma</span> : null}
            {resumo.faturando ? <span className="text-(--obra-muted-texto)">{resumo.faturando} faturando</span> : null}
          </p>
        </Quadro>

        <Quadro titulo="Quem está segurando as obras">
          <div className="flex flex-col gap-1.5">
            {(['cliente', 'manfac', 'terceiros'] as const).map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setFiltro(q)}
                className="flex cursor-pointer items-center justify-between gap-2 py-0.5 text-left"
              >
                <PilulaQuem quem={q} />
                <span className="text-[12px] text-(--obra-muted-texto)">
                  <span className="obra-num font-semibold text-(--obra-text)">{travas[q].travas}</span> {travas[q].travas === 1 ? 'trava' : 'travas'} em{' '}
                  <span className="obra-num">{travas[q].obras}</span> {travas[q].obras === 1 ? 'obra' : 'obras'}
                </span>
              </button>
            ))}
          </div>
        </Quadro>

        <Quadro titulo="Faturamento da carteira">
          {somadas === 0 ? (
            <p className="text-[13px] text-(--obra-muted-texto)">Nenhuma obra com valores disponíveis.</p>
          ) : (
            <>
              <p className="flex flex-wrap items-baseline gap-2">
                <span className="obra-num text-[22px] font-semibold text-(--obra-ink)">{brl(resumo.faturado)}</span>
                <span className="text-(--obra-muted-texto)">faturados</span>
              </p>
              <Barra valor={resumo.valor > 0 ? resumo.faturado / resumo.valor : null} cor={T.ink} />
              <p className="text-[12px] text-(--obra-muted-texto)">
                <span className="obra-num font-semibold text-(--obra-text)">{brl(resumo.aFaturar)}</span> a faturar · carteira{' '}
                <span className="obra-num">{brl(resumo.valor)}</span>
              </p>
            </>
          )}
          {fora}
        </Quadro>

        <Quadro titulo="Gasto × orçado">
          {somadas === 0 ? (
            <p className="text-[13px] text-(--obra-muted-texto)">Nenhuma obra com valores disponíveis.</p>
          ) : (
            <p className="flex flex-wrap items-baseline gap-2">
              <span className="obra-num text-[22px] font-semibold text-(--obra-ink)">{brl(resumo.custoRealizado)}</span>
              <span className="text-(--obra-muted-texto)">de custo realizado</span>
            </p>
          )}
          <p className="rounded-lg border border-[#efd77a] bg-[#fdf6d8] px-2 py-1.5 text-[12px] text-(--obra-yellow-texto)">
            {ordenadas.length} de {plural(ordenadas.length, 'obra', 'obras')} ainda sem orçado. A comparação aparece quando o orçado da obra existir.
          </p>
          {fora}
        </Quadro>
      </div>

      <section aria-label="Precisa da sua atenção hoje" className="rounded-xl border border-(--obra-border) bg-(--obra-card) px-5 py-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-[16px] font-semibold text-(--obra-ink)">Precisa da sua atenção hoje</h2>
          <p className="text-[12px] text-(--obra-muted-texto)">Travas vencidas, obra parada, cliente sem resposta</p>
        </div>
        {excecoes.length === 0 ? (
          <p className="pt-3 text-[13px] text-(--obra-verde-texto)">Nada pedindo sua atenção hoje.</p>
        ) : (
          <div className="mt-1 flex flex-col">
            {excecoes.map((e, i) => {
              const sinal = sinalDe.get(e.obraId)
              return (
                <div key={i} className={i === 0 ? '' : 'border-t border-[#f0f0ee]'}>
                  <button
                    type="button"
                    onClick={() => { setFiltro('todas'); setAberta(e.obraId) }}
                    className="group grid w-full cursor-pointer grid-cols-[10px_1fr_auto] items-center gap-3 py-3 text-left"
                  >
                    <Bolinha cor={sinal ? COR_SINAL[sinal] : T.muted} tam={10} />
                    <span>
                      <span className="font-semibold text-(--obra-ink) group-hover:underline group-hover:decoration-(--obra-orange) group-hover:underline-offset-4">{e.obra}</span>{' '}
                      <span className="text-(--obra-text)">— {e.texto}</span>
                    </span>
                    {e.quem ? <PilulaQuem quem={e.quem} /> : <span />}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section aria-label="Obras" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[16px] font-semibold text-(--obra-ink)">
            Obras <span className="text-[13px] font-normal text-(--obra-muted-texto)">— piores primeiro</span>
          </h2>
          <div role="group" aria-label="Filtrar obras" className="flex flex-wrap gap-2">
            {FILTROS.map((f) => {
              const ativo = f.id === filtro
              return (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={ativo}
                  onClick={() => setFiltro(f.id)}
                  className={
                    'min-h-[34px] cursor-pointer rounded-full border px-3 py-1.5 text-[13px] ' +
                    (ativo ? 'border-(--obra-ink) bg-(--obra-ink) text-white' : 'border-(--obra-border) bg-white text-(--obra-text)')
                  }
                >
                  {f.rotulo} <span className="obra-num opacity-75">{filtrarCarteira(ordenadas, f.id).length}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div aria-hidden="true" className={`${COLUNAS} hidden px-5 text-[12px] font-medium text-(--obra-muted-texto) min-[1061px]:grid`}>
          <span>Obra</span><span>Situação</span><span>Avanço e entrega</span><span>Por que / quem destrava</span><span>Relação com o cliente</span><span>Dinheiro</span><span />
        </div>

        {lista.length === 0 ? (
          <p className="rounded-xl border border-dashed border-(--obra-border) bg-(--obra-card) p-6 text-center text-(--obra-muted-texto)">
            {obras.length === 0 ? 'Nenhuma obra na carteira.' : 'Nenhuma obra neste filtro.'}
          </p>
        ) : (
          lista.map((o) => (
            <Linha key={o.id} o={o} aberta={aberta === o.id} alternar={() => setAberta(aberta === o.id ? null : o.id)} />
          ))
        )}
      </section>

      <p className="text-[12px] text-(--obra-muted-texto)">Só leitura. Para agir, abra a obra. Valores de dinheiro só para quem pode ver valores.</p>
    </div>
  )
}
