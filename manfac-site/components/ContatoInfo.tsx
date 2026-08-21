import WhatsAppIcon from './WhatsAppIcon'
import { buildDirectWhatsAppUrl, WHATSAPP_COMERCIAL_DISPLAY } from '@/lib/whatsapp'

/**
 * Cartão com os canais diretos de contato, ao lado do formulário.
 *
 * Só WhatsApp e e-mail. Instagram e telefone fixo não entram: o cliente
 * ainda não confirmou se existem, e um canal errado no site é pior do que
 * um canal a menos.
 */
export default function ContatoInfo() {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--ink)]">
        Prefere falar direto?
      </h2>
      <div className="mt-4 flex flex-col gap-4">
        <a
          href={buildDirectWhatsAppUrl('Página de contato')}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 text-[15px] text-[var(--body-text)] transition-colors hover:text-[var(--orange)]"
        >
          <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-[#25d366] text-white">
            <WhatsAppIcon size={17} />
          </span>
          {WHATSAPP_COMERCIAL_DISPLAY}
        </a>
        <a
          href="mailto:contato@manfac.com.br"
          className="flex items-center gap-3 text-[15px] text-[var(--body-text)] transition-colors hover:text-[var(--orange)]"
        >
          <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-[var(--orange)] text-white">
            @
          </span>
          contato@manfac.com.br
        </a>
      </div>
    </div>
  )
}
