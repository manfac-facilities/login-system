'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { adicionarAcessoAction, alternarAcessoAction, removerAcessoAction, trazerDestinatariosClienteAction } from './_actions-portal'
import type { AcessoPortal } from './_tipos-portal'

const campo = 'min-h-11 rounded-lg border border-[#dadad8] bg-[#ffffff] px-3 text-base text-[#333336]'
const botao = 'min-h-11 rounded-lg border border-[#dadad8] px-3 text-sm text-[#333336] hover:border-[#b94606] disabled:opacity-45'

export default function AcessoPortalCliente({ obraId, itens }: { obraId: string; itens: AcessoPortal[] }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [nome, setNome] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [indo, setIndo] = useState(false)

  async function rodar(fn: () => Promise<{ ok: boolean; erro?: string; adicionados?: number }>, depois?: (r: { adicionados?: number }) => void) {
    setIndo(true)
    setErro(null)
    setAviso(null)
    const r = await fn()
    setIndo(false)
    if (!r.ok) return setErro(r.erro ?? 'Não foi possível concluir.')
    depois?.(r)
    router.refresh()
  }

  return (
    <section className="flex flex-col gap-3" aria-labelledby="acesso-cliente">
      <h2 id="acesso-cliente" className="text-lg font-bold text-[#00345e]">Acesso à página do cliente</h2>
      <p className="text-sm text-[#5a7380]">Quem entra na página do cliente com e-mail e código. E-mail da Manfac não entra por aqui.</p>
      {itens.length === 0 ? <p className="text-sm text-[#5a7380]">Ninguém com acesso.</p> : null}
      <ul className="flex flex-col gap-2">
        {itens.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#dadad8] p-3 text-sm text-[#333336]">
            <span className={i.ativo ? '' : 'opacity-50'}>
              <strong>{i.nome ?? i.email}</strong>
              <br />
              <span className="text-xs text-[#5a7380]">{i.email}{i.ativo ? '' : ' · desativado'}</span>
            </span>
            <span className="flex gap-2">
              <button type="button" disabled={indo} className={botao} onClick={() => rodar(() => alternarAcessoAction(obraId, i.id, !i.ativo))}>
                {i.ativo ? 'Desativar' : 'Ativar'}
              </button>
              <button
                type="button"
                disabled={indo}
                className={botao}
                onClick={() => {
                  if (window.confirm(`Remover o acesso de ${i.email}?`)) void rodar(() => removerAcessoAction(obraId, i.id))
                }}
              >
                Remover
              </button>
            </span>
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-2 rounded-xl border border-[#dadad8] p-3">
        <input aria-label="E-mail do cliente" placeholder="E-mail" type="email" className={campo} value={email} onChange={(e) => setEmail(e.target.value)} />
        <input aria-label="Nome" placeholder="Nome (opcional)" className={campo} value={nome} onChange={(e) => setNome(e.target.value)} />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={indo || !email.trim()}
            className="min-h-11 rounded-lg bg-[#b94606] px-4 text-sm font-semibold text-white disabled:opacity-45"
            onClick={() => rodar(() => adicionarAcessoAction(obraId, { email, nome }), () => { setEmail(''); setNome('') })}
          >
            Dar acesso
          </button>
          <button
            type="button"
            disabled={indo}
            className={botao}
            onClick={() =>
              rodar(() => trazerDestinatariosClienteAction(obraId), (r) =>
                setAviso(r.adicionados ? `${r.adicionados} adicionado(s).` : 'Ninguém novo para adicionar.'),
              )
            }
          >
            Trazer destinatários do lado cliente
          </button>
        </div>
      </div>
      {erro ? <p role="alert" className="text-xs text-[#b23232]">{erro}</p> : null}
      {aviso ? <p role="status" className="text-xs text-[#136c38]">{aviso}</p> : null}
    </section>
  )
}
