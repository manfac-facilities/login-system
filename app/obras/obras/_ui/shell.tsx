'use client'

import { useState, type ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ObraRow } from '../../_lib/tipos'
import type { Sinal } from '../_lib/cronograma'
import type { VersaoInfo } from '../_lib/leitura'
import {
  IconeCalendario,
  IconeCamadas,
  IconeComunicacao,
  IconeConfiguracoes,
  IconeCronograma,
  IconeDiario,
  IconeDocumentos,
  IconeImpedimento,
  IconeLookahead,
  IconeMais,
  IconePainel,
  IconeTrocar,
  IconeVoltar,
} from './icones'
import { PilulaSinal } from './pilula-situacao'

/**
 * Shell das páginas da obra (`/obras/obras/[id]/**`, spec Leva 1 §4 e §8.1-6).
 *
 * Desktop (≥1024px): sidebar azul de 240px com a logo branca, o seletor da obra,
 * a navegação e o rodapé "← Gestão de Obras". Celular: barra superior curta e
 * menu inferior (Painel, Cronograma, Diário, Impedimentos, Mais), alvos ≥ 44px.
 * As duas variantes vão no HTML e o CSS escolhe; `estreito` força o celular
 * (testes e prévias).
 *
 * As abas escuras do Gestão de Obras não aparecem aqui — o layout de /obras as
 * esconde nesta subárvore (`app/obras/_ui/fora-do-shell-obra.tsx`).
 */

export type ObraDoShell = Pick<ObraRow, 'id' | 'os' | 'loja' | 'cliente' | 'descricao'>

type Item = { sufixo: string; rotulo: string; Icone: (p: { tamanho?: number }) => ReactNode }

const ITENS: Item[] = [
  { sufixo: '', rotulo: 'Painel', Icone: IconePainel },
  { sufixo: '/cronograma', rotulo: 'Cronograma', Icone: IconeCronograma },
  { sufixo: '/diario', rotulo: 'Diário', Icone: IconeDiario },
  { sufixo: '/impedimentos', rotulo: 'Impedimentos', Icone: IconeImpedimento },
  { sufixo: '/comunicacao', rotulo: 'Comunicação', Icone: IconeComunicacao },
]
/** Só administrador vê (a tela e as actions também exigem admin). */
const ITEM_CONFIGURACOES: Item = { sufixo: '/configuracoes', rotulo: 'Configurações', Icone: IconeConfiguracoes }
const EM_BREVE: Item[] = [
  { sufixo: '/lookahead', rotulo: 'Lookahead', Icone: IconeLookahead },
  { sufixo: '/documentos', rotulo: 'Documentos', Icone: IconeDocumentos },
]
/** No celular, os 4 primeiros vão no menu inferior; o resto no "Mais". */
const NO_MENU_INFERIOR = 4

/**
 * Telas da obra que já têm o visual claro (sufixos de ITENS). As demais ainda
 * são escuras por dentro e recebem um painel escuro para continuarem legíveis
 * até serem redesenhadas — cada tarefa que redesenhar uma tela a inclui aqui.
 */
const TELAS_CLARAS = new Set<string>(['', '/cronograma', '/diario', '/impedimentos', '/comunicacao', '/configuracoes'])

const GESTAO_DE_OBRAS = '/obras/base'

const fmtDia = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' })
const fmtDiaHora = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
})

/** `YYYY-MM-DD` → "dd/mm"; timestamp ISO → "dd/mm hh:mm" (horário de Brasília). */
export function dataCurta(iso: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
  return fmtDiaHora.format(new Date(iso)).replace(',', '')
}

export function rotuloVersao(v: VersaoInfo | null): string {
  if (!v) return 'Base ainda não salva'
  const quando = v.salvaEm ? ` em ${fmtDia.format(new Date(v.salvaEm))}` : ''
  return v.numero === 1 ? `v1 · base salva${quando}` : `v${v.numero} · reprogramada${quando}`
}

export default function ShellObra({
  obra,
  sinal,
  dadosAte,
  versao,
  admin = false,
  estreito = false,
  raiz: raizProp,
  children,
}: {
  obra: ObraDoShell
  sinal: Sinal | null
  dadosAte?: string | null
  versao: VersaoInfo | null
  /** Mostra o item Configurações (só administrador). */
  admin?: boolean
  estreito?: boolean
  /** Rota-raiz das seções; padrão `/obras/obras/<id>` (a prévia usa outra). */
  raiz?: string
  children: ReactNode
}) {
  const pathname = usePathname() ?? ''
  const raiz = raizProp ?? `/obras/obras/${obra.id}`
  const atual = (i: Item) =>
    i.sufixo === '' ? pathname === raiz : pathname === raiz + i.sufixo || pathname.startsWith(raiz + i.sufixo + '/')
  const itens = admin ? [...ITENS, ITEM_CONFIGURACOES] : ITENS
  const itemAtual = itens.find(atual)
  const telaClara = itemAtual ? TELAS_CLARAS.has(itemAtual.sufixo) : true
  const nome = obra.loja ?? 'Obra'
  const linhaObra = [obra.os ? `OS ${obra.os}` : null, obra.cliente].filter(Boolean).join(' · ')

  // `estreito` desliga as variantes de desktop (lg:) para simular o celular.
  const so = (classes: string) => (estreito ? '' : ' ' + classes)

  return (
    <div className={'flex min-h-screen bg-(--obra-surface)' + so('lg:flex-row')}>
      <a
        href="#conteudo-obra"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:text-(--obra-ink)"
      >
        Pular para o conteúdo
      </a>

      {estreito ? null : (
        <aside className="obra-escuro hidden w-[240px] shrink-0 flex-col bg-(--obra-ink) text-white lg:sticky lg:top-0 lg:flex lg:h-screen">
          <div className="px-5 pt-6 pb-5">
            <Link href="/obras/obras" aria-label="Manfac Engenharia — todas as obras" className="inline-block">
              <Image src="/logo-white.png" alt="" width={146} height={40} priority />
            </Link>
          </div>

          <div className="px-3">
            <Link
              href="/obras/obras"
              aria-label={`Trocar de obra (atual: ${nome})`}
              className="group flex items-center gap-3 rounded-lg border border-white/12 bg-white/[0.06] px-3 py-2.5 transition-colors duration-150 hover:bg-white/10"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-white/70">Obra</span>
                <span className="block truncate text-[14px] font-semibold leading-5">{nome}</span>
                {linhaObra ? <span className="block truncate text-[12px] leading-4 text-white/75">{linhaObra}</span> : null}
              </span>
              <IconeTrocar tamanho={16} className="shrink-0 text-white/70 group-hover:text-white" />
            </Link>
          </div>

          <nav aria-label="Seções da obra" className="mt-6 flex-1 overflow-y-auto px-3">
            <ul className="flex flex-col gap-0.5">
              {itens.map((i) => {
                const ativo = atual(i)
                return (
                  <li key={i.sufixo}>
                    <Link
                      href={raiz + i.sufixo}
                      aria-current={ativo ? 'page' : undefined}
                      className={
                        'relative flex min-h-11 items-center gap-3 rounded-lg px-3 text-[14px] transition-colors duration-150 ' +
                        (ativo
                          ? 'bg-white/12 font-semibold text-white before:absolute before:top-2.5 before:bottom-2.5 before:left-0 before:w-[3px] before:rounded-full before:bg-(--obra-orange)'
                          : 'text-white/80 hover:bg-white/[0.06] hover:text-white')
                      }
                    >
                      <i.Icone tamanho={18} />
                      {i.rotulo}
                    </Link>
                  </li>
                )
              })}
            </ul>
            <p className="mt-6 mb-1 px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-white/60">
              Planejamento
            </p>
            <ul className="flex flex-col gap-0.5">
              {EM_BREVE.map((i) => (
                <li key={i.sufixo}>
                  <span
                    aria-disabled="true"
                    className="flex min-h-11 cursor-not-allowed items-center gap-3 rounded-lg px-3 text-[14px] text-white/60"
                  >
                    <i.Icone tamanho={18} />
                    <span className="flex-1">{i.rotulo}</span>
                    <span className="rounded border border-white/25 px-1.5 py-px text-[10px] font-medium uppercase tracking-wide">
                      em breve
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </nav>

          <div className="border-t border-white/10 px-3 py-3">
            <Link
              href={GESTAO_DE_OBRAS}
              className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-[13px] text-white/80 transition-colors duration-150 hover:bg-white/[0.06] hover:text-white"
            >
              <IconeVoltar tamanho={16} />
              Gestão de Obras
            </Link>
          </div>
        </aside>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Barra do celular: logo + trocar de obra. */}
        <div
          className={
            'obra-escuro flex h-14 items-center justify-between gap-3 bg-(--obra-ink) px-4 text-white' + so('lg:hidden')
          }
        >
          <Link href="/obras/obras" aria-label="Manfac Engenharia — todas as obras" className="flex items-center">
            <Image src="/logo-white.png" alt="" width={106} height={29} />
          </Link>
          <Link
            href="/obras/obras"
            className="flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-[13px] text-white/85 hover:text-white"
          >
            <IconeTrocar tamanho={15} />
            Trocar obra
          </Link>
        </div>

        <header className="obra-blueprint border-b border-(--obra-border) bg-(--obra-card)">
          <div
            className={
              'flex flex-col gap-3 px-4 py-5 sm:px-6' + so('lg:flex-row lg:items-end lg:justify-between lg:gap-6 lg:px-8 lg:py-6')
            }
          >
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-(--obra-orange-texto)">
                {itemAtual?.rotulo ?? 'Obra'}
              </p>
              <h1 className="mt-0.5 text-[24px] leading-tight font-semibold tracking-tight text-(--obra-ink) sm:text-[28px]">
                {nome}
              </h1>
              <p className="mt-1 text-[13px] text-(--obra-muted-texto)">
                {linhaObra || 'OS e cliente não informados'}
                {obra.descricao ? <span className="hidden sm:inline"> · {obra.descricao}</span> : null}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-(--obra-text)">
              <PilulaSinal sinal={sinal} />
              <span className="inline-flex items-center gap-1.5">
                <IconeCalendario tamanho={15} className="text-(--obra-muted)" />
                <span className="obra-num">{dadosAte ? `Dados até ${dataCurta(dadosAte)}` : 'Sem dados de campo ainda'}</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <IconeCamadas tamanho={15} className="text-(--obra-muted)" />
                <span className="obra-num">{rotuloVersao(versao)}</span>
              </span>
            </div>
          </div>
        </header>

        <main id="conteudo-obra" className={'flex-1 px-4 pt-5 pb-28 sm:px-6' + so('lg:px-8 lg:pt-6 lg:pb-10')}>
          {telaClara ? (
            children
          ) : (
            <div className="rounded-xl bg-[#0a1628] p-3 text-white sm:p-5">{children}</div>
          )}
        </main>
      </div>

      <MenuInferior itens={itens} raiz={raiz} atual={atual} estreito={estreito} />
    </div>
  )
}

function MenuInferior({
  raiz,
  atual,
  estreito,
  itens,
}: {
  itens: Item[]
  raiz: string
  atual: (i: Item) => boolean
  estreito: boolean
}) {
  const [aberto, setAberto] = useState(false)
  const principais = itens.slice(0, NO_MENU_INFERIOR)
  const resto = itens.slice(NO_MENU_INFERIOR)
  const maisAtivo = resto.some(atual)
  const fechar = () => setAberto(false)

  const celula =
    'relative flex min-h-14 w-full flex-col items-center justify-center gap-0.5 text-[11px] leading-4 transition-colors duration-150'
  const indicador =
    ' before:absolute before:top-0 before:left-1/2 before:h-[3px] before:w-8 before:-translate-x-1/2 before:rounded-b-full before:bg-(--obra-orange)'

  return (
    <nav
      aria-label="Seções da obra (menu inferior)"
      className={
        'menu-inferior fixed inset-x-0 bottom-0 z-40 border-t border-(--obra-border) bg-white pb-[env(safe-area-inset-bottom)]' +
        (estreito ? '' : ' lg:hidden')
      }
    >
      {aberto ? (
        <>
          <div aria-hidden className="fixed inset-0 -z-10 bg-[#00345e]/30" onClick={fechar} />
          <div
            id="obra-mais"
            className="absolute inset-x-0 bottom-full rounded-t-2xl border-t border-(--obra-border) bg-white px-3 pt-3 pb-2 shadow-[0_-8px_24px_rgba(0,52,94,0.12)]"
            onKeyDown={(e) => {
              if (e.key === 'Escape') fechar()
            }}
          >
            <ul className="flex flex-col">
              {resto.map((i) => (
                <li key={i.sufixo}>
                  <Link
                    href={raiz + i.sufixo}
                    onClick={fechar}
                    aria-current={atual(i) ? 'page' : undefined}
                    className="flex min-h-12 items-center gap-3 rounded-lg px-3 text-[15px] text-(--obra-ink) hover:bg-(--obra-surface) aria-[current=page]:font-semibold"
                  >
                    <i.Icone tamanho={20} />
                    {i.rotulo}
                  </Link>
                </li>
              ))}
              {EM_BREVE.map((i) => (
                <li key={i.sufixo}>
                  <span
                    aria-disabled="true"
                    className="flex min-h-12 items-center gap-3 px-3 text-[15px] text-(--obra-muted-texto)"
                  >
                    <i.Icone tamanho={20} />
                    <span className="flex-1">{i.rotulo}</span>
                    <span className="rounded border border-(--obra-border) px-1.5 py-px text-[10px] font-medium uppercase tracking-wide">
                      em breve
                    </span>
                  </span>
                </li>
              ))}
              <li className="mt-1 border-t border-(--obra-border) pt-1">
                <Link
                  href={GESTAO_DE_OBRAS}
                  onClick={fechar}
                  className="flex min-h-12 items-center gap-3 rounded-lg px-3 text-[15px] text-(--obra-text) hover:bg-(--obra-surface)"
                >
                  <IconeVoltar tamanho={20} />
                  Gestão de Obras
                </Link>
              </li>
            </ul>
          </div>
        </>
      ) : null}

      <ul className="grid grid-cols-5">
        {principais.map((i) => {
          const ativo = atual(i)
          return (
            <li key={i.sufixo}>
              <Link
                href={raiz + i.sufixo}
                aria-current={ativo ? 'page' : undefined}
                className={
                  celula +
                  (ativo ? ' font-semibold text-(--obra-orange-texto)' + indicador : ' text-(--obra-muted-texto) hover:text-(--obra-ink)')
                }
              >
                <i.Icone tamanho={22} />
                {i.rotulo}
              </Link>
            </li>
          )
        })}
        <li>
          <button
            type="button"
            aria-expanded={aberto}
            aria-controls="obra-mais"
            onClick={() => setAberto((a) => !a)}
            className={
              celula +
              (aberto || maisAtivo
                ? ' font-semibold text-(--obra-orange-texto)' + (maisAtivo ? indicador : '')
                : ' text-(--obra-muted-texto) hover:text-(--obra-ink)')
            }
          >
            <IconeMais tamanho={22} />
            Mais
          </button>
        </li>
      </ul>
    </nav>
  )
}
