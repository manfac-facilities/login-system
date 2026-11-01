'use client'

/**
 * Quadro "Analista da obra" no painel (Leva 5 §7, Task 6): as perguntas
 * abertas do analista (responder em texto curto, marcar "não é para o
 * cliente") e a "Situação para o cliente" (montar com o agente, revisar,
 * editar e publicar). Nada vai ao cliente sem publicar. Só engenheiro da obra
 * ou administrador escreve; os demais leem.
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Cartao } from '../_ui/cartao-painel'
import { botaoPrincipal, botaoSecundario, campoCls, rotuloCls } from './comunicacao/_registro-form'
import { montarSituacaoAction, publicarSituacaoAction, responderPerguntaAction } from './_analista-actions'

export type PerguntaTela = {
  chave: string
  pergunta: string
  soInterno: boolean
  anterior: { resposta: string; interno: boolean } | null
}
export type AcaoTela = { oque: string; quando: string; efeito: string }
export type PublicadaTela = { versao: number; explicacao: string; acoes: AcaoTela[]; atualizadoEm: string; por: string }

const MAX_ACOES = 5
const acaoVazia = (): AcaoTela => ({ oque: '', quando: '', efeito: '' })

export default function QuadroAnalista({
  obraId,
  podeEditar,
  abertas,
  respondidas,
  publicada,
  ia,
}: {
  obraId: string
  podeEditar: boolean
  abertas: PerguntaTela[]
  respondidas: number
  publicada: PublicadaTela | null
  /** OPENAI_API_KEY configurada (senão o rascunho é simples). */
  ia: boolean
}) {
  const n = abertas.length
  return (
    <Cartao
      id="t-analista"
      titulo="Analista da obra"
      sub={`${n === 0 ? 'Nenhuma pergunta aberta' : n === 1 ? '1 pergunta aberta' : `${n} perguntas abertas`}${respondidas ? ` · ${respondidas} respondida${respondidas === 1 ? '' : 's'}` : ''}`}
    >
      {!podeEditar ? (
        <p className="text-[13px] text-(--obra-muted-texto)">Só o engenheiro responsável ou um administrador responde e publica.</p>
      ) : null}
      {n ? (
        <ul className="flex flex-col gap-4">
          {abertas.map((p) => (
            <li key={p.chave}>
              <Pergunta obraId={obraId} p={p} podeEditar={podeEditar} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[14px] text-(--obra-muted-texto)">Nada novo a explicar: os números não mudaram desde as últimas respostas.</p>
      )}
      <Situacao obraId={obraId} podeEditar={podeEditar} publicada={publicada} ia={ia} />
    </Cartao>
  )
}

function Pergunta({ obraId, p, podeEditar }: { obraId: string; p: PerguntaTela; podeEditar: boolean }) {
  const router = useRouter()
  const [texto, setTexto] = useState(p.anterior?.resposta ?? '')
  const [interno, setInterno] = useState(p.soInterno || !!p.anterior?.interno)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const id = `resp-${p.chave.replace(/[^A-Za-z0-9_-]/g, '-')}`

  async function salvar() {
    setOcupado(true)
    setErro(null)
    try {
      const r = await responderPerguntaAction(obraId, p.chave, texto, interno)
      if (r.ok) router.refresh()
      else setErro(r.erro)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-(--obra-border) p-3">
      <label htmlFor={id} className="text-[14px] font-medium text-(--obra-text)">
        {p.pergunta}
      </label>
      {p.anterior ? <p className="text-[12px] text-(--obra-muted-texto)">Os números mudaram desde a última resposta. Revise.</p> : null}
      <textarea
        id={id}
        className={`${campoCls} min-h-20 py-2`}
        value={texto}
        maxLength={2000}
        disabled={!podeEditar || ocupado}
        onChange={(e) => setTexto(e.target.value)}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="inline-flex min-h-11 items-center gap-2 text-[14px] text-(--obra-text)">
          <input
            type="checkbox"
            className="size-5"
            checked={interno}
            disabled={!podeEditar || ocupado || p.soInterno}
            onChange={(e) => setInterno(e.target.checked)}
          />
          Não é para o cliente
          {p.soInterno ? <span className="text-[12px] text-(--obra-muted-texto)">(dado que o cliente não vê)</span> : null}
        </label>
        {podeEditar ? (
          <button type="button" className={botaoSecundario} disabled={ocupado || !texto.trim()} onClick={salvar}>
            {ocupado ? 'Salvando…' : 'Salvar resposta'}
          </button>
        ) : null}
      </div>
      {erro ? (
        <p role="alert" className="text-[13px] text-[#b42318]">
          {erro}
        </p>
      ) : null}
    </div>
  )
}

function Situacao({ obraId, podeEditar, publicada, ia }: { obraId: string; podeEditar: boolean; publicada: PublicadaTela | null; ia: boolean }) {
  const router = useRouter()
  const [rascunho, setRascunho] = useState<{ explicacao: string; acoes: AcaoTela[] } | null>(null)
  const [ocupado, setOcupado] = useState<null | 'montar' | 'publicar'>(null)
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)

  async function montar() {
    setOcupado('montar')
    setMsg(null)
    try {
      const r = await montarSituacaoAction(obraId)
      if (r.ok) {
        setRascunho({ explicacao: r.situacao.explicacao, acoes: r.situacao.acoes.length ? r.situacao.acoes : [acaoVazia()] })
        setMsg({ ok: true, texto: r.origem === 'ia' ? 'Rascunho montado pelo agente. Revise antes de publicar.' : 'Rascunho simples com as respostas. Revise antes de publicar.' })
      } else setMsg({ ok: false, texto: r.erro })
    } finally {
      setOcupado(null)
    }
  }

  async function publicar() {
    if (!rascunho) return
    setOcupado('publicar')
    setMsg(null)
    try {
      const r = await publicarSituacaoAction(obraId, rascunho)
      if (r.ok) {
        setRascunho(null)
        setMsg({ ok: true, texto: 'Situação publicada. O cliente já vê na página da obra.' })
        router.refresh()
      } else setMsg({ ok: false, texto: r.erro })
    } finally {
      setOcupado(null)
    }
  }

  const editar = () =>
    setRascunho({ explicacao: publicada?.explicacao ?? '', acoes: publicada?.acoes.length ? publicada.acoes.map((a) => ({ ...a })) : [acaoVazia()] })
  const mudarAcao = (i: number, campo: keyof AcaoTela, v: string) =>
    setRascunho((r) => (r ? { ...r, acoes: r.acoes.map((a, k) => (k === i ? { ...a, [campo]: v } : a)) } : r))

  return (
    <section aria-labelledby="t-situacao-cliente" className="flex flex-col gap-3 border-t border-(--obra-border) pt-4">
      <h3 id="t-situacao-cliente" className="text-[14px] font-semibold text-(--obra-ink)">
        Situação para o cliente
      </h3>
      {publicada ? (
        <div className="flex flex-col gap-2 text-[14px] text-(--obra-text)">
          <p className="text-[12px] text-(--obra-muted-texto)">
            Publicada · versão {publicada.versao} · atualizado em <span className="obra-num">{publicada.atualizadoEm}</span> por {publicada.por}
          </p>
          <p className="leading-relaxed">{publicada.explicacao}</p>
          {publicada.acoes.length ? (
            <ul className="flex list-disc flex-col gap-1 pl-5">
              {publicada.acoes.map((a, i) => (
                <li key={i}>
                  {a.oque}
                  {a.quando ? ` · ${a.quando}` : ''}
                  {a.efeito ? ` · ${a.efeito}` : ''}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <p className="text-[14px] text-(--obra-muted-texto)">Nenhuma situação publicada. O cliente não vê este bloco até a primeira publicação.</p>
      )}

      {podeEditar && !rascunho ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" className={botaoPrincipal} disabled={!!ocupado} onClick={montar}>
            {ocupado === 'montar' ? 'Montando…' : 'Montar situação para o cliente'}
          </button>
          {publicada ? (
            <button type="button" className={botaoSecundario} disabled={!!ocupado} onClick={editar}>
              Editar a publicada
            </button>
          ) : null}
          {!ia ? <p className="w-full text-[12px] text-(--obra-muted-texto)">Sem IA neste servidor: o rascunho junta as respostas.</p> : null}
        </div>
      ) : null}

      {podeEditar && rascunho ? (
        <div className="flex flex-col gap-3">
          <label className={rotuloCls}>
            Explicação (2 a 4 frases, sem valores)
            <textarea
              className={`${campoCls} min-h-28 py-2`}
              value={rascunho.explicacao}
              maxLength={1200}
              onChange={(e) => setRascunho({ ...rascunho, explicacao: e.target.value })}
            />
          </label>
          <fieldset className="flex flex-col gap-2">
            <legend className="text-xs text-[#5a7380]">O que estamos fazendo para recuperar (até {MAX_ACOES})</legend>
            {rascunho.acoes.map((a, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[2fr_1fr_2fr_auto]">
                <input aria-label={`Ação ${i + 1}: o quê`} placeholder="O quê" className={campoCls} maxLength={200} value={a.oque} onChange={(e) => mudarAcao(i, 'oque', e.target.value)} />
                <input aria-label={`Ação ${i + 1}: quando`} placeholder="Quando" className={campoCls} maxLength={80} value={a.quando} onChange={(e) => mudarAcao(i, 'quando', e.target.value)} />
                <input aria-label={`Ação ${i + 1}: efeito esperado`} placeholder="Efeito esperado" className={campoCls} maxLength={200} value={a.efeito} onChange={(e) => mudarAcao(i, 'efeito', e.target.value)} />
                <button
                  type="button"
                  className={botaoSecundario}
                  aria-label={`Remover ação ${i + 1}`}
                  onClick={() => setRascunho({ ...rascunho, acoes: rascunho.acoes.filter((_, k) => k !== i) })}
                >
                  Remover
                </button>
              </div>
            ))}
            {rascunho.acoes.length < MAX_ACOES ? (
              <button type="button" className={`${botaoSecundario} self-start`} onClick={() => setRascunho({ ...rascunho, acoes: [...rascunho.acoes, acaoVazia()] })}>
                Adicionar ação
              </button>
            ) : null}
          </fieldset>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={botaoPrincipal} disabled={!!ocupado || !rascunho.explicacao.trim()} onClick={publicar}>
              {ocupado === 'publicar' ? 'Publicando…' : 'Publicar para o cliente'}
            </button>
            <button type="button" className={botaoSecundario} disabled={!!ocupado} onClick={() => setRascunho(null)}>
              Descartar rascunho
            </button>
          </div>
          <p className="text-[12px] text-(--obra-muted-texto)">Publicar cria uma nova versão; a anterior fica no histórico e não muda.</p>
        </div>
      ) : null}

      {msg ? (
        <p role={msg.ok ? 'status' : 'alert'} className={`text-[13px] ${msg.ok ? 'text-(--obra-muted-texto)' : 'text-[#b42318]'}`}>
          {msg.texto}
        </p>
      ) : null}
    </section>
  )
}
