'use client'

import { useState } from 'react'
import type { Nivel } from '@/lib/auth/roles'
import { convidarUsuarioAction, removerUsuarioAction } from './_actions'

function Moldura({
  titulo,
  children,
  onFechar,
}: {
  titulo: string
  children: React.ReactNode
  onFechar: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-lg border border-[#1e3a5f] bg-[#0a1628] shadow-xl">
        <header className="flex items-center justify-between px-5 py-4 border-b border-[#1e3a5f]">
          <h3 className="text-white font-semibold">{titulo}</h3>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="text-[#94a3b8] hover:text-white"
          >
            ✕
          </button>
        </header>
        {children}
      </div>
    </div>
  )
}

export function ConvidarDialog({
  aberto,
  sistemas,
  onFechar,
}: {
  aberto: boolean
  sistemas: { slug: string; label: string }[]
  onFechar: () => void
}) {
  const [email, setEmail] = useState('')
  const [nivel, setNivel] = useState<Nivel>('analista')
  const [ligados, setLigados] = useState<string[]>([])
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  if (!aberto) return null

  function alternarSistema(slug: string) {
    setLigados((atual) =>
      atual.includes(slug) ? atual.filter((s) => s !== slug) : [...atual, slug]
    )
  }

  async function enviar() {
    setEnviando(true)
    setErro(null)
    const resultado = await convidarUsuarioAction(email, nivel, ligados)
    setEnviando(false)
    if (resultado?.error) {
      setErro(resultado.error)
      return
    }
    onFechar()
  }

  return (
    <Moldura titulo="Adicionar novo usuário" onFechar={onFechar}>
      <div className="p-5 flex flex-col gap-4">
        {erro && (
          <div className="px-4 py-3 rounded-lg border border-red-600 bg-red-950 text-red-300 text-sm">
            {erro}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="convite-email" className="text-sm text-[#94a3b8]">
            E-mail
          </label>
          <input
            id="convite-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nome@manfac.com.br"
            className="px-3 py-2 rounded-lg bg-[#0d2050] border border-[#1e3a5f] text-white text-sm placeholder:text-[#4a6080] focus:outline-none focus:border-[#f05a28]"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="convite-nivel" className="text-sm text-[#94a3b8]">
            Nível
          </label>
          <select
            id="convite-nivel"
            value={nivel}
            onChange={(e) => setNivel(e.target.value as Nivel)}
            className="px-3 py-2 rounded-lg bg-[#0d2050] border border-[#1e3a5f] text-white text-sm focus:outline-none focus:border-[#f05a28]"
          >
            <option value="analista">Analista</option>
            <option value="administrador">Administrador</option>
          </select>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm text-[#94a3b8] mb-1">Sistemas liberados</legend>
          {sistemas.map((sistema) => (
            <label
              key={sistema.slug}
              htmlFor={`convite-sistema-${sistema.slug}`}
              className="flex items-center justify-between text-sm text-white"
            >
              {sistema.label}
              <input
                id={`convite-sistema-${sistema.slug}`}
                type="checkbox"
                checked={ligados.includes(sistema.slug)}
                onChange={() => alternarSistema(sistema.slug)}
                className="w-4 h-4 accent-[#22c55e]"
              />
            </label>
          ))}
          {nivel === 'administrador' && (
            <p className="text-xs text-[#94a3b8]">
              Administrador acessa todos os sistemas, independentemente da seleção acima.
            </p>
          )}
        </fieldset>
      </div>

      <footer className="flex justify-end gap-3 px-5 py-4 border-t border-[#1e3a5f]">
        <button
          type="button"
          onClick={onFechar}
          className="px-4 py-2 rounded-lg border border-[#1e3a5f] text-[#94a3b8] text-sm hover:text-white"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={enviar}
          disabled={enviando || !email.trim()}
          className="px-4 py-2 rounded-lg bg-[#f05a28] text-white text-sm font-medium hover:bg-[#d94d1f] disabled:opacity-50"
        >
          {enviando ? 'Enviando...' : 'Enviar convite'}
        </button>
      </footer>
    </Moldura>
  )
}

export function RemoverDialog({
  aberto,
  usuario,
  onFechar,
}: {
  aberto: boolean
  usuario: { email: string; nome: string | null }
  onFechar: () => void
}) {
  const [confirmacao, setConfirmacao] = useState('')
  const [removendo, setRemovendo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  if (!aberto) return null

  const liberado = confirmacao.trim().toLowerCase() === 'deletar'

  async function remover() {
    setRemovendo(true)
    setErro(null)
    const resultado = await removerUsuarioAction(usuario.email)
    setRemovendo(false)
    if (resultado?.error) {
      setErro(resultado.error)
      return
    }
    onFechar()
  }

  return (
    <Moldura titulo="Remover do hub" onFechar={onFechar}>
      <div className="p-5 flex flex-col gap-4">
        {erro && (
          <div className="px-4 py-3 rounded-lg border border-red-600 bg-red-950 text-red-300 text-sm">
            {erro}
          </div>
        )}

        <p className="text-sm text-[#94a3b8]">
          A conta de <span className="text-white">{usuario.nome ?? usuario.email}</span> será
          apagada e a pessoa perderá o acesso a todos os sistemas. O histórico já registrado nos
          sistemas é preservado.
        </p>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="remover-confirmacao" className="text-sm text-[#94a3b8]">
            Digite <span className="text-white font-medium">deletar</span> para confirmar
          </label>
          <input
            id="remover-confirmacao"
            type="text"
            value={confirmacao}
            onChange={(e) => setConfirmacao(e.target.value)}
            className="px-3 py-2 rounded-lg bg-[#0d2050] border border-[#1e3a5f] text-white text-sm focus:outline-none focus:border-red-500"
          />
        </div>
      </div>

      <footer className="flex justify-end gap-3 px-5 py-4 border-t border-[#1e3a5f]">
        <button
          type="button"
          onClick={onFechar}
          className="px-4 py-2 rounded-lg border border-[#1e3a5f] text-[#94a3b8] text-sm hover:text-white"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={remover}
          disabled={!liberado || removendo}
          className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
        >
          {removendo ? 'Removendo...' : 'Remover do hub'}
        </button>
      </footer>
    </Moldura>
  )
}
