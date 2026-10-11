import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { logoutAction } from './actions'
import Logo from '@/components/ui/Logo'
import Link from 'next/link'
import { isAdmin } from '@/lib/auth/roles'
import { systemSlugsComAcesso } from '@/lib/auth/systemAccess'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const fullName = user.user_metadata?.full_name as string | undefined
  const firstName = fullName?.trim().split(/\s+/)[0] ?? 'Colaborador'
  // Administrador abre tudo. Para os demais, uma consulta só traz os slugs com
  // acesso, em paralelo com a do nível (antes eram 1 + 5 consultas, cada uma
  // repetindo a do nível por dentro). Erro de consulta = nenhum acesso.
  const [admin, slugs] = await Promise.all([
    isAdmin(supabase, user.email ?? ''),
    systemSlugsComAcesso(supabase, user.email ?? ''),
  ])
  const [podeFrotas, podeConversor, podeManutencao, podeCrm, podeObras] = admin
    ?[true, true, true, true, true]
    : [
        slugs.has('sofia'),
        slugs.has('conversor-os'),
        slugs.has('dashboard-manutencao'),
        slugs.has('crm'),
        slugs.has('obras'),
      ]
  const semNada =
    !podeFrotas && !podeConversor && !podeManutencao && !podeCrm && !podeObras && !admin

  return (
    <main className="min-h-screen" style={{ backgroundColor: 'var(--background)' }}>
      <header className="border-b border-[#1e3a5f] bg-[#0d2050]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Logo size="sm" />
          <div className="flex items-center gap-4">
            <span className="text-sm text-[#94a3b8]">{user.email}</span>
            <form action={logoutAction}>
              <button
                type="submit"
                className="text-sm text-[#94a3b8] hover:text-white transition-colors px-3 py-1.5 rounded border border-[#1e3a5f] hover:border-[#f05a28]"
              >
                Sair
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-white mb-3">
            Olá, {firstName}!
          </h1>
          <p className="text-[#94a3b8] text-lg">
            Bem-vindo ao Hub Manfac Facilities.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
          {/* Financeiro não tem liberação por sistema: qualquer pessoa logada no hub
              pode pedir um pagamento (decisão 14 do desenho do módulo), então o card
              aparece para todos e não há slug em lib/sistemas.ts. Como o Cockpit, é uma
              app Next separada (basePath /financeiro) — <a> normal em vez de <Link>, e
              fora do matcher do middleware. */}
          <a
            href="/financeiro"
            className="flex items-start gap-4 p-6 rounded-xl border border-[#1e3a5f] bg-[#0d2050] hover:border-[#f05a28] transition-colors group"
          >
            <span className="text-3xl">💳</span>
            <div>
              <p className="text-white font-semibold group-hover:text-[#f05a28] transition-colors">
                Financeiro
              </p>
              <p className="text-[#4a6080] text-sm mt-1">
                Solicitação de pagamentos — pedidos, aprovação e lançamento no Omie
              </p>
            </div>
          </a>
          {/* Compras segue o Financeiro: qualquer pessoa logada no hub pode solicitar uma
              compra (papéis do módulo ficam no próprio Compras), então o card aparece para
              todos. App Next separada (basePath /compras) — <a> normal, fora do matcher. */}
          <a
            href="/compras"
            className="flex items-start gap-4 p-6 rounded-xl border border-[#1e3a5f] bg-[#0d2050] hover:border-[#f05a28] transition-colors group"
          >
            <span className="text-3xl">🛒</span>
            <div>
              <p className="text-white font-semibold group-hover:text-[#f05a28] transition-colors">
                Compras
              </p>
              <p className="text-[#4a6080] text-sm mt-1">
                Solicitação de compras — cotação, aprovação e pedido no Omie
              </p>
            </div>
          </a>
          {/* Gestão de Fornecedores segue o Compras: qualquer pessoa logada abre contrato ou
              medição (papéis no próprio módulo). App Next separada (basePath /fornecedores) —
              <a> normal, fora do matcher. */}
          <a
            href="/fornecedores"
            className="flex items-start gap-4 p-6 rounded-xl border border-[#1e3a5f] bg-[#0d2050] hover:border-[#f05a28] transition-colors group"
          >
            <span className="text-3xl">🤝</span>
            <div>
              <p className="text-white font-semibold group-hover:text-[#f05a28] transition-colors">
                Gestão de Fornecedores
              </p>
              <p className="text-[#4a6080] text-sm mt-1">
                Contratos e medições de fornecedores — aprovação e pagamento pelo Financeiro
              </p>
            </div>
          </a>
          {podeFrotas && (
          <Link
            href="/sofia"
            className="flex items-start gap-4 p-6 rounded-xl border border-[#1e3a5f] bg-[#0d2050] hover:border-[#f05a28] transition-colors group"
          >
            <span className="text-3xl">🚐</span>
            <div>
              <p className="text-white font-semibold group-hover:text-[#f05a28] transition-colors">
                Gestão de Frotas
              </p>
              <p className="text-[#4a6080] text-sm mt-1">
                Operação de frota — KM, checklist, multas
              </p>
            </div>
          </Link>
          )}
          {podeConversor && (
          <Link
            href="/conversor-os"
            className="flex items-start gap-4 p-6 rounded-xl border border-[#1e3a5f] bg-[#0d2050] hover:border-[#f05a28] transition-colors group"
          >
            <span className="text-3xl">📋</span>
            <div>
              <p className="text-white font-semibold group-hover:text-[#f05a28] transition-colors">
                Conversor OS
              </p>
              <p className="text-[#4a6080] text-sm mt-1">
                Converte planilhas de OS para o Field Control
              </p>
            </div>
          </Link>
          )}
          {podeManutencao && (
          // Módulo servido por uma app Next.js separada (basePath
          // /cockpit-manutencao), não uma rota deste projeto — usa <a>
          // normal em vez de <Link> para forçar navegação de página cheia
          // em vez do router client-side do Next tentar (e falhar) tratar
          // isso como uma rota interna.
          <a
            href="/cockpit-manutencao"
            className="flex items-start gap-4 p-6 rounded-xl border border-[#1e3a5f] bg-[#0d2050] hover:border-[#f05a28] transition-colors group"
          >
            <span className="text-3xl">🏢</span>
            <div>
              <p className="text-white font-semibold group-hover:text-[#f05a28] transition-colors">
                Cockpit Manutenção Predial
              </p>
              <p className="text-[#4a6080] text-sm mt-1">
                Volume de OS, atrasos e ranking de técnicos por cliente
              </p>
            </div>
          </a>
          )}
          {podeCrm && (
          <Link
            href="/crm"
            className="flex items-start gap-4 p-6 rounded-xl border border-[#1e3a5f] bg-[#0d2050] hover:border-[#f05a28] transition-colors group"
          >
            <span className="text-3xl">📇</span>
            <div>
              <p className="text-white font-semibold group-hover:text-[#f05a28] transition-colors">
                CRM
              </p>
              <p className="text-[#4a6080] text-sm mt-1">
                Leads que chegaram pelo formulário do site.
              </p>
            </div>
          </Link>
          )}
          {podeObras && (
          <Link
            href="/obras/base"
            className="flex items-start gap-4 p-6 rounded-xl border border-[#1e3a5f] bg-[#0d2050] hover:border-[#f05a28] transition-colors group"
          >
            <span className="text-3xl">🏗️</span>
            <div>
              <p className="text-white font-semibold group-hover:text-[#f05a28] transition-colors">
                Gestão de Obras
              </p>
              <p className="text-[#4a6080] text-sm mt-1">
                Diário do dia, tarefas e a base de obras de todos os clientes
              </p>
            </div>
          </Link>
          )}
          {admin && (
            <Link
              href="/admin/acessos"
              className="flex items-start gap-4 p-6 rounded-xl border border-[#1e3a5f] bg-[#0d2050] hover:border-[#f05a28] transition-colors group"
            >
              <span className="text-3xl">🔑</span>
              <div>
                <p className="text-white font-semibold group-hover:text-[#f05a28] transition-colors">
                  Admin
                </p>
                <p className="text-[#4a6080] text-sm mt-1">
                  Gestão de acessos aos sistemas do hub
                </p>
              </div>
            </Link>
          )}
        </div>
        {semNada && (
          <p className="text-[#94a3b8] text-center mt-8">
            Os outros sistemas do hub dependem de liberação. Fale com um administrador.
          </p>
        )}
      </div>
    </main>
  )
}
