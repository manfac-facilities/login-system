'use client'

import { useState } from 'react'
import { alternarAcessoAction } from '../_actions'
import type { UsuarioHub } from '../_actions'

interface Acesso {
  user_email: string
  system_slug: string
  has_access: boolean
}

export default function AcessosTable({
  usuarios,
  sistemas,
  acessos,
}: {
  usuarios: UsuarioHub[]
  sistemas: { slug: string; label: string }[]
  acessos: Acesso[]
}) {
  const [estado, setEstado] = useState<Record<string, boolean>>(() => {
    const inicial: Record<string, boolean> = {}
    for (const acesso of acessos) {
      inicial[`${acesso.user_email.toLowerCase()}:${acesso.system_slug}`] = acesso.has_access
    }
    return inicial
  })
  const [salvando, setSalvando] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  async function handleToggle(email: string, slug: string) {
    const chave = `${email.toLowerCase()}:${slug}`
    const novoValor = !estado[chave]
    setSalvando(chave)
    setErro(null)
    const result = await alternarAcessoAction(email, slug, novoValor)
    setSalvando(null)
    if ('error' in result && result.error) {
      setErro(result.error)
      return
    }
    setEstado((prev) => ({ ...prev, [chave]: novoValor }))
  }

  return (
    <section className="rounded-lg border border-[#1e3a5f] bg-[#0d2050]/30">
      <header className="p-5 border-b border-[#1e3a5f]">
        <h2 className="text-lg font-semibold text-white">Funções</h2>
        <p className="text-[#94a3b8] text-sm mt-1">
          Controle quais sistemas cada pessoa pode abrir.
        </p>
      </header>

      {erro && (
        <div className="mx-5 mt-4 px-4 py-3 rounded-lg border border-red-600 bg-red-950 text-red-300 text-sm">
          {erro}
        </div>
      )}

      <ul className="divide-y divide-[#1e3a5f]">
        {usuarios.map((usuario) => (
          <li
            key={usuario.id}
            className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"
          >
            <div className="min-w-0">
              <div className="text-white truncate">{usuario.nome ?? usuario.email}</div>
              {usuario.nome && (
                <div className="text-[#94a3b8] text-xs mt-0.5 truncate">{usuario.email}</div>
              )}
            </div>

            {usuario.nivel === 'administrador' ? (
              <span className="flex items-center gap-2 text-sm text-[#94a3b8]">
                <span aria-hidden="true">🔒</span>
                Administrador acessa todos os sistemas
              </span>
            ) : (
              <div className="flex flex-wrap items-center gap-5">
                {sistemas.map((sistema) => {
                  const chave = `${usuario.email.toLowerCase()}:${sistema.slug}`
                  const ligado = !!estado[chave]
                  return (
                    <div key={sistema.slug} className="flex items-center gap-2">
                      <span className="text-sm text-[#94a3b8]">{sistema.label}</span>
                      <button
                        type="button"
                        role="switch"
                        aria-label={sistema.label}
                        aria-checked={ligado}
                        onClick={() => handleToggle(usuario.email, sistema.slug)}
                        disabled={salvando === chave}
                        className={`w-11 h-6 rounded-full transition-colors relative disabled:opacity-50 ${
                          ligado ? 'bg-[#22c55e]' : 'bg-[#0d2050] border border-[#1e3a5f]'
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                            ligado ? 'translate-x-5' : 'translate-x-0.5'
                          }`}
                        />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
