'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { salvarDestinatarioAction } from './_actions'
import { TIPOS_ENVIO, type Destinatario, type DestinatarioEntrada, type Lado, type TipoEnvio } from './_tipos'

const campo = 'min-h-11 rounded-lg border border-[#dadad8] bg-[#ffffff] px-3 text-base text-[#333336]'
const VAZIO: DestinatarioEntrada = { email: '', nome: '', funcao: '', lado: 'cliente', tipos: ['diario'], ativo: true }

function Form({ obraId, inicial, onFim }: { obraId: string; inicial: DestinatarioEntrada; onFim: () => void }) {
  const router = useRouter()
  const [d, setD] = useState<DestinatarioEntrada>(inicial)
  const [erro, setErro] = useState<string | null>(null)
  const [indo, setIndo] = useState(false)

  const alternar = (t: TipoEnvio) =>
    setD((x) => ({ ...x, tipos: x.tipos.includes(t) ? x.tipos.filter((y) => y !== t) : [...x.tipos, t] }))

  async function salvar() {
    setIndo(true)
    setErro(null)
    const r = await salvarDestinatarioAction(obraId, d)
    setIndo(false)
    if (!r.ok) return setErro(r.erro)
    router.refresh()
    onFim()
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-[#dadad8] p-3">
      <input aria-label="E-mail" placeholder="E-mail" type="email" className={campo} value={d.email} onChange={(e) => setD({ ...d, email: e.target.value })} />
      <input aria-label="Nome" placeholder="Nome" className={campo} value={d.nome ?? ''} onChange={(e) => setD({ ...d, nome: e.target.value })} />
      <input aria-label="Função" placeholder="Função" className={campo} value={d.funcao ?? ''} onChange={(e) => setD({ ...d, funcao: e.target.value })} />
      <select aria-label="Lado" className={campo} value={d.lado} onChange={(e) => setD({ ...d, lado: e.target.value as Lado })}>
        <option value="cliente">Cliente</option>
        <option value="interno">Interno</option>
      </select>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Tipos de envio">
        {TIPOS_ENVIO.map((t) => (
          <button
            key={t.valor}
            type="button"
            aria-pressed={d.tipos.includes(t.valor)}
            onClick={() => alternar(t.valor)}
            className={`min-h-11 rounded-full border px-3 text-sm ${
              d.tipos.includes(t.valor) ? 'border-[#b94606] bg-[#b94606] font-semibold text-white' : 'border-[#dadad8] text-[#333336]'
            }`}
          >
            {t.rotulo}
          </button>
        ))}
      </div>
      <label className="flex min-h-11 items-center gap-2 text-sm text-[#333336]">
        <input type="checkbox" checked={d.ativo} onChange={(e) => setD({ ...d, ativo: e.target.checked })} /> Ativo
      </label>
      {erro ? <p role="alert" className="text-xs text-[#b23232]">{erro}</p> : null}
      <div className="flex gap-2">
        <button type="button" disabled={indo} onClick={salvar} className="min-h-11 rounded-lg bg-[#b94606] px-4 text-sm font-semibold text-white disabled:opacity-45">
          {indo ? 'salvando…' : 'Salvar'}
        </button>
        <button type="button" onClick={onFim} className="min-h-11 rounded-lg border border-[#dadad8] px-4 text-sm text-[#333336]">
          Cancelar
        </button>
      </div>
    </div>
  )
}

function Grupo({ titulo, itens, obraId, admin }: { titulo: string; itens: Destinatario[]; obraId: string; admin: boolean }) {
  const [editando, setEditando] = useState<string | null>(null)
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-[#5a7380]">{titulo}</h3>
      {itens.length === 0 ? <p className="text-sm text-[#5a7380]">Ninguém cadastrado.</p> : null}
      <ul className="flex flex-col gap-2">
        {itens.map((i) =>
          editando === i.id ? (
            <li key={i.id}><Form obraId={obraId} inicial={i} onFim={() => setEditando(null)} /></li>
          ) : (
            <li key={i.id} className="flex items-start justify-between gap-2 rounded-xl border border-[#dadad8] p-3 text-sm text-[#333336]">
              <span className={i.ativo ? '' : 'opacity-50'}>
                <strong>{i.nome ?? i.email}</strong>{i.funcao ? ` · ${i.funcao}` : ''}
                <br /><span className="text-xs text-[#5a7380]">{i.email} · {i.tipos.join(', ')}{i.ativo ? '' : ' · inativo'}</span>
              </span>
              {admin ? (
                <button type="button" onClick={() => setEditando(i.id)} className="min-h-11 rounded-lg border border-[#dadad8] px-3 text-sm hover:border-[#b94606]">
                  Editar
                </button>
              ) : null}
            </li>
          ),
        )}
      </ul>
    </div>
  )
}

export default function Destinatarios({ obraId, itens, admin }: { obraId: string; itens: Destinatario[]; admin: boolean }) {
  const [novo, setNovo] = useState(false)
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-bold text-[#00345e]">Destinatários</h2>
      <Grupo titulo="Cliente" itens={itens.filter((i) => i.lado === 'cliente')} obraId={obraId} admin={admin} />
      <Grupo titulo="Interno" itens={itens.filter((i) => i.lado === 'interno')} obraId={obraId} admin={admin} />
      {admin ? (
        novo ? (
          <Form obraId={obraId} inicial={VAZIO} onFim={() => setNovo(false)} />
        ) : (
          <button type="button" onClick={() => setNovo(true)} className="min-h-11 self-start rounded-lg border border-[#dadad8] px-4 text-sm text-[#333336] hover:border-[#b94606]">
            Adicionar destinatário
          </button>
        )
      ) : null}
    </section>
  )
}
