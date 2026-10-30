import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { podeGerirFrotas } from '@/lib/sofia/permissoes'
import { carregarVisaoGeral } from '@/lib/sofia/visao-geral-leituras'
import { brl, dataBR } from '@/lib/sofia/extratos/agrupar'

const reais = (v: number) => brl(v)
const centavosParaReais = (c: number) => brl(c / 100)

const H2 = 'text-lg font-semibold text-white mb-1'
const LEAD = 'text-[#4a6080] text-sm mb-4'
const CARD = 'rounded-xl p-5 border border-[#1e3a5f] bg-[#0d2050]'

function Situacao({ href, label, valor, sub, quente }: { href: string; label: string; valor: number; sub: string; quente?: boolean }) {
  return (
    <Link href={href} className={`${CARD} block hover:border-[#f05a28] transition-colors ${quente ? 'border-[#f05a28]' : ''}`}>
      <p className="text-xs text-[#4a6080] uppercase tracking-wider font-medium mb-1">{label}</p>
      <p className="text-3xl font-bold text-white">{valor}</p>
      <p className="text-xs text-[#4a6080] mt-1">{sub}</p>
    </Link>
  )
}

export default async function SofiaPage() {
  const supabase = await createClient()
  const [v, gestor] = await Promise.all([carregarVisaoGeral(), podeGerirFrotas(supabase)])
  const { frota, acoes, custos, extratos, hoje, inicioMes } = v
  const mesNome = new Date(`${hoje}T12:00:00Z`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  const periodo = `de=${inicioMes}&ate=${hoje}`
  const semVeiculos = frota.uso + frota.livre + frota.oficina + frota.fora === 0

  const linhasCusto: [string, number, string][] = [
    ['Locação', custos.itens.locacao, '/sofia/custos'],
    ['Abastecimento (lançado no hub)', custos.itens.abastecimento, `/sofia/abastecimento?${periodo}`],
    ['Revisões', custos.itens.revisoes, '/sofia/revisoes'],
    ['Sinistros', custos.itens.sinistros, '/sofia/sinistros'],
    ['Multas', custos.itens.multas, '/sofia/multas'],
  ]

  const atalhos: [string, string, boolean][] = [
    ['Registrar abastecimento', '/sofia/abastecimento', false],
    ['Lançar KM do dia', '/sofia/km', false],
    ['Novo checklist', '/sofia/checklist/novo', false],
    ['Registrar multa', '/sofia/multas/nova', false],
    ['Registrar sinistro', '/sofia/sinistros/novo', false],
    ['Registrar revisão', '/sofia/revisoes/nova', false],
    ['Enviar extrato', '/sofia/extratos/enviar', true],
  ]

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Visão Geral da Frota</h1>
        <p className="text-[#4a6080] text-sm mt-1">
          {new Date(`${hoje}T12:00:00Z`).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}
        </p>
      </div>

      {/* 1.1 */}
      <h2 className={H2}>Frota agora</h2>
      <p className={LEAD}>Cada carro aparece em uma única situação. Clique para abrir a lista de veículos nessa situação.</p>
      {semVeiculos ? (
        <div className={`${CARD} text-center mb-10`}>
          <p className="text-white">Nenhum veículo cadastrado ainda.</p>
          <p className="text-[#4a6080] text-sm mt-1">Cadastre o primeiro veículo para a situação da frota aparecer aqui.</p>
          <Link href="/sofia/veiculos" className="inline-block mt-3 px-4 py-2 rounded-lg bg-[#f05a28] text-white text-sm">Cadastrar veículo</Link>
        </div>
      ) : (
        <div className="mb-10">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Situacao href="/sofia/veiculos?sit=uso" label="Em uso" valor={frota.uso} sub="com equipe e motorista hoje" />
            <Situacao href="/sofia/veiculos?sit=livre" label="Livre" valor={frota.livre} sub="ativo, sem equipe — pronto para sair" />
            <Situacao href="/sofia/veiculos?sit=oficina" label="Na oficina" valor={frota.oficina} sub="revisão ou mecânico, juntos" quente={frota.oficina > 0} />
            <div className={CARD}>
              <p className="text-xs text-[#4a6080] uppercase tracking-wider font-medium mb-1">Disponibilidade</p>
              <p className="text-3xl font-bold text-white">{frota.disponibilidadePct}%</p>
              <p className="text-xs text-[#4a6080] mt-1">{frota.disponiveis} de {frota.base} carros fora da oficina</p>
            </div>
          </div>
          {frota.base > 0 && (
            <div className="flex h-2 rounded-full overflow-hidden bg-[#1e3a5f] mt-4" aria-hidden>
              <span style={{ width: `${(frota.uso / frota.base) * 100}%`, background: '#f05a28' }} />
              <span style={{ width: `${(frota.livre / frota.base) * 100}%`, background: '#ffffff' }} />
              <span style={{ width: `${(frota.oficina / frota.base) * 100}%`, background: '#1e3a5f' }} />
            </div>
          )}
          <p className="text-xs text-[#4a6080] mt-2">
            Em uso {frota.uso} · Livre {frota.livre} · Na oficina {frota.oficina} ·{' '}
            <Link href="/sofia/veiculos?sit=fora" className="hover:text-white">Fora da frota (inativo): {frota.fora}</Link> — não entra na conta
          </p>
        </div>
      )}

      {/* 1.2 */}
      <h2 className={H2}>O que precisa de ação hoje</h2>
      <p className={LEAD}>Quando não há nada, o item some.</p>
      {acoes.length === 0 ? (
        <div className={`${CARD} text-center mb-10`}>
          <p className="text-white">Nada pendente hoje.</p>
          <p className="text-[#4a6080] text-sm mt-1">Nenhuma revisão atrasada, documento vencendo, multa ou sinistro em aberto, e todas as equipes lançaram o KM de ontem.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-[#1e3a5f] bg-[#0d2050] divide-y divide-[#1e3a5f] mb-10">
          {acoes.map((a) => (
            <Link key={a.id} href={a.href} className="flex items-start gap-4 p-4 hover:bg-[#10285f] transition-colors">
              <span className={`text-2xl font-bold min-w-8 text-center ${a.urgente ? 'text-[#f05a28]' : 'text-white'}`}>{a.n}</span>
              <span className="flex-1 min-w-0">
                <span className="block text-white font-medium">{a.titulo}</span>
                <span className="block text-[#94a3b8] text-sm break-words">{a.descricao}</span>
              </span>
              <span className="hidden sm:block text-xs text-[#4a6080] whitespace-nowrap">{a.irPara} →</span>
            </Link>
          ))}
        </div>
      )}

      {/* 1.3 */}
      <h2 className={H2}>Quanto gastamos no mês</h2>
      <p className={LEAD}>{mesNome}, do dia 1 até hoje. Mesma regra da tela Custos. Clique em um valor para abrir os lançamentos.</p>
      {custos.total === 0 ? (
        <div className={`${CARD} text-center mb-10`}><p className="text-white">Nenhum gasto registrado neste mês.</p></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <div className={CARD}>
            <p className="text-xs text-[#4a6080] uppercase tracking-wider font-medium mb-1">Total do mês</p>
            <p className="text-3xl font-bold text-white">{reais(custos.total)}</p>
            <p className="text-xs text-[#4a6080] mt-1">
              {v.qtdVeiculosCustos} carros · média {reais(custos.total / Math.max(v.qtdVeiculosCustos, 1))} por carro
            </p>
          </div>
          <div className={`${CARD} lg:col-span-2`}>
            <p className="text-xs text-[#4a6080] mb-2">Onde o gasto pesa</p>
            {linhasCusto.map(([l, val, href]) => (
              <Link key={l} href={href} className="block my-2 group">
                <span className="flex justify-between gap-2 text-sm text-[#94a3b8] group-hover:text-white">
                  <span>{l}</span>
                  <span className="text-white">{reais(val)} <span className="text-[#4a6080]">{Math.round((val / custos.total) * 100)}%</span></span>
                </span>
                <span className="block h-1.5 bg-[#0a1628] rounded-full mt-1">
                  <span className="block h-1.5 bg-[#f05a28] rounded-full" style={{ width: `${Math.max(0, (val / custos.total) * 100)}%` }} />
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 1.3b */}
      <h3 className="text-base font-semibold text-white mb-1">Gasto dos extratos por centro de custo</h3>
      <p className={LEAD}>
        Ticketlog (combustível) e Veloe (pedágio e estacionamento) no mês. A equipe e o centro de custo são os da data de uso.
        Não somam no quadro de cima, para não contar o combustível duas vezes.
      </p>
      {extratos.linhas.length === 0 ? (
        <div className={`${CARD} text-center mb-10`}><p className="text-white">Nenhum extrato com uso neste mês.</p></div>
      ) : (
        <div className="rounded-xl border border-[#1e3a5f] overflow-x-auto mb-10">
          <table className="w-full text-sm min-w-[520px]">
            <thead>
              <tr className="border-b border-[#1e3a5f] bg-[#0d2050]">
                <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Centro de custo</th>
                <th className="text-right px-4 py-3 text-[#4a6080] font-medium">Ticketlog</th>
                <th className="text-right px-4 py-3 text-[#4a6080] font-medium">Veloe</th>
                <th className="text-right px-4 py-3 text-[#4a6080] font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {extratos.linhas.map((l) => (
                <tr key={l.codigo ?? '__none'} className="border-b border-[#1e3a5f] hover:bg-[#0d2050]">
                  <td className="px-4 py-3">
                    <Link
                      href={`/sofia/extratos/gastos?cc=${encodeURIComponent(l.codigo ?? '__none')}&${periodo}`}
                      className={l.codigo ? 'text-white hover:text-[#f05a28]' : 'text-[#f05a28]'}
                    >
                      {l.codigo ? `${l.codigo} ` : ''}
                      <span className={l.codigo ? 'text-[#94a3b8]' : ''}>{l.nome}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right text-[#94a3b8]">{centavosParaReais(l.ticketlogCentavos)}</td>
                  <td className="px-4 py-3 text-right text-[#94a3b8]">{centavosParaReais(l.veloeCentavos)}</td>
                  <td className="px-4 py-3 text-right text-white">{centavosParaReais(l.totalCentavos)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-[#0d2050] font-medium">
                <td className="px-4 py-3 text-white">Total</td>
                <td className="px-4 py-3 text-right text-white">{centavosParaReais(extratos.linhas.reduce((s, l) => s + l.ticketlogCentavos, 0))}</td>
                <td className="px-4 py-3 text-right text-white">{centavosParaReais(extratos.linhas.reduce((s, l) => s + l.veloeCentavos, 0))}</td>
                <td className="px-4 py-3 text-right text-white">{centavosParaReais(extratos.totalCentavos)}</td>
              </tr>
            </tfoot>
          </table>
          <p className="text-xs text-[#4a6080] px-4 py-2">Período: {dataBR(inicioMes)} a {dataBR(hoje)}</p>
        </div>
      )}

      {/* 1.4 */}
      <h2 className={H2}>Atalhos</h2>
      <p className={LEAD}>Os formulários são os que já existem; só mudam de lugar.</p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {atalhos
          .filter(([, , soGestor]) => !soGestor || gestor)
          .map(([label, href]) => (
            <Link key={href} href={href} className={`${CARD} hover:border-[#f05a28] transition-colors`}>
              <p className="text-white font-medium text-sm">{label}</p>
              <p className="text-xs text-[#4a6080] mt-1">abre o formulário</p>
            </Link>
          ))}
      </div>
    </div>
  )
}
