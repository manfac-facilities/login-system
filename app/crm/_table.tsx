import type { Lead } from '@/lib/leads/formato'
import { formatarData, linkWhatsApp, estaCompleto } from '@/lib/leads/formato'

// Componente de apresentação puro: sem estado nem evento, não precisa de
// 'use client'. `site_leads` é registro de captura imutável — esta tela não
// escreve nela, então não há Server Action nem interação aqui.
export default function LeadsTable({ leads }: { leads: Lead[] }) {
  if (leads.length === 0) {
    return (
      <p className="text-[#94a3b8]">
        Nenhum lead chegou ainda. Assim que alguém preencher o formulário do site, ele aparece aqui.
      </p>
    )
  }

  return (
    <ul className="flex flex-col gap-4">
      {leads.map((lead) => {
        const completo = estaCompleto(lead)
        return (
          <li
            key={lead.id}
            className="rounded-xl border border-[#1e3a5f] bg-[#0d2050] p-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm text-[#94a3b8]">{formatarData(lead.criado_em)}</span>
                <span className="text-sm font-medium text-white">{lead.path}</span>
              </div>
              <span
                className={
                  completo
                    ? 'rounded-full border border-[#1e3a5f] px-2.5 py-0.5 text-xs font-medium text-[#94a3b8]'
                    : 'rounded-full border border-[#f05a28] px-2.5 py-0.5 text-xs font-medium text-[#f05a28]'
                }
              >
                {completo ? 'Completo' : 'Parcial'}
              </span>
            </div>

            <p className="mt-3 text-lg font-semibold text-white">{lead.nome}</p>

            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <a
                href={linkWhatsApp(lead.telefone)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#94a3b8] hover:text-[#f05a28] transition-colors"
              >
                {lead.telefone}
              </a>
              <a
                href={`mailto:${lead.email}`}
                className="text-[#94a3b8] hover:text-[#f05a28] transition-colors"
              >
                {lead.email}
              </a>
            </div>

            {completo && (
              <div className="mt-3 border-t border-[#1e3a5f] pt-3 text-sm text-[#94a3b8]">
                {(lead.empresa || lead.cargo) && (
                  <p>
                    {[lead.empresa, lead.cargo].filter(Boolean).join(' — ')}
                  </p>
                )}
                {lead.localidade && <p>{lead.localidade}</p>}
                {lead.unidades && <p>Unidades: {lead.unidades}</p>}
                {lead.resumo && <p className="mt-1 text-[#c3d3e6]">{lead.resumo}</p>}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
