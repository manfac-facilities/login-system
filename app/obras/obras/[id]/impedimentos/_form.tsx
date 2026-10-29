'use client'

/**
 * Formulário de impedimento / orientação (Task 9a). Usado na aba "Impedimentos"
 * e no passo 4 do diário (com `rdoId`). Impedimento é genérico: o responsável
 * (cliente, Manfac, terceiro, clima) é sempre escolhido, sugerido pelo tipo.
 */

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { reduzir } from '../../../diario/_foto'
import { abrirImpedimentoAction, ligarDescumprimentoAction, registrarOrientacaoAction } from './_actions'
import {
  RESPONSAVEIS,
  TIPOS_IMPEDIMENTO,
  exibirAoClientePadrao,
  responsavelPadrao,
  type ResponsavelImp,
} from './_tipos'

export type OrientacaoOpcao = { id: string; descricao: string; abertoEm: string }
export type AtividadeOpcao = { numero: number; descricao: string }

const campo = 'min-h-11 rounded-lg border border-[#1e3a5f] bg-[#0a1628] px-3 text-base text-[#e8eef7]'

function Chip({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      onClick={onClick}
      className={`min-h-11 rounded-full border px-3 text-sm ${
        ativo ? 'border-[#f05a28] bg-[#f05a28] font-semibold text-white' : 'border-[#1e3a5f] text-[#e8eef7]'
      }`}
    >
      {children}
    </button>
  )
}

export default function FormImpedimento({
  obraId,
  rdoId = null,
  atividades,
  orientacoes,
}: {
  obraId: string
  rdoId?: string | null
  atividades: AtividadeOpcao[]
  orientacoes: OrientacaoOpcao[]
}) {
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [modo, setModo] = useState<'impedimento' | 'orientacao'>('impedimento')
  const [tipo, setTipo] = useState<string | null>(null)
  const [responsavel, setResponsavel] = useState<ResponsavelImp | null>(null)
  const [exibir, setExibir] = useState<boolean | null>(null) // null = padrão do responsável
  const [atividade, setAtividade] = useState('')
  const [descricao, setDescricao] = useState('')
  const [pessoa, setPessoa] = useState('')
  const [trava, setTrava] = useState(false)
  const [impacto, setImpacto] = useState('')
  const [orientacaoId, setOrientacaoId] = useState('')
  const [foto, setFoto] = useState<File | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  const exibirEfetivo = exibir ?? (modo === 'orientacao' ? true : exibirAoClientePadrao(responsavel))

  function escolherTipo(t: string) {
    setTipo(t)
    const r = responsavelPadrao(t)
    if (r) setResponsavel(r)
  }

  async function salvar() {
    setErro(null)
    setOk(false)
    setSalvando(true)
    try {
      let fotoPath: string | null = null
      if (foto) {
        const blob = await reduzir(foto)
        if (blob.type !== 'image/jpeg' || blob.size > 5 * 1024 * 1024) {
          return setErro('A foto precisa ser JPEG e ter até 5 MB.')
        }
        fotoPath = `${obraId}/impedimento/${crypto.randomUUID()}.jpg`
        const { error } = await createClient().storage.from('obras-fotos').upload(fotoPath, blob, { contentType: 'image/jpeg' })
        if (error) return setErro('Não deu para enviar a foto. Tente de novo.')
      }
      const comum = {
        descricao,
        pessoaCliente: pessoa || null,
        atividadeNumero: atividade ? Number(atividade) : null,
        fotoPath,
        exibirAoCliente: exibirEfetivo,
        rdoId,
      }
      if (modo === 'orientacao') {
        const r = await registrarOrientacaoAction(obraId, comum)
        if (!r.ok) return setErro(r.erro)
      } else {
        const r = await abrirImpedimentoAction(obraId, {
          ...comum,
          tipo,
          responsavel,
          travaAtividade: trava,
          impactoDias: !trava && impacto ? Number(impacto.replace(',', '.')) : null,
        })
        if (!r.ok) return setErro(r.erro)
        if (tipo === 'Orientação descumprida' && orientacaoId && r.id) {
          const l = await ligarDescumprimentoAction(r.id, orientacaoId)
          if (!l.ok) return setErro(`Impedimento registrado, mas não foi possível ligar a orientação: ${l.erro}`)
        }
      }
      setOk(true)
      setTipo(null); setResponsavel(null); setExibir(null); setAtividade(''); setDescricao('')
      setPessoa(''); setTrava(false); setImpacto(''); setOrientacaoId(''); setFoto(null)
      if (input.current) input.current.value = ''
      router.refresh()
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <Chip ativo={modo === 'impedimento'} onClick={() => setModo('impedimento')}>Impedimento</Chip>
        <Chip ativo={modo === 'orientacao'} onClick={() => setModo('orientacao')}>Orientação do cliente</Chip>
      </div>

      {modo === 'impedimento' ? (
        <>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Tipo">
            {TIPOS_IMPEDIMENTO.map((t) => (
              <Chip key={t} ativo={tipo === t} onClick={() => escolherTipo(t)}>{t}</Chip>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Responsável">
            <span className="text-xs text-[#94a3b8]">Responsável</span>
            {RESPONSAVEIS.map((r) => (
              <Chip key={r.valor} ativo={responsavel === r.valor} onClick={() => setResponsavel(r.valor)}>{r.rotulo}</Chip>
            ))}
          </div>
          {tipo === 'Orientação descumprida' && orientacoes.length ? (
            <label className="flex flex-col gap-1 text-xs text-[#94a3b8]">
              Qual orientação foi descumprida?
              <select value={orientacaoId} onChange={(e) => setOrientacaoId(e.target.value)} className={campo}>
                <option value="">—</option>
                {orientacoes.map((o) => (
                  <option key={o.id} value={o.id}>{o.abertoEm.slice(8, 10)}/{o.abertoEm.slice(5, 7)} · {o.descricao.slice(0, 50)}</option>
                ))}
              </select>
            </label>
          ) : null}
        </>
      ) : null}

      <label className="flex flex-col gap-1 text-xs text-[#94a3b8]">
        Atividade afetada (opcional)
        <select value={atividade} onChange={(e) => setAtividade(e.target.value)} className={campo}>
          <option value="">—</option>
          {atividades.map((a) => (
            <option key={a.numero} value={a.numero}>{a.numero} · {a.descricao}</option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs text-[#94a3b8]">
        {modo === 'impedimento' ? 'O que aconteceu' : 'O que o cliente orientou'}
        <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} className={`${campo} py-2`} />
      </label>

      <label className="flex flex-col gap-1 text-xs text-[#94a3b8]">
        Pessoa do cliente (opcional)
        <input value={pessoa} onChange={(e) => setPessoa(e.target.value)} className={campo} />
      </label>

      {modo === 'impedimento' ? (
        <>
          <label className="flex min-h-11 items-center gap-2 text-sm text-[#e8eef7]">
            <input type="checkbox" checked={trava} onChange={(e) => setTrava(e.target.checked)} className="h-5 w-5" />
            Trava a atividade (não dá para executar)
          </label>
          {!trava ? (
            <label className="flex flex-col gap-1 text-xs text-[#94a3b8]">
              Impacto estimado em dias (opcional)
              <input value={impacto} onChange={(e) => setImpacto(e.target.value)} inputMode="decimal" className={campo} />
            </label>
          ) : null}
        </>
      ) : null}

      <label className="flex min-h-11 items-center gap-2 text-sm text-[#e8eef7]">
        <input type="checkbox" checked={exibirEfetivo} onChange={(e) => setExibir(e.target.checked)} className="h-5 w-5" />
        Mostrar ao cliente
      </label>

      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => setFoto(e.target.files?.[0] ?? null)} />
      <button type="button" onClick={() => input.current?.click()} className="min-h-12 rounded-xl border border-[#f05a28] px-4 text-base font-semibold text-[#f05a28]">
        {foto ? `📷 ${foto.name}` : '📷 Anexar foto (opcional)'}
      </button>

      <button
        type="button"
        disabled={salvando}
        onClick={salvar}
        className="min-h-12 rounded-xl bg-[#f05a28] px-4 text-base font-semibold text-white disabled:opacity-45"
      >
        {salvando ? 'salvando…' : modo === 'impedimento' ? 'Registrar impedimento' : 'Registrar orientação'}
      </button>
      {erro ? <p role="alert" className="text-sm text-[#ff4d6d]">{erro}</p> : null}
      {ok ? <p role="status" className="text-sm text-[#34d399]">Registrado.</p> : null}
    </div>
  )
}
