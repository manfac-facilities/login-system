import Image from 'next/image'
import Link from 'next/link'
import WhatsAppIcon from './WhatsAppIcon'
import { SERVICOS_DATA } from '@/lib/servicos'
import { buildDirectWhatsAppUrl, WHATSAPP_COMERCIAL_DISPLAY } from '@/lib/whatsapp'

// TODO: dados do cliente — o João ainda não passou a tagline nem o endereço.
// Deixados como texto provisório visível de propósito: string vazia passaria
// despercebida e iria ao ar em branco.
const TAGLINE = 'Engenharia, manutenção e facilities para operações que não podem parar.'
const ENDERECO = 'Rio de Janeiro · RJ'

const INSTITUCIONAL = [
  { href: '/', label: 'Início' },
  { href: '/quem-somos', label: 'Quem somos' },
  { href: '/resultados', label: 'Resultados' },
  { href: '/contato', label: 'Contato' },
]

const colLink =
  'block py-1 text-sm text-[#b9cfe0] transition-all hover:translate-x-0.5 hover:text-[var(--orange)]'

function ColunaTitulo({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-3 font-mono text-[10px] uppercase tracking-[0.13em] text-[#6f96b8]">
      {children}
    </h3>
  )
}

export default function Footer() {
  return (
    <footer className="bg-[var(--ink)] text-[#b9cfe0]">
      <div className="mx-auto max-w-6xl px-6 pb-7 pt-14">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-[1.6fr_repeat(3,1fr)]">
          {/* Marca */}
          <div>
            <Image
              src="/logo.png"
              alt="Manfac Engenharia"
              width={140}
              height={38}
              className="brightness-0 invert"
            />
            <p className="mt-3 max-w-[30ch] text-sm text-[#9dbad0]">{TAGLINE}</p>
            <a
              href={buildDirectWhatsAppUrl('Rodapé')}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-[var(--orange)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--orange-hover)]"
            >
              <WhatsAppIcon size={15} />
              Falar agora
            </a>
          </div>

          {/* Serviços — hub + subpáginas, lidas de SERVICOS_DATA para não divergir do site */}
          <div>
            <ColunaTitulo>Serviços</ColunaTitulo>
            <Link href="/servicos" className={colLink}>
              Todos os serviços
            </Link>
            <div className="mt-1 border-l border-[#1d4a70] pl-3">
              {SERVICOS_DATA.map((s) => (
                <Link key={s.slug} href={`/servicos/${s.slug}`} className={`${colLink} text-xs`}>
                  {s.nome}
                </Link>
              ))}
            </div>
          </div>

          {/* Institucional */}
          <div>
            <ColunaTitulo>Institucional</ColunaTitulo>
            {INSTITUCIONAL.map((item) => (
              <Link key={item.href} href={item.href} className={colLink}>
                {item.label}
              </Link>
            ))}
          </div>

          {/* Contato */}
          <div>
            <ColunaTitulo>Contato</ColunaTitulo>
            <a
              href={buildDirectWhatsAppUrl('Rodapé · contato')}
              target="_blank"
              rel="noopener noreferrer"
              className={colLink}
            >
              {WHATSAPP_COMERCIAL_DISPLAY}
            </a>
            <a href="mailto:contato@manfac.com.br" className={colLink}>
              contato@manfac.com.br
            </a>
            <p className="py-1 text-sm text-[#8fb0c9]">{ENDERECO}</p>
          </div>
        </div>

        <div className="mt-9 flex flex-wrap justify-between gap-3 border-t border-[#124063] pt-5 text-xs text-[#7fa3c0]">
          <p>© {new Date().getFullYear()} Manfac Engenharia. Todos os direitos reservados.</p>
          <p>Rio de Janeiro · Brasil</p>
        </div>
      </div>
    </footer>
  )
}
