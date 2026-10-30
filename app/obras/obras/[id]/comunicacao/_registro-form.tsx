'use client'

/**
 * Novo registro / edição (Leva 2 §3.1): tipo, data, participantes (um por
 * linha) e texto; na reunião, os campos do modelo de ata (pauta, decisões,
 * pendências o quê · responsável · prazo). Sem anexo: fica só registrado.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { criarRegistroAction, editarRegistroAction } from './_actions'
import { TIPOS_REGISTRO, type Pendencia, type RegistroEntrada, type TipoRegistroManual } from './_tipos'

export const campoCls = 'min-h-11 w-full rounded-lg border border-[#dadad8] bg-[#ffffff] px-3 text-base text-[#333336]'
export const rotuloCls = 'flex flex-col gap-1 text-xs text-[#5a7380]'
export const botaoPrincipal =
  'inline-flex min-h-11 items-center justify-center rounded-lg bg-[#00345e] px-4 text-sm font-semibold text-white disabled:opacity-50'
export const botaoSecundario =
  'inline-flex min-h-11 items-center justify-center rounded-lg border border-[#dadad8] px-3 text-sm font-semibold text-[#00345e] hover:border-[#b94606] disabled:opacity-50'

export function Chip({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      onClick={onClick}
      className={`min-h-11 rounded-full border px-3 text-sm ${
        ativo ? 'border-[#b94606] bg-[#b94606] font-semibold text-white' : 'border-[#dadad8] text-[#333336]'
      }`}
    >
      {children}
    </button>
  )
}

const pendenciaVazia = (): Pendencia => ({ oque: '', responsavel: '', prazo: null })

export default function FormRegistro({
  obraId,
  hoje,
  registroId,
  inicial,
  onFeito,
}: {
  obraId: string
  hoje: string
  /** Com id: edição. */
  registroId?: string
  inicial?: RegistroEntrada
  onFeito?: () => void
}) {
  const router = useRouter()
  const [tipo, setTipo] = useState<TipoRegistroManual>(inicial?.tipo ?? 'reuniao')
  const [data, setData] = useState(inicial?.data ?? hoje)
  const [participantes, setParticipantes] = useState(inicial?.participantes ?? '')
  const [texto, setTexto] = useState(inicial?.texto ?? '')
  const [pauta, setPauta] = useState(inicial?.ata?.pauta ?? '')
  const [decisoes, setDecisoes] = useState<string[]>(inicial?.ata?.decisoes.length ? inicial.ata.decisoes : [''])
  const [pendencias, setPendencias] = useState<Pendencia[]>(
    inicial?.ata?.pendencias.length ? inicial.ata.pendencias : [pendenciaVazia()],
  )
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const reuniao = tipo === 'reuniao'

  async function salvar() {
    setErro(null)
    setOk(false)
    setSalvando(true)
    try {
      const entrada: RegistroEntrada = {
        tipo,
        data,
        participantes,
        texto,
        ata: reuniao ? { pauta, decisoes, pendencias } : null,
      }
      const r = registroId
        ? await editarRegistroAction(obraId, registroId, entrada)
        : await criarRegistroAction(obraId, entrada)
      if (!r.ok) return setErro(r.erro)
      if (!registroId) {
        setOk(true)
        setParticipantes(''); setTexto(''); setPauta(''); setDecisoes(['']); setPendencias([pendenciaVazia()]); setData(hoje)
      }
      router.refresh()
      onFeito?.()
    } finally {
      setSalvando(false)
    }
  }

  const mudarPendencia = (i: number, campo: keyof Pendencia, v: string) =>
    setPendencias((ps) => ps.map((p, j) => (j === i ? { ...p, [campo]: campo === 'prazo' ? v || null : v } : p)))

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Tipo do registro">
        {TIPOS_REGISTRO.map((t) => (
          <Chip key={t.valor} ativo={tipo === t.valor} onClick={() => setTipo(t.valor)}>
            {t.rotulo}
          </Chip>
        ))}
      </div>

      <label className={rotuloCls}>
        Data
        <input type="date" value={data} max={hoje} onChange={(e) => setData(e.target.value)} className={`${campoCls} obra-num`} />
      </label>

      <label className={rotuloCls}>
        Participantes (um por linha)
        <textarea value={participantes} onChange={(e) => setParticipantes(e.target.value)} rows={3} className={`${campoCls} py-2`} />
      </label>

      {reuniao ? (
        <>
          <label className={rotuloCls}>
            Pauta
            <textarea value={pauta} onChange={(e) => setPauta(e.target.value)} rows={2} className={`${campoCls} py-2`} />
          </label>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-xs text-[#5a7380]">Decisões</legend>
            {decisoes.map((d, i) => (
              <div key={i} className="flex gap-2">
                <input
                  aria-label={`Decisão ${i + 1}`}
                  value={d}
                  onChange={(e) => setDecisoes((ds) => ds.map((x, j) => (j === i ? e.target.value : x)))}
                  className={campoCls}
                />
                {decisoes.length > 1 ? (
                  <button
                    type="button"
                    aria-label={`Tirar decisão ${i + 1}`}
                    onClick={() => setDecisoes((ds) => ds.filter((_, j) => j !== i))}
                    className={botaoSecundario}
                  >
                    Tirar
                  </button>
                ) : null}
              </div>
            ))}
            <button type="button" onClick={() => setDecisoes((ds) => [...ds, ''])} className={`${botaoSecundario} self-start`}>
              Mais uma decisão
            </button>
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-xs text-[#5a7380]">Pendências</legend>
            {pendencias.map((p, i) => (
              <div key={i} className="flex flex-col gap-2 rounded-lg border border-[#dadad8] p-2">
                <input aria-label={`Pendência ${i + 1}: o quê`} placeholder="O quê" value={p.oque}
                  onChange={(e) => mudarPendencia(i, 'oque', e.target.value)} className={campoCls} />
                <div className="flex gap-2">
                  <input aria-label={`Pendência ${i + 1}: responsável`} placeholder="Responsável" value={p.responsavel}
                    onChange={(e) => mudarPendencia(i, 'responsavel', e.target.value)} className={campoCls} />
                  <input aria-label={`Pendência ${i + 1}: prazo`} type="date" value={p.prazo ?? ''}
                    onChange={(e) => mudarPendencia(i, 'prazo', e.target.value)} className={`${campoCls} obra-num`} />
                </div>
                {pendencias.length > 1 ? (
                  <button type="button" onClick={() => setPendencias((ps) => ps.filter((_, j) => j !== i))}
                    className={`${botaoSecundario} self-start`}>
                    Tirar pendência
                  </button>
                ) : null}
              </div>
            ))}
            <button type="button" onClick={() => setPendencias((ps) => [...ps, pendenciaVazia()])} className={`${botaoSecundario} self-start`}>
              Mais uma pendência
            </button>
          </fieldset>
        </>
      ) : null}

      <label className={rotuloCls}>
        {reuniao ? 'Registro da reunião (opcional)' : 'O que foi tratado'}
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={4} className={`${campoCls} py-2`} />
      </label>

      {erro ? <p role="alert" className="text-sm text-[#b23232]">{erro}</p> : null}
      {ok ? <p role="status" className="text-sm text-[#136c38]">Registrado.</p> : null}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={salvar} disabled={salvando} className={botaoPrincipal}>
          {salvando ? 'Salvando…' : registroId ? 'Salvar alterações' : 'Registrar'}
        </button>
        {registroId && onFeito ? (
          <button type="button" onClick={onFeito} className={botaoSecundario}>
            Cancelar
          </button>
        ) : null}
      </div>
    </div>
  )
}
