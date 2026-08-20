import WhatsAppIcon from './WhatsAppIcon'
import { buildDirectWhatsAppUrl } from '@/lib/whatsapp'

/**
 * Botão flutuante de WhatsApp, montado uma vez no layout raiz.
 *
 * Fica **visível 100% do tempo**, desde o topo da página. Não há limiar de
 * scroll de propósito: esconder o botão até a pessoa rolar perde justamente
 * quem entra e decide na hora.
 *
 * Não é Client Component — é um link estático, sem estado nem efeito. O halo
 * pulsante é CSS puro (`.wa-float` em globals.css), então não custa JS.
 */
export default function WhatsAppFloat() {
  return (
    <a
      href={buildDirectWhatsAppUrl('Botão flutuante')}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Falar no WhatsApp"
      className="wa-float group fixed bottom-5 right-5 z-40 flex h-14 items-center overflow-hidden rounded-full bg-[#25d366] text-white transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] w-14 hover:w-[186px]"
    >
      <span className="grid h-14 w-14 flex-none place-items-center">
        <WhatsAppIcon size={26} />
      </span>
      <span className="whitespace-nowrap pr-5 text-sm font-semibold opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        Falar no WhatsApp
      </span>
    </a>
  )
}
