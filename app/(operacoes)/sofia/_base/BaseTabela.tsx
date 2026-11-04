'use client'

/**
 * Base em tabela do Frotas (padrão da Base da Gestão de Obras): filtros, tabela ordenável,
 * 20 por página, total no rodapé, "Exportar Excel" e gaveta de detalhe/ficha.
 * Mockup aprovado: docs/frotas/mockups/2026-10-30-mockup-segunda-bateria.html (2.1–2.4); bases novas
 * (rev, corr, multa, sin, doc): docs/frotas/mockups/2026-11-03-mockup-manutencao-e-bases.html (tela 3).
 * Filtros guiados por FILTROS_DA_BASE. Props opcionais (só client→client): `selecao`, `celula`,
 * `acoesDetalhe`, `cabecalhoExtra`. Clique num controle da linha não abre a gaveta.
 */

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import DeleteConfirmButton from '@/components/sofia/DeleteConfirmButton'
import { dataBR, fmtBrl, fmtKm, fmtLitros } from '@/lib/sofia/correcoes'
import { colunasDa, dataHoraSP, passouFranquia, retornoAtrasado, rodapeDa, SIT_LBL, type Tom } from '@/lib/sofia/bases/colunas'
import { descreverFiltros, filtrarLinhas, ordenarLinhas, paginar, type Ordem } from '@/lib/sofia/bases/filtro'
import { baixarExcel } from '@/lib/sofia/bases/exportar'
import {
  BASES_NOVAS, FILTROS_DA_BASE, FILTROS_VAZIOS,
  type AbastLinha, type BaseId, type FiltrosBase, type KmLinha, type Linha, type MotLinha, type RevLinha, type VeicLinha,
} from '@/lib/sofia/bases/tipos'
import CorrigirAbastecimentoButton from '../abastecimento/_corrigir'
import { deletarAbastecimentoAction } from '../abastecimento/_actions'
import CorrigirKmButton from '../km/_corrigir'
import { deletarKmAction } from '../km/_actions'
import { desativarMotoristaAction } from '../motoristas/_actions'
import DetalheNovas from './DetalheNovas'

export interface SelecaoBase {
  marcados: string[]
  onChange: (ids: string[]) => void
  /** linha que pode ser marcada (padrão: todas) */
  pode?: (r: Linha) => boolean
}

interface Props {
  base: BaseId
  nome: string
  linhas: Linha[]
  filtrosIniciais: FiltrosBase
  hoje: string
  podeGerir: boolean
  equipes: string[]
  placas: string[]
  motoristas: string[]
  /** sem ele, sem botão de registrar */
  novoHref?: string
  novoLabel?: string
  vazio: string
  placeholderBusca: string
  subtitulo?: string
  /** checkbox por linha; o do cabeçalho marca/desmarca só a página visível */
  selecao?: SelecaoBase
  /** sobrescreve uma célula (undefined = célula padrão) */
  celula?: (k: string, r: Linha) => React.ReactNode | undefined
  /** botões na gaveta das bases novas */
  acoesDetalhe?: (r: Linha) => React.ReactNode
  /** conteúdo entre o cabeçalho e os filtros (cartões) */
  cabecalhoExtra?: React.ReactNode
}

const CAMPO =
  'w-full rounded-md border border-[#1e3a5f] bg-[#0a1628] px-2 py-1.5 text-sm text-[#e8eef7] outline-none focus:border-[#f05a28]'
const BTN = 'px-4 py-2 rounded-lg text-sm font-medium transition-colors'
const CHIP = 'ml-2 px-1.5 py-0.5 rounded text-[10px] align-middle font-medium'

function Chip({ cor, children }: { cor: Tom; children: React.ReactNode }) {
  const c = {
    azul: 'bg-blue-900 text-blue-300', ambar: 'bg-amber-900 text-amber-300', vermelho: 'bg-red-900 text-red-300',
    verde: 'bg-green-900 text-green-300', cinza: 'bg-[#1e3a5f] text-[#94a3b8]',
  }[cor]
  return <span className={`${CHIP} ${c}`}>{children}</span>
}

function cnhChip(m: MotLinha) {
  if (m.cnhClasse === 'vencida') return <Chip cor="vermelho">vencida</Chip>
  if (m.cnhClasse === 'vencendo') return <Chip cor="ambar">vence em {m.cnhDias} dias</Chip>
  return null
}

/** Conteúdo extra (chips) de cada célula, além do texto da coluna. */
function extra(base: BaseId, k: string, r: Linha, hoje: string) {
  if (base === 'abast' && k === 'valor' && (r as AbastLinha).corrigido) return <Chip cor="azul">corrigido</Chip>
  if (base === 'km' && k === 'km' && (r as KmLinha).era != null) return <Chip cor="azul">corrigido</Chip>
  if (base === 'mot' && k === 'cnhVenc') return cnhChip(r as MotLinha)
  if (base === 'mot' && k === 'ativo') return null
  if (base === 'veic' && k === 'kmMes' && passouFranquia(r as VeicLinha)) return <Chip cor="vermelho">passou</Chip>
  if (base === 'veic' && k === 'retorno' && retornoAtrasado(r as VeicLinha, hoje)) return <Chip cor="vermelho">atrasado</Chip>
  if (base === 'rev' && k === 'proxKm' && (r as RevLinha).proxKm != null && (r as RevLinha).proxAuto) return <Chip cor="azul">auto</Chip>
  return null
}

const CHIP_SO = 'px-1.5 py-0.5 rounded text-[11px] font-medium whitespace-nowrap'
const TOM_CLS: Record<Tom, string> = {
  azul: 'bg-blue-900 text-blue-300', ambar: 'bg-amber-900 text-amber-300', vermelho: 'bg-red-900 text-red-300',
  verde: 'bg-green-900 text-green-300', cinza: 'bg-[#1e3a5f] text-[#94a3b8]',
}
const parar = (e: React.SyntheticEvent) => e.stopPropagation()

function Rotulo({ t, children }: { t: string; children: React.ReactNode }) {
  return (
    <label className="min-w-0">
      <span className="mb-1 block text-[11px] uppercase tracking-wide text-[#94a3b8]">{t}</span>
      {children}
    </label>
  )
}

export default function BaseTabela(props: Props) {
  const { base, nome, linhas, hoje, podeGerir } = props
  const [f, setF] = useState<FiltrosBase>(props.filtrosIniciais)
  const [ordem, setOrdem] = useState<Ordem | null>(null)
  const [pagina, setPagina] = useState(1)
  const [abertaId, setAbertaId] = useState<string | null>(null)
  const [exportando, setExportando] = useState(false)
  const [erroExport, setErroExport] = useState<string | null>(null)

  const cols = colunasDa(base)
  const filtradas = useMemo(() => ordenarLinhas(base, filtrarLinhas(base, linhas, f), ordem), [base, linhas, f, ordem])
  const pag = paginar(filtradas, pagina)
  const rodape = rodapeDa(base, filtradas)
  const aberta = abertaId ? linhas.find((l) => l.id === abertaId) ?? null : null

  useEffect(() => {
    if (!abertaId) return
    const h = (e: KeyboardEvent) => {
      // com o modal de Corrigir aberto por cima, Esc fecha só o modal
      if (e.key !== 'Escape' || document.querySelectorAll('[aria-modal="true"]').length > 0) return
      setAbertaId(null)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [abertaId])

  // Seleção em massa só vale para o que está na tela: qualquer mudança de filtro, busca, ordem ou página a zera.
  const limpaSelecao = () => { if (props.selecao?.marcados.length) props.selecao.onChange([]) }
  const irParaPagina = (n: number) => { limpaSelecao(); setPagina(n) }
  const muda = (parcial: Partial<FiltrosBase>) => { limpaSelecao(); setF({ ...f, ...parcial }); setPagina(1) }
  const clica = (k: string) => {
    limpaSelecao()
    setOrdem(ordem?.k === k ? { k, dir: ordem.dir === 1 ? -1 : 1 } : { k, dir: 1 })
    setPagina(1)
  }
  const exportar = async () => {
    setExportando(true)
    setErroExport(null)
    try {
      await baixarExcel(base, filtradas, hoje)
    } catch (e) {
      console.error(e)
      setErroExport('Não foi possível gerar a planilha. Tente de novo; se persistir, avise o suporte.')
    } finally {
      setExportando(false)
    }
  }
  const opcoes = (arr: string[], todos: string) => (
    <>
      <option value="">{todos}</option>
      {arr.map((x) => <option key={x} value={x}>{x}</option>)}
    </>
  )

  const semDados = linhas.length === 0
  const listas = { equipes: props.equipes, placas: props.placas, motoristas: props.motoristas }
  const { selecao, celula } = props
  const marcaveis = selecao ? pag.itens.filter((r) => selecao.pode?.(r) ?? true).map((r) => r.id) : []
  const todosMarcados = marcaveis.length > 0 && marcaveis.every((id) => selecao?.marcados.includes(id))
  const alternarPagina = () => {
    if (!selecao) return
    const fora = selecao.marcados.filter((id) => !marcaveis.includes(id))
    selecao.onChange(todosMarcados ? fora : [...fora, ...marcaveis])
  }
  const alternar = (id: string) => {
    if (!selecao) return
    selecao.onChange(selecao.marcados.includes(id) ? selecao.marcados.filter((x) => x !== id) : [...selecao.marcados, id])
  }

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">{nome}</h1>
          {props.subtitulo && <p className="mt-1 text-sm capitalize text-[#4a6080]">{props.subtitulo}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {props.novoHref && (
            <Link href={props.novoHref} className={`${BTN} bg-[#f05a28] text-white hover:bg-[#d94e22]`}>
              + {props.novoLabel}
            </Link>
          )}
          <button
            type="button"
            onClick={exportar}
            disabled={exportando || filtradas.length === 0}
            className={`${BTN} border border-[#1e3a5f] text-[#e8eef7] hover:border-[#94a3b8] disabled:opacity-40`}
          >
            {exportando ? 'Gerando…' : '⭳ Exportar Excel'}
          </button>
        </div>
      </div>
      {erroExport && (
        <div className="mb-4 rounded-lg border border-red-600 bg-red-950 px-4 py-3 text-sm text-red-300">{erroExport}</div>
      )}
      {props.cabecalhoExtra}

      {semDados ? (
        <div className="rounded-xl border border-dashed border-[#1e3a5f] px-4 py-12 text-center text-[#94a3b8]">
          <p className="mb-3">{props.vazio}</p>
          <p className="mb-4 text-sm text-[#4a6080]">Quando o primeiro registro entrar, ele aparece aqui.</p>
          {props.novoHref && (
            <Link href={props.novoHref} className={`${BTN} inline-block bg-[#f05a28] text-white hover:bg-[#d94e22]`}>+ {props.novoLabel}</Link>
          )}
        </div>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2">
              <Rotulo t="Buscar">
                <input type="search" className={CAMPO} value={f.q} placeholder={props.placeholderBusca} onChange={(e) => muda({ q: e.target.value })} />
              </Rotulo>
            </div>
            {FILTROS_DA_BASE[base].map((c) => {
              if (c.k === 'periodo') {
                return (
                  <div key="periodo" className="contents">
                    <Rotulo t="De"><input type="date" className={CAMPO} value={f.de} onChange={(e) => muda({ de: e.target.value })} /></Rotulo>
                    <Rotulo t="Até"><input type="date" className={CAMPO} value={f.ate} onChange={(e) => muda({ ate: e.target.value })} /></Rotulo>
                  </div>
                )
              }
              if ('lista' in c) {
                return (
                  <Rotulo key={c.k} t={c.t}>
                    <select className={CAMPO} value={f[c.k]} onChange={(e) => muda({ [c.k]: e.target.value })}>{opcoes(listas[c.lista], c.todos)}</select>
                  </Rotulo>
                )
              }
              return (
                <Rotulo key={c.k} t={c.t}>
                  <select className={CAMPO} value={f[c.k]} onChange={(e) => muda({ [c.k]: e.target.value })}>
                    <option value="">{c.todos}</option>
                    {c.opcoes.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </Rotulo>
              )
            })}
          </div>

          {filtradas.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#1e3a5f] px-4 py-12 text-center text-[#94a3b8]">
              <p className="mb-1">Nenhum resultado com estes filtros.</p>
              <p className="mb-4 text-sm text-[#4a6080]">{descreverFiltros(base, f)}</p>
              <button type="button" className={`${BTN} border border-[#1e3a5f] hover:border-[#94a3b8]`} onClick={() => { limpaSelecao(); setF({ ...FILTROS_VAZIOS }); setPagina(1) }}>
                Limpar filtros
              </button>
            </div>
          ) : (
            <>
              <p className="mb-2 text-xs text-[#4a6080]">
                {podeGerir ? 'Clique na linha para ver e corrigir.' : 'Clique na linha para ver o detalhe.'}
              </p>
              <div className="overflow-x-auto rounded-xl border border-[#1e3a5f]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#1e3a5f] bg-[#0d2050]">
                      {selecao && (
                        <th className="w-10 px-3 py-3">
                          <input type="checkbox" aria-label="Marcar a página" checked={todosMarcados} disabled={marcaveis.length === 0} onChange={alternarPagina} />
                        </th>
                      )}
                      {cols.map((c) => (
                        <th key={c.k} aria-sort={ordem?.k === c.k ? (ordem.dir === 1 ? 'ascending' : 'descending') : 'none'} className={`px-4 py-3 font-medium text-[#94a3b8] ${c.r ? 'text-right' : 'text-left'}`}>
                          <button type="button" onClick={() => clica(c.k)} className="whitespace-nowrap hover:text-white">
                            {c.t}{ordem?.k === c.k ? (ordem.dir === 1 ? ' ▲' : ' ▼') : ''}
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pag.itens.map((r) => (
                      <tr
                        key={r.id}
                        tabIndex={0}
                        onClick={() => setAbertaId(r.id)}
                        onKeyDown={(e) => e.key === 'Enter' && setAbertaId(r.id)}
                        className="cursor-pointer border-b border-[#1e3a5f] transition-colors hover:bg-[#0d2050] focus:bg-[#0d2050] focus:outline-none"
                      >
                        {selecao && (
                          <td className="w-10 px-3 py-3" onClick={parar} onKeyDown={parar}>
                            {(selecao.pode?.(r) ?? true) && (
                              <input type="checkbox" aria-label="Marcar" checked={selecao.marcados.includes(r.id)} onChange={() => alternar(r.id)} />
                            )}
                          </td>
                        )}
                        {cols.map((c, i) => {
                          const cls = `px-4 py-3 ${c.r ? 'text-right font-mono' : ''} ${i === 0 || c.k === 'placa' || c.k === 'nome' ? 'text-white' : 'text-[#94a3b8]'}`
                          const propria = celula?.(c.k, r)
                          if (propria !== undefined) {
                            return <td key={c.k} className={cls} onClick={parar} onKeyDown={parar}>{propria}</td>
                          }
                          const tom = c.tom?.(r)
                          return (
                            <td key={c.k} className={cls}>
                              {tom ? <span className={`${CHIP_SO} ${TOM_CLS[tom]}`}>{c.texto(r)}</span> : c.texto(r)}
                              {extra(base, c.k, r, hoje)}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-[#0d2050] font-medium text-white">
                      {(() => {
                        const idx = cols.findIndex((c) => c.k in rodape.colunas)
                        const span = idx === -1 ? cols.length : idx
                        return (
                          <>
                            <td className="px-4 py-3" colSpan={span + (selecao ? 1 : 0)}>{rodape.resumo}</td>
                            {cols.slice(span).map((c) => (
                              <td key={c.k} className={`px-4 py-3 ${c.r ? 'text-right font-mono' : ''}`}>{rodape.colunas[c.k] ?? ''}</td>
                            ))}
                          </>
                        )
                      })()}
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#4a6080]">
                <span>Mostrando {pag.de}–{pag.ate} de {filtradas.length.toLocaleString('pt-BR')} · {descreverFiltros(base, f)}</span>
                <span className="flex gap-2">
                  <button type="button" disabled={pag.pagina <= 1} onClick={() => irParaPagina(pag.pagina - 1)} className="rounded-lg border border-[#1e3a5f] px-3 py-1.5 text-[#94a3b8] hover:border-[#94a3b8] disabled:opacity-40">‹</button>
                  <span className="px-2 py-1.5">{pag.pagina} / {pag.totalPaginas}</span>
                  <button type="button" disabled={pag.pagina >= pag.totalPaginas} onClick={() => irParaPagina(pag.pagina + 1)} className="rounded-lg border border-[#1e3a5f] px-3 py-1.5 text-[#94a3b8] hover:border-[#94a3b8] disabled:opacity-40">›</button>
                </span>
              </div>
            </>
          )}
        </>
      )}

      {aberta && (
        <Gaveta onFechar={() => setAbertaId(null)} titulo={tituloGaveta(base, aberta, nome)}>
          {BASES_NOVAS.includes(base)
            ? <DetalheNovas base={base} r={aberta} hoje={hoje} podeGerir={podeGerir} acoes={props.acoesDetalhe?.(aberta)} />
            : <Detalhe base={base} r={aberta} hoje={hoje} podeGerir={podeGerir} />}
        </Gaveta>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- gaveta

function tituloGaveta(base: BaseId, r: Linha, nome: string): string {
  if (BASES_NOVAS.includes(base)) return `${nome} · ${(r as { placa: string }).placa}`
  if (base === 'abast') return `Abastecimento · ${(r as AbastLinha).placa} · ${dataBR((r as AbastLinha).data)}`
  if (base === 'km') return `KM diário · ${(r as KmLinha).placa} · ${dataBR((r as KmLinha).data)}`
  if (base === 'mot') return (r as MotLinha).nome
  return `Ficha do veículo · ${(r as VeicLinha).placa}`
}

function Gaveta({ titulo, onFechar, children }: { titulo: string; onFechar: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60" onClick={onFechar}>
      <aside
        role="dialog"
        aria-label={titulo}
        className="h-full w-full max-w-[520px] overflow-y-auto border-l border-[#1e3a5f] bg-[#0a1628] p-5 pb-12"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="font-semibold text-white">{titulo}</h2>
          <button type="button" onClick={onFechar} className="rounded-lg border border-[#1e3a5f] px-3 py-1 text-sm text-[#94a3b8] hover:border-[#94a3b8]">Fechar</button>
        </div>
        {children}
      </aside>
    </div>
  )
}

function Kv({ itens }: { itens: [string, React.ReactNode][] }) {
  return (
    <dl className="mb-4 grid grid-cols-[130px_1fr] gap-x-3 gap-y-2 text-sm">
      {itens.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-[#4a6080]">{k}</dt>
          <dd className="text-[#e8eef7]">{v ?? '—'}</dd>
        </div>
      ))}
    </dl>
  )
}

const hora = dataHoraSP

function Detalhe({ base, r, hoje, podeGerir }: { base: BaseId; r: Linha; hoje: string; podeGerir: boolean }) {
  const aviso = (
    <p className="mt-3 rounded-lg border border-[#1e3a5f] bg-[#0d2050] px-3 py-2 text-sm text-[#94a3b8]">
      Só gestores de frotas corrigem ou excluem lançamentos. Se algo estiver errado, avise o gestor.
    </p>
  )

  if (base === 'abast') {
    const a = r as AbastLinha
    return (
      <>
        <Kv itens={[
          ['Data', dataBR(a.data)], ['Placa', `${a.placa}${a.modelo ? ` · ${a.modelo}` : ''}`],
          ['Equipe no dia', a.equipe], ['Motorista no dia', a.motorista],
          ['Litros', a.litros == null ? null : fmtLitros(a.litros)],
          ['Valor', `${fmtBrl(a.valor)}${a.preco == null ? '' : ` (${fmtLitros(a.preco)} por litro)`}`],
          ['KM no painel', a.km == null ? 'não informado' : fmtKm(a.km)], ['Posto', a.posto], ['Lançado em', hora(a.criado)],
        ]} />
        {a.corrigido && <p className="mb-3 rounded-lg border border-blue-800 bg-blue-950 px-3 py-2 text-sm text-blue-300">Este lançamento foi corrigido pelo gestor. O antes/depois está em Auditoria.</p>}
        {podeGerir ? (
          <div className="flex flex-wrap items-center gap-4">
            {a.contexto && (
              <CorrigirAbastecimentoButton
                abastecimento={{ id: a.id, data: a.data, placa: a.placa, posto: a.posto, litros: a.litros, valor: a.valor, km: a.km }}
                contexto={a.contexto}
              />
            )}
            <DeleteConfirmButton action={deletarAbastecimentoAction} id={a.id} label="Excluir" itemLabel={`abastecimento de ${a.placa} — ${fmtBrl(a.valor)}`} />
          </div>
        ) : aviso}
      </>
    )
  }

  if (base === 'km') {
    const k = r as KmLinha
    return (
      <>
        <Kv itens={[
          ['Data', dataBR(k.data)], ['Equipe', k.equipe], ['Placa', k.placa], ['Motorista', k.motorista],
          ['KM informado', fmtKm(k.km) + (k.era != null ? ` (era ${fmtKm(k.era)})` : '')],
          ['Rodou desde o anterior', k.rodado == null ? null : `${fmtKm(k.rodado)} km`],
          ['Observações', k.obs], ['Lançado em', hora(k.criado)],
        ]} />
        {podeGerir ? (
          <div className="flex flex-wrap items-center gap-4">
            {k.contexto && (
              <CorrigirKmButton
                lancamento={{ id: k.id, data: k.data, km_atual: k.km, equipe: k.equipe ?? '—', placa: k.placa, motorista: k.motorista }}
                contexto={k.contexto}
                kmVeiculoAtual={k.veiculoKmAtual}
              />
            )}
            <DeleteConfirmButton action={deletarKmAction} id={k.id} label="Excluir" itemLabel={`lançamento de KM de ${dataBR(k.data)} — ${fmtKm(k.km)} km`} />
          </div>
        ) : aviso}
      </>
    )
  }

  if (base === 'mot') {
    const m = r as MotLinha
    return (
      <>
        <Kv itens={[
          ['Equipe atual', m.equipe ?? 'sem equipe'], ['CNH', m.cnh],
          ['Vencimento da CNH', m.cnhVenc ? <>{dataBR(m.cnhVenc)}{cnhChip(m)}</> : null],
          ['Contato', m.contato], ['Situação', m.ativo ? 'Ativo' : 'Inativo'],
        ]} />
        <div className="flex flex-wrap items-center gap-4">
          <Link href={`/sofia/motoristas/${m.id}`} className="text-sm text-[#f05a28] hover:underline">Abrir cadastro e documentos →</Link>
          {podeGerir && m.ativo && (
            <DeleteConfirmButton action={desativarMotoristaAction} id={m.id} label="Desativar" itemLabel={`o motorista ${m.nome}`} />
          )}
        </div>
      </>
    )
  }

  const v = r as VeicLinha
  return (
    <>
      <Kv itens={[
        ['Modelo', `${v.modelo}${v.ano ? ` ${v.ano}` : ''}`], ['Situação', SIT_LBL[v.sit]],
        ['Equipe / motorista', v.equipe ? `${v.equipe}${v.motorista ? ` · ${v.motorista}` : ''}` : null],
        ['KM atual', fmtKm(v.km)], ['Franquia', v.franquia == null ? null : `${fmtKm(v.franquia)} km/mês`],
        ['Rodou no mês', v.kmMes == null ? null : `${fmtKm(v.kmMes)} km${passouFranquia(v) ? ' (passou da franquia)' : ''}`],
        ['Locação', v.locacao == null ? null : `${fmtBrl(v.locacao)}/mês`],
        ['Volta da oficina', v.retorno ? `${dataBR(v.retorno)}${retornoAtrasado(v, hoje) ? ' (atrasado)' : ''}` : null],
        ['Carro substituto', v.substituto],
      ]} />
      <h3 className="mb-2 text-sm font-semibold text-white">Histórico carro × equipe × motorista</h3>
      <ul className="mb-4 space-y-1 border-l border-[#1e3a5f] pl-3 text-sm text-[#94a3b8]">
        {v.historico.length === 0 && <li>Nunca esteve com uma equipe.</li>}
        {v.historico.map((h, i) => (
          <li key={i} className={h.fim ? '' : 'text-white'}>
            {dataBR(h.inicio)} → {h.fim ? dataBR(h.fim) : 'hoje'} · <b>{h.equipe ?? 'sem equipe'}</b> · {h.motorista ?? 'sem motorista'}
          </li>
        ))}
      </ul>
      <h3 className="mb-2 text-sm font-semibold text-white">Últimos KM</h3>
      <ul className="mb-4 space-y-1 border-l border-[#1e3a5f] pl-3 text-sm text-[#94a3b8]">
        {v.ultimosKm.length === 0 && <li>Sem lançamentos.</li>}
        {v.ultimosKm.map((k, i) => <li key={i}>{dataBR(k.data)} · {fmtKm(k.km)} km</li>)}
      </ul>
      <h3 className="mb-2 text-sm font-semibold text-white">Últimos abastecimentos</h3>
      <ul className="mb-4 space-y-1 border-l border-[#1e3a5f] pl-3 text-sm text-[#94a3b8]">
        {v.ultimosAbast.length === 0 && <li>Sem abastecimentos.</li>}
        {v.ultimosAbast.map((a, i) => <li key={i}>{dataBR(a.data)} · {a.litros == null ? '—' : fmtLitros(a.litros)} L · {fmtBrl(a.valor)}</li>)}
      </ul>
      <Link href={`/sofia/veiculos/${v.id}`} className="text-sm text-[#f05a28] hover:underline">Abrir ficha completa →</Link>
    </>
  )
}
