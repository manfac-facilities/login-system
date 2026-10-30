import Link from 'next/link'
import type { ObraGrande } from '../_lib/leitura'
import type { Responsavel } from '../_lib/cronograma'
import { curvaPlanejada, curvaRealizada, datasDaCurva, progressoPorPeriodo } from '../_lib/curvas'
import AvancoFisico from './avanco-fisico'
import BarrasPeriodo from './barras-periodo'
import { Cartao, dataBR, ddmm, num1, pct } from './cartao-painel'
import CurvaS from './curva-s'
import EvolucaoEtapas, { linhasDeEtapa } from './evolucao-etapas'
import { IconeAlerta, IconeCadeado, IconeCronograma } from './icones'
import Kpi, { Unidade } from './kpi'
import type { TomObra } from './tema'

/**
 * Painel da obra (spec Leva 1 §6), tema claro Manfac, tudo em % físico:
 * KPIs → avanço físico → curva S → progresso semanal/mensal → evolução por
 * etapa → blocos de acompanhamento (trava, atrasadas, impedimentos, diário).
 * Séries (§8.1-2): Base = planejada da v1, Previsto = planejada da vigente,
 * Realizado = histórico de status/diário.
 */
export type EstadoDiario = 'nao_iniciado' | 'rascunho' | 'validado' | 'enviado'

const ROTULO_DIARIO: Record<EstadoDiario, string> = {
  nao_iniciado: 'Não iniciado',
  rascunho: 'Rascunho',
  validado: 'Validado',
  enviado: 'Enviado',
}
const RESP: Record<Responsavel, string> = { cliente: 'Cliente', manfac: 'Manfac', terceiro: 'Terceiro', clima: 'Clima' }
const DE_RESP: Record<Responsavel, string> = {
  cliente: 'do cliente',
  manfac: 'da Manfac',
  terceiro: 'de terceiros',
  clima: 'do clima',
}
const ORDEM: Responsavel[] = ['cliente', 'manfac', 'terceiro', 'clima']

const diasEntre = (a: string, b: string) => Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000))
const dias = (n: number) => `${n} ${n === 1 ? 'dia' : 'dias'}`
const maior = (...ds: (string | null | undefined)[]) =>
  ds.reduce<string>((m, d) => (d && d > m ? d : m), '')
const unicas = (ds: string[]) => [...new Set(ds)].sort()

/** Grupo rotulado para o KPI (o leitor de tela anuncia o nome do cartão). */
function GrupoKpi({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={rotulo} className="min-w-0 [&>div]:h-full">
      {children}
    </div>
  )
}

export default function PainelObra({
  dados,
  hoje,
  estadoDiario,
  ultimoEnvio,
}: {
  dados: ObraGrande
  hoje: string
  estadoDiario: EstadoDiario
  ultimoEnvio: string | null
}) {
  const { obra, calc, calcBase, atraso, versaoVigente, rascunho, impedimentos, hist, feriados, dadosAte } = dados
  const raiz = `/obras/obras/${obra.id}`

  if (!calc) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-(--obra-border) bg-(--obra-card) px-6 py-12 text-center">
        <span className="text-(--obra-muted)">
          <IconeCronograma tamanho={32} />
        </span>
        <div>
          <p className="text-[16px] font-semibold text-(--obra-ink)">Esta OBRA ainda não tem cronograma.</p>
          <p className="mt-1 text-[13px] text-(--obra-muted-texto)">
            Os indicadores, a curva S e a evolução por etapa aparecem assim que houver um cronograma.
          </p>
        </div>
        <Link
          href={`${raiz}/cronograma`}
          className="inline-flex min-h-11 items-center rounded-lg bg-(--obra-ink) px-4 text-sm font-medium text-white hover:bg-(--obra-ink-escuro)"
        >
          Montar na aba Cronograma
        </Link>
      </div>
    )
  }

  const baseSalva = !!versaoVigente
  const atrasadas = calc.atividades.filter((a) => a.situacao === 'atrasada' || a.situacao === 'inicio_atrasado')
  const aguardando = calc.atividades.filter((a) => a.situacao === 'aguardando_cliente')
  const travadas = calc.atividades.filter((a) => a.travada)
  const abertos = impedimentos.filter((i) => i.categoria === 'impedimento' && !i.encerradoEm)
  const doCliente = abertos.filter((i) => i.responsavel === 'cliente').length
  const grupos = ORDEM.map((r) => ({ r, itens: abertos.filter((i) => i.responsavel === r) })).filter((g) => g.itens.length)

  // ---- Séries -------------------------------------------------------------
  const inicio =
    obra.data_base ?? calc.atividades.reduce((m, a) => (a.inicioPrevisto < m ? a.inicioPrevisto : m), calc.terminoPrevisto)
  const fim = maior(
    calc.terminoPrevisto,
    calcBase?.terminoPrevisto,
    dadosAte,
    hoje <= calc.terminoProjetado ? hoje : null,
    inicio,
  )
  const semanas = unicas([inicio, ...datasDaCurva(inicio, fim, 'semana')])
  const meses = unicas([inicio, ...datasDaCurva(inicio, fim, 'mes')])
  const series = (datas: string[]) => ({
    base: calcBase ? curvaPlanejada(calcBase.atividades, datas, feriados) : null,
    previsto: curvaPlanejada(calc.atividades, datas, feriados),
    realizado: curvaRealizada(calc.atividades, hist, datas),
  })
  const sSem = series(semanas)
  const sMes = series(meses)
  const periodos = (s: ReturnType<typeof series>) => progressoPorPeriodo(s.base ?? [], s.previsto, s.realizado)

  // ---- KPIs ---------------------------------------------------------------
  const desvio = calc.desvioPP
  const tomDesvio: TomObra = desvio < -5 ? 'negativo' : desvio < 0 ? 'atencao' : 'positivo'
  const partes = atraso
    ? ORDEM.filter((r) => atraso[r] > 0).map((r) => `${atraso[r]} ${DE_RESP[r]}`).join(', ')
    : ''
  const terminoBase = dados.terminoBase
  const mudouEntrega = !!terminoBase && terminoBase !== calc.terminoProjetado
  const dadosAteTxt = dadosAte ? `Dados até ${ddmm(dadosAte)}` : 'Dados até — (nenhum diário validado)'

  return (
    <div className="flex flex-col gap-4 lg:gap-5">
      {!baseSalva && rascunho ? (
        <div className="flex items-start gap-2 rounded-xl border border-[#efd77a] bg-[#fdf6d8] px-4 py-3 text-[14px] text-(--obra-text)">
          <span className="mt-0.5 text-(--obra-yellow-texto)">
            <IconeAlerta tamanho={16} />
          </span>
          <p>
            Base ainda não salva — os números abaixo vêm do rascunho.{' '}
            <Link href={`${raiz}/cronograma`} className="font-medium text-(--obra-ink) underline underline-offset-2">
              Abrir cronograma
            </Link>
          </p>
        </div>
      ) : null}

      {travadas.length ? (
        <div className="flex items-start gap-2 rounded-xl border border-[#c9c9c6] bg-[#ececea] px-4 py-3 text-[14px] text-(--obra-text)">
          <span className="mt-0.5 text-(--obra-muted-texto)">
            <IconeCadeado tamanho={16} />
          </span>
          <p>
            <span className="font-semibold">Trava ativa:</span> {travadas.map((a) => a.descricao).join(', ')} travadas até a
            atividade {obra.atividade_trava}
          </p>
        </div>
      ) : null}

      <section aria-label="Indicadores" className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <GrupoKpi rotulo="Avanço realizado">
          <Kpi rotulo="Avanço realizado" valor={pct(calc.realizado)} tom="destaque" sub={`previsto ${pct(calc.previsto)}`} />
        </GrupoKpi>
        <GrupoKpi rotulo="Desvio vs previsto">
          <Kpi
            rotulo="Desvio vs previsto"
            valor={
              <>
                {`${desvio > 0 ? '+' : desvio < 0 ? '−' : ''}${num1(Math.abs(desvio))}`}
                <Unidade> p.p.</Unidade>
              </>
            }
            tom={tomDesvio}
            sub={desvio < 0 ? 'abaixo do previsto' : desvio > 0 ? 'acima do previsto' : 'igual ao previsto'}
          />
        </GrupoKpi>
        <GrupoKpi rotulo="Dias vs base">
          {atraso ? (
            <Kpi
              rotulo="Dias vs base"
              valor={
                <>
                  {atraso.total > 0 ? `+${atraso.total}` : '0'}
                  <Unidade> {atraso.total === 1 ? 'dia' : 'dias'}</Unidade>
                  {partes ? <span className="sr-only">: </span> : null}
                </>
              }
              tom={atraso.total > 0 ? 'negativo' : 'positivo'}
              sub={partes || 'dentro do prazo da base'}
            />
          ) : (
            <Kpi rotulo="Dias vs base" valor="—" sub="Base ainda não salva" />
          )}
        </GrupoKpi>
        <GrupoKpi rotulo="Entrega prevista">
          <Kpi
            rotulo="Entrega prevista"
            valor={ddmm(calc.terminoProjetado)}
            tom={terminoBase && calc.terminoProjetado > terminoBase ? 'negativo' : 'neutro'}
            sub={
              mudouEntrega ? (
                <>
                  base <s className="obra-num">{dataBR(terminoBase!)}</s>
                </>
              ) : (
                <span className="obra-num">{dataBR(calc.terminoProjetado)}</span>
              )
            }
          />
        </GrupoKpi>
        <GrupoKpi rotulo="Impedimentos abertos">
          <Kpi
            rotulo="Impedimentos abertos"
            valor={abertos.length}
            tom={doCliente > 0 ? 'atencao' : 'neutro'}
            sub={`do cliente: ${doCliente}`}
          />
        </GrupoKpi>
      </section>

      <div className="grid gap-4 lg:grid-cols-3 lg:gap-5">
        <Cartao id="t-avanco" titulo="Avanço físico" sub={dadosAteTxt}>
          <AvancoFisico base={calcBase ? calcBase.previsto : null} previsto={calc.previsto} realizado={calc.realizado} />
        </Cartao>
        <Cartao
          id="t-curva"
          rotulado="figure"
          titulo="Curva S — avanço acumulado"
          sub={`Da data-base (${ddmm(inicio)}) ao término · ${dadosAteTxt}`}
          className="lg:col-span-2"
        >
          <CurvaS base={sSem.base} previsto={sSem.previsto} realizado={sSem.realizado} hoje={hoje} dadosAte={dadosAte} />
        </Cartao>
      </div>

      <div className="grid gap-4 lg:grid-cols-3 lg:gap-5">
        <Cartao
          id="t-periodo"
          rotulado="figure"
          titulo="Progresso por período"
          sub={`Pontos percentuais de avanço em cada período · ${dadosAteTxt}`}
          className="lg:col-span-2"
        >
          <BarrasPeriodo semanal={periodos(sSem)} mensal={periodos(sMes)} temBase={!!calcBase} />
        </Cartao>
        <Cartao id="t-imped" titulo={`Impedimentos abertos (${abertos.length})`} sub="Por responsável">
          {grupos.length ? (
            <div className="flex flex-col gap-4">
              {grupos.map((g) => (
                <div key={g.r}>
                  <h3 className="text-[11px] font-semibold tracking-[0.08em] text-(--obra-muted-texto) uppercase">
                    {RESP[g.r]} · {g.itens.length}
                  </h3>
                  <ul className="mt-1.5 flex flex-col gap-1.5 text-[14px] text-(--obra-text)">
                    {g.itens.map((i) => (
                      <li key={i.id} className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0">{i.descricao}</span>
                        <span className="obra-num shrink-0 text-[12px] text-(--obra-muted-texto)">
                          há {dias(diasEntre(i.abertoEm, hoje))}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[14px] text-(--obra-muted-texto)">Nenhum impedimento aberto.</p>
          )}
          <Link href={`${raiz}/impedimentos`} className="mt-auto text-[13px] font-medium text-(--obra-ink) underline underline-offset-2">
            Ver impedimentos
          </Link>
        </Cartao>
      </div>

      <div className="grid gap-4 lg:grid-cols-3 lg:gap-5">
        <Cartao
          id="t-etapas"
          titulo="Evolução por etapa"
          sub="Realizado (laranja) × previsto hoje (marcador) × base (tracejado) · Δ dias úteis do fim vs base"
          className="lg:col-span-2"
        >
          <EvolucaoEtapas linhas={linhasDeEtapa(dados.etapas, calc.atividades, calcBase?.atividades ?? null, feriados)} />
        </Cartao>

        <div className="flex min-w-0 flex-col gap-4 lg:gap-5">
          {baseSalva ? (
            <Cartao id="t-diario" titulo="Diário de hoje">
              <dl className="grid grid-cols-2 gap-3">
                <div>
                  <dt className="text-[11px] font-semibold tracking-[0.08em] text-(--obra-muted-texto) uppercase">Estado</dt>
                  <dd className="mt-0.5 text-[14px] text-(--obra-text)">{ROTULO_DIARIO[estadoDiario]}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold tracking-[0.08em] text-(--obra-muted-texto) uppercase">Último envio</dt>
                  <dd className="obra-num mt-0.5 text-[14px] text-(--obra-text)">{ultimoEnvio ? dataBR(ultimoEnvio) : '—'}</dd>
                </div>
              </dl>
              <Link
                href={`${raiz}/diario`}
                className="inline-flex min-h-11 items-center justify-center rounded-lg bg-(--obra-orange-texto) px-4 text-sm font-medium text-white hover:bg-[#9c3b05]"
              >
                Preencher diário de hoje
              </Link>
            </Cartao>
          ) : null}

          <Cartao id="t-atencao" titulo="Pedem atenção">
            <ListaAtividades titulo="Atividades atrasadas" itens={atrasadas} />
            <ListaAtividades titulo="Aguardando o cliente" itens={aguardando} />
          </Cartao>
        </div>
      </div>
    </div>
  )
}

function ListaAtividades({ titulo, itens }: { titulo: string; itens: { numero: number; descricao: string }[] }) {
  return (
    <div>
      <h3 className="text-[11px] font-semibold tracking-[0.08em] text-(--obra-muted-texto) uppercase">
        {titulo} · {itens.length}
      </h3>
      {itens.length ? (
        <ul className="mt-1.5 flex flex-col gap-1 text-[14px] text-(--obra-text)">
          {itens.map((a) => (
            <li key={a.numero}>
              <span className="obra-num text-(--obra-muted-texto)">{a.numero}.</span> {a.descricao}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-[14px] text-(--obra-muted-texto)">Nenhuma.</p>
      )}
    </div>
  )
}
