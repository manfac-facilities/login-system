'use client'

/**
 * Importar a planilha de revisões: Arquivo → Colunas → Prévia → Pronto (spec 2026-11-03 §2).
 * Leitura no navegador (exceljs só no clique); a prévia usa a mesma `validarLinhas` da action,
 * que revalida tudo contra o banco antes de gravar.
 */
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Dialogo from '@/components/sofia/Dialogo'
import { dataBR } from '@/lib/sofia/correcoes'
import {
  CABECALHOS_MODELO, CAMPOS_IMPORTACAO, MAX_BYTES, MAX_LINHAS, contar, lerCsv, linhasParaGravar, mapeamentoValido,
  sugerirMapeamento, validarLinhas, type CampoImportacao, type ContextoImportacao, type LinhaImportada,
} from '@/lib/sofia/revisaoImportacao'
import { importarRevisoesAction } from './_actions'

const BTN = 'px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40'
const P = `${BTN} bg-[#f05a28] text-white hover:bg-[#d94e22]`
const S = `${BTN} border border-[#1e3a5f] text-[#e8eef7] hover:border-[#94a3b8]`
const CHIP = 'px-1.5 py-0.5 rounded text-[11px] font-medium'
const RES: Record<LinhaImportada['resultado'], [string, string]> = {
  ok: ['OK', 'bg-green-900 text-green-300'],
  aviso: ['Aviso', 'bg-amber-900 text-amber-300'],
  erro: ['Erro', 'bg-red-900 text-red-300'],
  dup: ['Repetida', 'bg-[#1e3a5f] text-[#94a3b8]'],
}
const PASSOS = ['Arquivo', 'Colunas', 'Prévia', 'Pronto']

type Celula = string | number | Date | null

/** Valor "plano" de uma célula do exceljs (fórmula, texto rico, link). */
function valorCelula(v: unknown): Celula {
  if (v == null) return null
  if (v instanceof Date || typeof v === 'number' || typeof v === 'string') return v
  if (typeof v === 'boolean') return String(v)
  if (typeof v === 'object') {
    const o = v as { result?: unknown; richText?: { text: string }[]; text?: unknown }
    if ('result' in o) return valorCelula(o.result)
    if (Array.isArray(o.richText)) return o.richText.map((t) => t.text).join('')
    if ('text' in o) return valorCelula(o.text)
  }
  return String(v)
}

async function lerArquivo(arq: File): Promise<Celula[][]> {
  if (arq.name.toLowerCase().endsWith('.csv')) return lerCsv(await arq.text())
  const { default: ExcelJS } = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(await arq.arrayBuffer())
  const ws = wb.worksheets[0]
  if (!ws) return []
  const out: Celula[][] = []
  ws.eachRow({ includeEmpty: false }, (row) => {
    const vals = (row.values as unknown[]).slice(1)
    out.push(vals.map(valorCelula))
  })
  return out
}

async function baixarXlsx(nome: string, aba: string, cabecalho: string[], linhas: Celula[][]) {
  const { default: ExcelJS } = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(aba)
  ws.addRow(cabecalho)
  ws.getRow(1).font = { bold: true }
  ws.addRows(linhas)
  ws.columns.forEach((c) => { c.width = 18 })
  const buf = (await wb.xlsx.writeBuffer()) as ArrayBuffer
  const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  a.click()
  URL.revokeObjectURL(url)
}

export default function ImportarRevisoes({ contexto, hoje }: { contexto: Omit<ContextoImportacao, 'hoje'>; hoje: string }) {
  const [aberto, setAberto] = useState(false)
  const [vez, setVez] = useState(0)
  return (
    <>
      <button type="button" className={S} onClick={() => { setVez((v) => v + 1); setAberto(true) }}>⇪ Importar planilha</button>
      {aberto && <Assistente key={vez} contexto={contexto} hoje={hoje} onFechar={() => setAberto(false)} />}
    </>
  )
}

function Assistente({ contexto, hoje, onFechar }: { contexto: Omit<ContextoImportacao, 'hoje'>; hoje: string; onFechar: () => void }) {
  const router = useRouter()
  const [passo, setPasso] = useState(1)
  const [nome, setNome] = useState<string | null>(null)
  const [tabela, setTabela] = useState<Celula[][]>([])
  const [mapa, setMapa] = useState<CampoImportacao[]>([])
  const [comAvisos, setComAvisos] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [feitas, setFeitas] = useState(0)

  const cabecalhos = (tabela[0] ?? []).map((c) => (c == null ? '' : String(c)))
  const dados = tabela.slice(1)
  const previa = useMemo(
    () => (passo >= 3 ? validarLinhas(dados, mapa, { ...contexto, hoje }) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [passo, tabela, mapa, contexto, hoje]
  )
  const n = contar(previa)
  const aGravar = linhasParaGravar(previa, comAvisos).length

  async function escolher(arq: File | undefined) {
    setErro(null)
    if (!arq) return
    if (arq.size > MAX_BYTES) return setErro('Arquivo grande demais (máximo 2 MB).')
    const ext = arq.name.toLowerCase()
    if (!ext.endsWith('.xlsx') && !ext.endsWith('.csv')) return setErro('Envie uma planilha .xlsx ou .csv.')
    setOcupado(true)
    try {
      const t = await lerArquivo(arq)
      if (t.length < 2) return setErro('A planilha não tem linhas além do cabeçalho.')
      if (t.length - 1 > MAX_LINHAS) return setErro(`Arquivo grande demais (máximo ${MAX_LINHAS.toLocaleString('pt-BR')} linhas).`)
      setTabela(t)
      setNome(arq.name)
      setMapa(sugerirMapeamento(t[0].map((c) => (c == null ? '' : String(c)))))
    } catch (e) {
      console.error(e)
      setErro('Não foi possível ler o arquivo. Confira se é uma planilha .xlsx ou .csv válida.')
    } finally {
      setOcupado(false)
    }
  }

  async function importar() {
    setErro(null)
    setOcupado(true)
    try {
      const r = await importarRevisoesAction(previa, comAvisos)
      if (r.error) return setErro(r.error)
      setFeitas(r.importadas ?? 0)
      setPasso(4)
      router.refresh()
    } catch (e) {
      console.error(e)
      setErro('Erro ao importar as revisões. Nada foi gravado.')
    } finally {
      setOcupado(false)
    }
  }

  const relatorio = () =>
    baixarXlsx(
      `revisoes-nao-importadas-${hoje}.xlsx`, 'Fora da importação', ['Linha', 'Placa', 'KM', 'Data', 'Motivo'],
      previa
        .filter((l) => l.resultado === 'erro' || l.resultado === 'dup' || (l.resultado === 'aviso' && !comAvisos))
        .map((l) => [l.linha, l.placa, l.km ?? l.kmTexto, l.data ? dataBR(l.data) : null, l.motivo])
    )

  const mapaOk = mapeamentoValido(mapa)
  const faltaObrigatorio = !(['placa', 'km', 'data'] as CampoImportacao[]).every((c) => mapa.includes(c))

  return (
    <Dialogo titulo="Importar a lista de revisões" onFechar={onFechar}>
      <ol className="mb-4 mt-2 flex flex-wrap gap-2 text-xs">
        {PASSOS.map((p, i) => (
          <li key={p} className={`rounded px-2 py-1 ${passo === i + 1 ? 'bg-[#f05a28] text-white' : passo > i + 1 ? 'bg-green-900 text-green-300' : 'bg-[#1e3a5f] text-[#94a3b8]'}`}>
            {i + 1} · {p}
          </li>
        ))}
      </ol>
      {erro && <div className="mb-3 rounded-lg border border-red-600 bg-red-950 px-3 py-2 text-sm text-red-300">{erro}</div>}

      {passo === 1 && (
        <>
          <p className="mb-3 text-sm text-[#94a3b8]">
            Envie a lista de revisões feitas (planilha .xlsx ou .csv). Colunas mínimas: Placa, KM da revisão, Data. Dá para repetir sem duplicar.
          </p>
          <div className="mb-4 rounded-lg border border-dashed border-[#1e3a5f] p-4 text-center text-sm text-[#94a3b8]">
            {nome ? <p className="mb-2 text-white">{nome} · {dados.length} linhas lidas · {cabecalhos.length} colunas</p> : <p className="mb-2">Nenhum arquivo escolhido</p>}
            <input type="file" accept=".xlsx,.csv" disabled={ocupado} onChange={(e) => escolher(e.target.files?.[0])}
              className="max-w-full text-sm text-[#94a3b8] file:mr-3 file:rounded-lg file:border-0 file:bg-[#1e3a5f] file:px-3 file:py-2 file:text-white" />
            <div className="mt-3">
              <button type="button" className={S} onClick={() => baixarXlsx('modelo-revisoes.xlsx', 'Revisões', CABECALHOS_MODELO, [])}>Baixar modelo</button>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className={S} onClick={onFechar}>Cancelar</button>
            <button type="button" className={P} disabled={!nome || ocupado} onClick={() => setPasso(2)}>{ocupado ? 'Lendo…' : 'Continuar'}</button>
          </div>
        </>
      )}

      {passo === 2 && (
        <>
          <p className="mb-3 text-sm text-[#94a3b8]">Diga o que cada coluna da planilha é. Já sugeri pelo nome do cabeçalho; ajuste se errei.</p>
          <div className="mb-3 max-h-72 overflow-auto rounded-lg border border-[#1e3a5f]">
            <table className="w-full text-sm">
              <thead><tr className="bg-[#0d2050] text-[#94a3b8]"><th className="px-3 py-2 text-left">Coluna da planilha</th><th className="px-3 py-2 text-left">Exemplo</th><th className="px-3 py-2 text-left">Vai para o campo</th></tr></thead>
              <tbody>
                {cabecalhos.map((h, i) => (
                  <tr key={i} className="border-t border-[#1e3a5f]">
                    <td className="px-3 py-2 text-white">{h || `(coluna ${i + 1})`}</td>
                    <td className="max-w-[120px] truncate px-3 py-2 text-[#4a6080]">{(() => { const v = dados[0]?.[i]; return v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? '') })()}</td>
                    <td className="px-3 py-2">
                      <select className="rounded-md border border-[#1e3a5f] bg-[#0a1628] px-2 py-1 text-sm text-[#e8eef7]" value={mapa[i] ?? 'ign'}
                        onChange={(e) => setMapa(mapa.map((m, j) => (j === i ? (e.target.value as CampoImportacao) : m)))}>
                        {CAMPOS_IMPORTACAO.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!mapaOk && (
            <p className="mb-3 text-sm text-red-300">
              {faltaObrigatorio ? 'Placa, KM e Data precisam estar ligados a uma coluna.' : 'Cada campo só pode estar ligado a uma coluna.'}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className={S} onClick={() => setPasso(1)}>Voltar</button>
            <button type="button" className={P} disabled={!mapaOk} onClick={() => setPasso(3)}>Ver prévia</button>
          </div>
        </>
      )}

      {passo === 3 && (
        <>
          <p className="mb-2 text-sm text-[#94a3b8]">
            <b className="text-white">{n.ok}</b> prontas · <b className="text-[#f05a28]">{n.aviso}</b> avisos · <b className="text-[#f05a28]">{n.erro}</b> erros · {n.dup} repetidas
          </p>
          <div className="mb-3 max-h-64 overflow-auto rounded-lg border border-[#1e3a5f]">
            <table className="w-full text-sm">
              <thead><tr className="bg-[#0d2050] text-[#94a3b8]"><th className="px-3 py-2 text-left">Placa</th><th className="px-3 py-2 text-right">KM</th><th className="px-3 py-2 text-left">Data</th><th className="px-3 py-2 text-left">Resultado</th></tr></thead>
              <tbody>
                {previa.map((l) => (
                  <tr key={l.linha} className="border-t border-[#1e3a5f]">
                    <td className="px-3 py-2 font-mono text-white">{l.placa || '—'}</td>
                    <td className="px-3 py-2 text-right font-mono text-[#94a3b8]">{l.kmTexto}</td>
                    <td className="px-3 py-2 text-[#94a3b8]">{l.data ? dataBR(l.data) : '—'}</td>
                    <td className="px-3 py-2"><span className={`${CHIP} ${RES[l.resultado][1]}`}>{RES[l.resultado][0]}</span> <span className="text-xs text-[#4a6080]">{l.motivo}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <label className="mb-2 flex items-start gap-2 text-sm text-[#e8eef7]">
            <input type="checkbox" className="mt-1" checked={comAvisos} onChange={(e) => setComAvisos(e.target.checked)} />
            <span>Importar também as linhas com aviso <span className="block text-xs text-[#4a6080]">Desmarcado: KM maior que o atual deslocaria a próxima revisão do carro.</span></span>
          </label>
          <p className="mb-3 text-xs text-[#4a6080]">
            Linhas com erro não entram.{' '}
            {(n.erro > 0 || n.dup > 0 || (n.aviso > 0 && !comAvisos)) && (
              <button type="button" className="text-[#f05a28] hover:underline" onClick={relatorio}>Baixar relatório de erros</button>
            )}
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className={S} onClick={() => setPasso(2)} disabled={ocupado}>Voltar</button>
            <button type="button" className={P} onClick={importar} disabled={ocupado || aGravar === 0}>
              {ocupado ? 'Importando…' : `Importar ${aGravar} ${aGravar === 1 ? 'revisão' : 'revisões'}`}
            </button>
          </div>
        </>
      )}

      {passo === 4 && (
        <>
          <div className="mb-4 rounded-lg border border-[#1e3a5f] p-4 text-center">
            <p className="text-lg font-semibold text-white">✓ {feitas} {feitas === 1 ? 'revisão importada' : 'revisões importadas'}</p>
            <p className="mt-1 text-sm text-[#94a3b8]">A previsão da próxima já foi calculada para os carros afetados.</p>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className={P} onClick={onFechar}>Ver na tela de revisões</button>
          </div>
        </>
      )}
    </Dialogo>
  )
}
