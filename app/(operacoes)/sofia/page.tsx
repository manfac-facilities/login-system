import StatCard from '@/components/sofia/StatCard'
import AlertBanner from '@/components/sofia/AlertBanner'
import Link from 'next/link'
import {
  getEquipes,
  getVeiculos,
  getMotoristas,
  getMotoristasComCnhVencendo,
  getMultasPendentes,
  getSinistrosAbertos,
  getDocumentosVencendo,
  getRevisoesAtrasadas,
  getPendenciasManuais,
} from '@/lib/sofia/queries'

export default async function SofiaPage() {
  const [equipes, veiculos, motoristas, cnhVencendo, multasPendentes, sinistrosAbertos, documentosVencendo, revisoesAtrasadas, pendencias] =
    await Promise.all([
      getEquipes(),
      getVeiculos(),
      getMotoristas(),
      getMotoristasComCnhVencendo(),
      getMultasPendentes(),
      getSinistrosAbertos(),
      getDocumentosVencendo(),
      getRevisoesAtrasadas(),
      getPendenciasManuais(),
    ])

  const veiculosAtivos = veiculos.filter((v) => v.status === 'ativo').length
  const multasPendentesTotal = multasPendentes.reduce(
    (sum, m) => sum + m.valor,
    0
  )
  const disponibilidadePct = veiculos.length ? Math.round((veiculosAtivos / veiculos.length) * 100) : 0
  const pendenciasCriticas = pendencias.filter((p) => p.status !== 'concluida').length

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Visão Geral da Frota</h1>
        <p className="text-[#4a6080] text-sm mt-1">
          {new Date().toLocaleDateString('pt-BR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </p>
      </div>

      {cnhVencendo.length > 0 && (
        <div className="mb-6 flex flex-col gap-2">
          {cnhVencendo.map((m) => (
            <AlertBanner
              key={m.id}
              type="warning"
              message={`CNH de ${m.nome} vence em ${new Date(m.cnh_vencimento!).toLocaleDateString('pt-BR')} — providencie a renovação`}
            />
          ))}
        </div>
      )}

      {revisoesAtrasadas.length > 0 && (
        <div className="mb-6">
          <AlertBanner type="error" message={`${revisoesAtrasadas.length} manutenção(ões) atrasada(s) — veja em Revisões`} />
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <StatCard
          label="Equipes ativas"
          value={equipes.filter((e) => e.ativo).length}
          sub={`de ${equipes.length} cadastradas`}
        />
        <StatCard
          label="Veículos ativos"
          value={veiculosAtivos}
          sub={`de ${veiculos.length} cadastrados`}
        />
        <StatCard
          label="Motoristas ativos"
          value={motoristas.filter((m) => m.ativo).length}
        />
        <StatCard
          label="Multas pendentes"
          value={`R$ ${multasPendentesTotal.toFixed(2)}`}
          sub={`${multasPendentes.length} multa${multasPendentes.length !== 1 ? 's' : ''}`}
          accent={multasPendentes.length > 0}
        />
        <StatCard
          label="Disponibilidade"
          value={`${disponibilidadePct}%`}
          sub={`${veiculosAtivos} de ${veiculos.length} disponíveis`}
        />
        <StatCard
          label="Sinistros abertos"
          value={sinistrosAbertos.length}
          accent={sinistrosAbertos.length > 0}
        />
        <StatCard
          label="Documentos vencendo"
          value={documentosVencendo.length}
          sub="próximos 30 dias"
          accent={documentosVencendo.length > 0}
        />
        <StatCard
          label="Pendências críticas"
          value={pendenciasCriticas}
          accent={pendenciasCriticas > 0}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          {
            href: '/sofia/km',
            label: 'Lançar KM do dia',
            desc: 'Registrar quilometragem diária',
            icon: '📍',
          },
          {
            href: '/sofia/checklist/novo',
            label: 'Novo Checklist',
            desc: 'Checklist de saída ou retorno com foto',
            icon: '✓',
          },
          {
            href: '/sofia/multas/nova',
            label: 'Registrar Multa',
            desc: 'Adicionar infração de trânsito',
            icon: '⚠',
          },
          {
            href: '/sofia/equipes',
            label: 'Equipes',
            desc: 'Gerenciar equipes e veículos',
            icon: '🚐',
          },
          {
            href: '/sofia/motoristas',
            label: 'Motoristas',
            desc: 'Gerenciar habilitações',
            icon: '👤',
          },
          {
            href: '/sofia/revisoes',
            label: 'Revisões',
            desc: 'Controle de manutenção preventiva',
            icon: '🔧',
          },
          {
            href: '/sofia/sinistros/novo',
            label: 'Registrar Sinistro',
            desc: 'Batida, furto ou avaria',
            icon: '💥',
          },
          {
            href: '/sofia/pendencias',
            label: 'Pendências & Plano de Ação',
            desc: 'O que está aberto e quem é o dono',
            icon: '📋',
          },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-start gap-4 p-5 rounded-xl border border-[#1e3a5f] bg-[#0d2050] hover:border-[#f05a28] transition-colors group"
          >
            <span className="text-2xl">{item.icon}</span>
            <div>
              <p className="text-white font-medium group-hover:text-[#f05a28] transition-colors">
                {item.label}
              </p>
              <p className="text-[#4a6080] text-sm mt-0.5">{item.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
