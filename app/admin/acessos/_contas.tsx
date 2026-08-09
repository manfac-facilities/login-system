'use client'

import { useMemo, useState } from 'react'
import type { Nivel } from '@/lib/auth/roles'
import type { UsuarioHub } from '../_actions'
import {
  alterarNivelAction,
  cancelarConviteAction,
  enviarResetSenhaAction,
  reenviarConviteAction,
  removerUsuarioAction,
} from '../_actions'

const formatador = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'long',
  timeStyle: 'short',
  timeZone: 'America/Sao_Paulo',
})

function formatarAcesso(iso: string | null): string {
  if (!iso) return 'Nunca acessou'
  return formatador.format(new Date(iso))
}

function PillNivel({ nivel }: { nivel: Nivel | null }) {
  if (nivel === 'administrador') {
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[#f05a28]/15 text-[#f05a28] border border-[#f05a28]/40">
        Administrador
      </span>
    )
  }
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[#0d2050] text-[#94a3b8] border border-[#1e3a5f]">
      {nivel === 'analista' ? 'Analista' : 'Sem nível'}
    </span>
  )
}

export default function ContasCard({
  usuarios,
  emailAtual,
}: {
  usuarios: UsuarioHub[]
  emailAtual: string
}) {
  const [busca, setBusca] = useState('')
  const [filtroNivel, setFiltroNivel] = useState<'todos' | Nivel>('todos')
  const [menuAberto, setMenuAberto] = useState<string | null>(null)
  const [processando, setProcessando] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const eu = emailAtual.trim().toLowerCase()

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return usuarios.filter((u) => {
      const casaBusca =
        !termo || (u.nome ?? '').toLowerCase().includes(termo) || u.email.includes(termo)
      const casaNivel = filtroNivel === 'todos' || u.nivel === filtroNivel
      return casaBusca && casaNivel
    })
  }, [usuarios, busca, filtroNivel])

  async function executar(email: string, acao: () => Promise<{ error?: string }>) {
    setProcessando(email)
    setErro(null)
    setMenuAberto(null)
    const resultado = await acao()
    setProcessando(null)
    if (resultado?.error) setErro(resultado.error)
  }

  return (
    <section className="rounded-lg border border-[#1e3a5f] bg-[#0d2050]/30">
      <header className="flex flex-wrap items-start justify-between gap-4 p-5 border-b border-[#1e3a5f]">
        <div>
          <h2 className="text-lg font-semibold text-white">Conta</h2>
          <p className="text-[#94a3b8] text-sm mt-1">
            Por motivos de segurança, os links de convite expiram após 24 horas.
          </p>
        </div>
        <button
          type="button"
          className="px-4 py-2 rounded-lg bg-[#f05a28] text-white text-sm font-medium hover:bg-[#d94d1f] transition-colors"
        >
          Adicionar novo usuário
        </button>
      </header>

      <div className="flex flex-wrap gap-3 p-5">
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Pesquisar usuários..."
          className="flex-1 min-w-[200px] px-3 py-2 rounded-lg bg-[#0a1628] border border-[#1e3a5f] text-white text-sm placeholder:text-[#4a6080] focus:outline-none focus:border-[#f05a28]"
        />
        <select
          value={filtroNivel}
          onChange={(e) => setFiltroNivel(e.target.value as 'todos' | Nivel)}
          aria-label="Filtrar por nível"
          className="px-3 py-2 rounded-lg bg-[#0a1628] border border-[#1e3a5f] text-white text-sm focus:outline-none focus:border-[#f05a28]"
        >
          <option value="todos">Todos os níveis</option>
          <option value="analista">Analista</option>
          <option value="administrador">Administrador</option>
        </select>
      </div>

      {erro && (
        <div className="mx-5 mb-4 px-4 py-3 rounded-lg border border-red-600 bg-red-950 text-red-300 text-sm">
          {erro}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-[#94a3b8] border-y border-[#1e3a5f]">
            <tr>
              <th className="px-5 py-2 font-medium">Nome</th>
              <th className="px-5 py-2 font-medium">Nível</th>
              <th className="px-5 py-2 font-medium">Ativo pela última vez</th>
              <th className="px-5 py-2 w-10" />
            </tr>
          </thead>
          <tbody>
            {visiveis.map((usuario) => {
              const souEu = usuario.email.toLowerCase() === eu
              const ocupado = processando === usuario.email
              return (
                <tr key={usuario.id} className="border-b border-[#1e3a5f] align-middle">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-white">{usuario.nome ?? usuario.email}</span>
                      {souEu && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide bg-[#1e3a5f] text-[#94a3b8]">
                          você
                        </span>
                      )}
                    </div>
                    {usuario.nome && (
                      <div className="text-[#94a3b8] text-xs mt-0.5">{usuario.email}</div>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <PillNivel nivel={usuario.nivel} />
                  </td>
                  <td className="px-5 py-3 text-[#94a3b8]">
                    {usuario.convitePendente ? (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-[#f05a28]/10 text-[#f05a28] border border-[#f05a28]/30">
                        Convite pendente
                      </span>
                    ) : (
                      formatarAcesso(usuario.ultimoAcesso)
                    )}
                  </td>
                  <td className="px-5 py-3 relative">
                    <button
                      type="button"
                      aria-label={`Ações para ${usuario.email}`}
                      disabled={ocupado}
                      onClick={() =>
                        setMenuAberto((atual) => (atual === usuario.email ? null : usuario.email))
                      }
                      className="px-2 py-1 rounded text-[#94a3b8] hover:bg-[#1e3a5f] disabled:opacity-50"
                    >
                      ⋮
                    </button>
                    {menuAberto === usuario.email && (
                      <div className="absolute right-5 z-10 mt-1 w-56 rounded-lg border border-[#1e3a5f] bg-[#0d2050] py-1 shadow-lg">
                        {usuario.convitePendente ? (
                          <>
                            <ItemMenu
                              onClick={() =>
                                executar(usuario.email, () => reenviarConviteAction(usuario.email))
                              }
                            >
                              Reenviar convite
                            </ItemMenu>
                            <ItemMenu
                              perigo
                              onClick={() =>
                                executar(usuario.email, () => cancelarConviteAction(usuario.email))
                              }
                            >
                              Cancelar convite
                            </ItemMenu>
                          </>
                        ) : (
                          <>
                            <ItemMenu
                              desabilitado={souEu}
                              titulo={
                                souEu ? 'Você não pode rebaixar nem remover a si mesmo.' : undefined
                              }
                              onClick={() =>
                                executar(usuario.email, () =>
                                  alterarNivelAction(
                                    usuario.email,
                                    usuario.nivel === 'administrador' ? 'analista' : 'administrador'
                                  )
                                )
                              }
                            >
                              {usuario.nivel === 'administrador'
                                ? 'Tornar analista'
                                : 'Tornar administrador'}
                            </ItemMenu>
                            <ItemMenu
                              onClick={() =>
                                executar(usuario.email, () => enviarResetSenhaAction(usuario.email))
                              }
                            >
                              Redefinir senha
                            </ItemMenu>
                            <ItemMenu
                              perigo
                              desabilitado={souEu}
                              titulo={
                                souEu ? 'Você não pode rebaixar nem remover a si mesmo.' : undefined
                              }
                              onClick={() =>
                                executar(usuario.email, () => removerUsuarioAction(usuario.email))
                              }
                            >
                              Remover do hub
                            </ItemMenu>
                          </>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
            {visiveis.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-6 text-center text-[#94a3b8]">
                  Nenhum usuário encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function ItemMenu({
  children,
  onClick,
  desabilitado,
  perigo,
  titulo,
}: {
  children: React.ReactNode
  onClick: () => void
  desabilitado?: boolean
  perigo?: boolean
  titulo?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={desabilitado}
      title={titulo}
      className={`w-full text-left px-4 py-2 text-sm hover:bg-[#1e3a5f] disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed ${
        perigo ? 'text-red-400' : 'text-white'
      }`}
    >
      {children}
    </button>
  )
}
