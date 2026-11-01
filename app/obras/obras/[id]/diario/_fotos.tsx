'use client'

/**
 * Fotos do diário de obra: várias por dia, cada uma com legenda opcional.
 *
 * Mesma ordem do diário de SPOT (`app/obras/diario/_foto.tsx`): reduz no
 * aparelho (1600 px / JPEG 0,82), sobe direto do navegador para `obras-fotos`
 * e só depois registra a linha em `obras_rdo_foto`. Caminho
 * `{obra_id}/rdo/{data}/{uuid}.jpg` — uma foto nunca sobrescreve outra.
 *
 * A foto pertence a um RDO, então antes do primeiro upload o rascunho é salvo
 * (`garantirRdo`).
 *
 * Leva 6 — obra com mapa (`mapa` não nulo): dois modos, "Por ponto (ronda)" e
 * "Por atividade", e "+ Foto avulsa" escolhendo o ambiente; toda foto nova leva
 * ambiente (ou ponto, que define o ambiente). "Ronda incompleta (x de y)" só
 * avisa — nunca bloqueia validar. Obra sem mapa: a tela de sempre.
 */

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { reduzir } from '../../../diario/_foto'
import { rondaDoDia } from '../../_lib/mapa'
import { registrarFotoAction, removerFotoAction } from './_actions'
import type { FotoRdo, MapaDiario, VinculoFoto } from './_tipos'

const TAMANHO_MAXIMO_FOTO = 5 * 1024 * 1024
const campo = 'min-h-11 rounded-lg border border-[#dadad8] bg-[#ffffff] px-3 text-base text-[#333336]'
const dataCurta = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`

type PontoDiario = MapaDiario['pontos'][number]

export default function FotosDiario({
  obraId,
  data,
  fotos: iniciais,
  garantirRdo,
  onQuantidade,
  onRonda,
  desabilitado,
  mapa = null,
}: {
  obraId: string
  data: string
  fotos: FotoRdo[]
  garantirRdo: () => Promise<string | null>
  onQuantidade?: (n: number) => void
  /** Leva 6: ronda do dia (pontos ativos com foto), para o resumo do passo. */
  onRonda?: (r: { feitos: number; total: number } | null) => void
  desabilitado?: boolean
  mapa?: MapaDiario | null
}) {
  const input = useRef<HTMLInputElement>(null)
  const alvo = useRef<VinculoFoto>({})
  const [fotos, setFotos] = useState<FotoRdo[]>(iniciais)
  useEffect(() => onQuantidade?.(fotos.length), [fotos.length, onQuantidade])
  const [legenda, setLegenda] = useState('')
  const [enviando, setEnviando] = useState(0)
  const [erro, setErro] = useState<string | null>(null)
  const [modo, setModo] = useState<'ponto' | 'atividade'>('ponto')
  const [atividade, setAtividade] = useState('')
  const [ambienteAvulsa, setAmbienteAvulsa] = useState('')

  const ronda = mapa
    ? rondaDoDia(
        mapa.pontos.map((p) => ({ ...p, x: null, y: null, ativo: true })),
        fotos.map((f) => ({ pontoId: f.pontoId ?? null })),
      )
    : null
  const feitos = ronda?.feitos ?? null
  const total = ronda?.total ?? null
  useEffect(() => onRonda?.(feitos === null || total === null ? null : { feitos, total }), [feitos, total, onRonda])

  async function enviarUma(rdoId: string, arquivo: File, leg: string | null, vinculo: VinculoFoto) {
    if (!arquivo.type.startsWith('image/')) throw new Error('Escolha uma imagem.')
    const blob = await reduzir(arquivo)
    if (blob.type !== 'image/jpeg' || blob.size > TAMANHO_MAXIMO_FOTO) throw new Error('A foto precisa ser JPEG e ter até 5 MB.')
    const path = `${obraId}/rdo/${data}/${crypto.randomUUID()}.jpg`
    const bucket = createClient().storage.from('obras-fotos')
    const { error } = await bucket.upload(path, blob, { contentType: 'image/jpeg' })
    if (error) throw new Error('Não deu para enviar a foto. Tente de novo.')
    const r = mapa ? await registrarFotoAction(rdoId, path, leg, vinculo) : await registrarFotoAction(rdoId, path, leg)
    if (!r.ok) {
      // Registro recusado (ex.: o mapa mudou): tira o arquivo que acabou de subir, para não ficar órfão.
      await bucket.remove([path]).catch(() => undefined)
      throw new Error(r.erro)
    }
    setFotos((f) => [
      ...f,
      { id: r.fotoId!, path, legenda: leg, url: URL.createObjectURL(blob), ambienteId: vinculo.ambienteId ?? null, pontoId: vinculo.pontoId ?? null, atividadeNumero: vinculo.atividadeNumero ?? null },
    ])
  }

  async function escolher(lista: FileList | null) {
    const arquivos = Array.from(lista ?? [])
    if (input.current) input.current.value = ''
    if (!arquivos.length) return
    const vinculo = alvo.current
    setErro(null)
    setEnviando(arquivos.length)
    try {
      const rdoId = await garantirRdo()
      if (!rdoId) return
      const leg = legenda.trim() || null
      for (const a of arquivos) {
        try {
          await enviarUma(rdoId, a, leg, vinculo)
        } catch (e) {
          setErro(e instanceof Error ? e.message : 'Não deu para enviar a foto.')
        } finally {
          setEnviando((n) => n - 1)
        }
      }
      setLegenda('')
    } finally {
      setEnviando(0)
    }
  }

  /** Abre a câmera/galeria para a foto ir ao ponto/ambiente/atividade indicado. */
  function tirar(vinculo: VinculoFoto) {
    alvo.current = vinculo
    input.current?.click()
  }

  async function remover(id: string) {
    setErro(null)
    const r = await removerFotoAction(id)
    if (!r.ok) return setErro(r.erro)
    setFotos((f) => f.filter((x) => x.id !== id))
  }

  const nomeAmbiente = (id: string | null | undefined) => mapa?.ambientes.find((a) => a.id === id)?.nome ?? null
  const pontoDe = (id: string | null | undefined) => mapa?.pontos.find((p) => p.id === id) ?? null
  const fotosDoPonto = (id: string) => fotos.filter((f) => f.pontoId === id).length
  const ocupado = enviando > 0

  function linhaPonto(p: PontoDiario, atividadeNumero?: number) {
    const n = fotosDoPonto(p.id)
    return (
      <li key={p.id} className={`flex items-center gap-3 rounded-xl border bg-[#ffffff] p-2 ${n ? 'border-[#1f9d55]' : 'border-[#dadad8]'}`}>
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-[#eef2f6]">
          {p.referenciaUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.referenciaUrl} alt={`Última foto do ponto ${p.numero}`} className="h-full w-full object-cover" />
          ) : (
            <span className="obra-num flex h-full items-center justify-center font-bold text-[#00345e]">{p.numero}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[#00345e]">
            <span className="obra-num">Ponto {p.numero}</span> · {p.nome}
          </p>
          <p className="truncate text-xs text-[#5a7380]">
            {nomeAmbiente(p.ambienteId)}
            {n ? ` · ${n} foto(s) hoje` : p.referenciaData ? ` · mesmo ângulo de ${dataCurta(p.referenciaData)}` : ''}
          </p>
        </div>
        {!desabilitado ? (
          <button
            type="button"
            disabled={ocupado}
            onClick={() => tirar({ pontoId: p.id, ambienteId: p.ambienteId, atividadeNumero: atividadeNumero ?? null })}
            className="min-h-11 shrink-0 rounded-lg border border-[#b94606] px-3 text-sm font-semibold text-[#b94606] disabled:opacity-45"
          >
            {n ? 'Mais uma' : 'Tirar foto'}
          </button>
        ) : n ? (
          <span className="shrink-0 text-xs font-semibold text-[#136c38]">feito</span>
        ) : null}
      </li>
    )
  }

  const atividadeEscolhida = atividade ? Number(atividade) : null
  const ambientesDaAtividade = mapa && atividadeEscolhida !== null ? mapa.ambientes.filter((a) => a.atividades.includes(atividadeEscolhida)) : []

  return (
    <div className="flex flex-col gap-3">
      {fotos.length ? (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {fotos.map((f) => {
            const ponto = pontoDe(f.pontoId)
            const onde = ponto ? `P${ponto.numero}` : nomeAmbiente(f.ambienteId)
            return (
              <li key={f.id} className="overflow-hidden rounded-lg border border-[#dadad8] bg-[#ffffff]">
                {f.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={f.url} alt={f.legenda ?? 'Foto do diário'} className="aspect-[4/3] w-full object-cover" />
                ) : (
                  <div className="flex aspect-[4/3] items-center justify-center text-xs text-[#5a7380]">sem prévia</div>
                )}
                <div className="flex items-center justify-between gap-1 px-2 py-1.5">
                  <span className="truncate text-xs text-[#333336]">
                    {mapa && onde ? <span className="obra-num font-semibold text-[#00345e]">{onde} · </span> : null}
                    {f.legenda ?? '—'}
                  </span>
                  {!desabilitado ? (
                    <button
                      type="button"
                      onClick={() => remover(f.id)}
                      className="min-h-9 shrink-0 rounded px-2 text-xs text-[#b23232] hover:bg-[#d645451a]"
                    >
                      tirar
                    </button>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="text-sm text-[#5a7380]">Nenhuma foto ainda.</p>
      )}

      {ronda && ronda.total > 0 ? (
        <p role="status" className={`text-sm ${ronda.feitos < ronda.total ? 'text-[#7a5c00]' : 'text-[#136c38]'}`}>
          {ronda.feitos < ronda.total
            ? `Ronda incompleta (${ronda.feitos} de ${ronda.total}). Faltar ponto não bloqueia validar.`
            : `Ronda completa (${ronda.feitos} de ${ronda.total}).`}
        </p>
      ) : null}

      {!desabilitado ? (
        <label className="flex flex-col gap-1 text-xs text-[#5a7380]">
          Legenda da próxima foto (opcional)
          <input
            value={legenda}
            onChange={(e) => setLegenda(e.target.value)}
            placeholder="ex.: fachada, balcão, ponto 4"
            className={campo}
          />
        </label>
      ) : null}

      {mapa ? (
        <>
          <div role="group" aria-label="Como fotografar" className="flex flex-wrap gap-1">
            {(
              [
                ['ponto', 'Por ponto (ronda)'],
                ['atividade', 'Por atividade'],
              ] as const
            ).map(([v, r]) => (
              <button
                key={v}
                type="button"
                aria-pressed={modo === v}
                onClick={() => setModo(v)}
                className={`min-h-11 rounded-lg border px-3 text-sm ${
                  modo === v ? 'border-[#00345e] bg-[#00345e] text-white' : 'border-[#dadad8] bg-[#ffffff] text-[#00345e]'
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          {modo === 'ponto' ? (
            mapa.pontos.length ? (
              <ul aria-label="Pontos da ronda" className="flex flex-col gap-2">
                {mapa.pontos.map((p) => linhaPonto(p))}
              </ul>
            ) : (
              <p className="text-sm text-[#5a7380]">O mapa ainda não tem pontos de foto. Use a foto avulsa.</p>
            )
          ) : (
            <div className="flex flex-col gap-2">
              <label className="flex flex-col gap-1 text-xs text-[#5a7380]">
                Atividade
                <select value={atividade} onChange={(e) => setAtividade(e.target.value)} className={campo}>
                  <option value="">—</option>
                  {mapa.atividades.map((a) => (
                    <option key={a.numero} value={a.numero}>{a.numero} · {a.descricao}</option>
                  ))}
                </select>
              </label>
              {atividadeEscolhida !== null ? (
                ambientesDaAtividade.length ? (
                  ambientesDaAtividade.map((amb) => {
                    const pts = mapa.pontos.filter((p) => p.ambienteId === amb.id)
                    return (
                      <div key={amb.id} className="flex flex-col gap-2 rounded-xl border border-[#dadad8] p-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-[#00345e]">{amb.nome}</span>
                          {!desabilitado ? (
                            <button
                              type="button"
                              disabled={ocupado}
                              onClick={() => tirar({ ambienteId: amb.id, atividadeNumero: atividadeEscolhida })}
                              className="min-h-11 rounded-lg border border-[#dadad8] px-3 text-sm text-[#00345e] disabled:opacity-45"
                            >
                              Foto do ambiente
                            </button>
                          ) : null}
                        </div>
                        {pts.length ? (
                          <ul className="flex flex-col gap-2">
                            {pts.map((p) => linhaPonto(p, atividadeEscolhida))}
                          </ul>
                        ) : null}
                      </div>
                    )
                  })
                ) : (
                  <p className="text-sm text-[#5a7380]">Esta atividade não está ligada a nenhum ambiente do mapa. Use a foto avulsa.</p>
                )
              ) : null}
            </div>
          )}

          {!desabilitado ? (
            <div className="flex flex-col gap-2 rounded-xl border border-dashed border-[#dadad8] p-2">
              <label className="flex flex-col gap-1 text-xs text-[#5a7380]">
                Ambiente da foto avulsa
                <select value={ambienteAvulsa} onChange={(e) => setAmbienteAvulsa(e.target.value)} className={campo}>
                  <option value="">Escolha o ambiente</option>
                  {mapa.ambientes.map((a) => (
                    <option key={a.id} value={a.id}>{a.nome}</option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                disabled={ocupado}
                onClick={() => {
                  if (!ambienteAvulsa) return setErro('Escolha o ambiente da foto avulsa.')
                  tirar({ ambienteId: ambienteAvulsa, atividadeNumero: modo === 'atividade' ? atividadeEscolhida : null })
                }}
                className="min-h-12 rounded-xl border border-[#b94606] px-4 text-base font-semibold text-[#b94606] disabled:opacity-45"
              >
                {ocupado ? `enviando ${enviando} foto(s)…` : '+ Foto avulsa'}
              </button>
            </div>
          ) : null}
        </>
      ) : !desabilitado ? (
        <button
          type="button"
          disabled={ocupado}
          onClick={() => tirar({})}
          className="min-h-12 rounded-xl border border-[#b94606] px-4 text-base font-semibold text-[#b94606] disabled:opacity-45"
        >
          {ocupado ? `enviando ${enviando} foto(s)…` : 'Tirar ou escolher fotos'}
        </button>
      ) : null}

      {!desabilitado ? (
        <input ref={input} type="file" accept="image/*" multiple className="hidden" onChange={(e) => escolher(e.target.files)} />
      ) : null}
      {erro ? <p role="alert" className="text-sm text-[#b23232]">{erro}</p> : null}
    </div>
  )
}
