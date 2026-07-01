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
    for (const acesso of acessos) inicial[`${acesso.user_email}:${acesso.system_slug}`] = acesso.has_access
    return inicial
  })
  const [salvando, setSalvando] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  async function handleToggle(email: string, slug: string) {
    const chave = `${email}:${slug}`
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
    <div className="flex flex-col gap-3">
      {erro && (
        <div className="px-4 py-3 rounded-lg border border-red-600 bg-red-950 text-red-300 text-sm">
          {erro}
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border border-[#1e3a5f]">
        <table className="w-full text-sm text-left">
          <thead className="bg-[#0d2050] text-[#94a3b8]">
            <tr>
              <th className="px-3 py-2">Usuário</th>
              {sistemas.map((sistema) => (
                <th key={sistema.slug} className="px-3 py-2">{sistema.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {usuarios.map((usuario) => (
              <tr key={usuario.id} className="border-t border-[#1e3a5f] text-white">
                <td className="px-3 py-2">{usuario.email}</td>
                {sistemas.map((sistema) => {
                  const chave = `${usuario.email}:${sistema.slug}`
                  const ligado = !!estado[chave]
                  return (
                    <td key={sistema.slug} className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => handleToggle(usuario.email, sistema.slug)}
                        disabled={salvando === chave}
                        className={`w-11 h-6 rounded-full transition-colors relative disabled:opacity-50 ${
                          ligado ? 'bg-[#f05a28]' : 'bg-[#1e3a5f]'
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                            ligado ? 'translate-x-5' : 'translate-x-0.5'
                          }`}
                        />
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
