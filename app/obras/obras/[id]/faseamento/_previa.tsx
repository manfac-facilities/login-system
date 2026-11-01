/**
 * Prévia da prancha A3 paisagem no navegador (mockup `renderSheet`): a mesma
 * disposição do PDF (`_lib/prancha-pdf.tsx`) — desenho à esquerda; à direita
 * título, obra, legenda, regras, trava e carimbo. Em SVG/HTML e não num
 * `<iframe>` do PDF: o hub manda `X-Frame-Options: DENY` e
 * `frame-ancestors 'none'` para todas as rotas. Mostra o que está na tela,
 * inclusive o que ainda não foi salvo; o PDF de verdade é o "Gerar PDF".
 */
import { TIPOS, legendaDe, type Camada, type Carimbo, type TipoCamada } from './_lib/camadas'
import { dataBR } from './_lib/trava'
import { DesenhoFase, grupoDe } from './_desenho'
import type { BaseDesenho } from './_tipos'

function Amostra({ t }: { t: TipoCamada }) {
  const d = TIPOS[t]
  const g = grupoDe(t)
  return (
    <svg width={26} height={14} viewBox="0 0 26 14" aria-hidden="true" className="shrink-0">
      {g === 'zona' ? <rect x={0.5} y={0.5} width={25} height={13} fill={t === 'restrita' ? '#fde9e1' : d.cor} stroke={t === 'zona_obra' ? '#e0531f' : '#0d205055'} strokeDasharray={t === 'zona_obra' ? '4 2' : undefined} /> : null}
      {g === 'linha' ? <path d="M1 7H25" stroke={d.cor} strokeWidth={t === 'drywall' ? 5 : 7} strokeDasharray={t === 'balcao' ? '9 2' : undefined} /> : null}
      {g === 'fluxo' ? (
        <>
          <path d="M1 7H20" stroke={d.cor} strokeWidth={2.5} strokeDasharray="5 3" />
          <path d="M19 3l6 4-6 4z" fill={d.cor} />
        </>
      ) : null}
      {g === 'porta' ? <rect x={10} y={0.5} width={6} height={13} fill="#fff" stroke={d.cor} strokeWidth={2.5} /> : null}
      {t === 'extintor' ? <circle cx={13} cy={7} r={6.5} fill={d.cor} /> : null}
      {t === 'emerg' ? <rect x={4} y={1} width={18} height={12} rx={2} fill={d.cor} /> : null}
    </svg>
  )
}

function Celula({ rotulo, valor, cheia }: { rotulo: string; valor: string; cheia?: boolean }) {
  return (
    <div className={`border-t border-[#dbe1ec] p-1 ${cheia ? 'col-span-2' : ''}`}>
      <span className="block text-[8px] uppercase tracking-wide text-[#5b6782]">{rotulo}</span>
      <b className="block break-words text-[10px] text-[#0d2050]">{valor || '—'}</b>
    </div>
  )
}

export default function PreviaPrancha(p: {
  obra: { nome: string; os: string }
  fase: { numero: number; nome: string }
  revisao: number
  emitidaEm: string | null
  camadas: Camada[]
  regras: string[]
  carimbo: Carimbo
  travaTexto: string | null
  base: BaseDesenho
}) {
  const visiveis = p.camadas.filter((c) => !c.oculta)
  return (
    <div className="overflow-x-auto">
      <div
        aria-label="Prévia da prancha A3"
        role="img"
        className="relative mx-auto flex aspect-[420/297] w-full min-w-[720px] gap-3 border border-[#222] bg-white p-3 text-[#14213d]"
      >
        <div className="flex min-w-0 flex-1 flex-col border border-[#222]">
          <div className="flex flex-1 items-center justify-center p-1">
            <div className="w-full">
              <DesenhoFase camadas={p.camadas} base={p.base} />
            </div>
          </div>
          <div className="border-t border-[#dbe1ec] px-2 py-1 text-[9px] font-semibold text-[#444]">
            {p.base.url ? `BASE: ${(p.carimbo.base || 'PLANTA DO MAPA').toUpperCase()}` : 'Sem planta enviada: camadas sobre quadro branco'}
          </div>
        </div>
        <div className="flex w-[37%] shrink-0 flex-col gap-1.5 overflow-hidden">
          <b className="text-[15px] tracking-wide text-[#0d2050]">MANFAC</b>
          <h4 className="text-[13px] leading-tight font-bold text-[#0d2050]">{p.carimbo.titulo || `Fase ${p.fase.numero} · ${p.fase.nome}`}</h4>
          <p className="text-[10px]">
            {p.obra.nome} · OS {p.obra.os}
          </p>
          <div className="h-0.5 bg-[#f05a28]" />
          <div>
            <h5 className="text-[9px] font-bold tracking-wide text-[#b94606] uppercase">Legenda</h5>
            <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
              {legendaDe(visiveis).map((l) => (
                <div key={l.t} className="flex items-center gap-1 text-[9px]">
                  <Amostra t={l.t} />
                  <span>{l.nome}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="min-h-0 flex-1">
            <h5 className="text-[9px] font-bold tracking-wide text-[#b94606] uppercase">Regras</h5>
            <ol className="list-decimal pl-4 text-[9.5px] leading-snug">
              {p.regras.map((r, i) => (
                <li key={i} className="break-words">
                  {r}
                </li>
              ))}
            </ol>
          </div>
          {p.travaTexto ? <div className="border border-[#b42318] px-1.5 py-1 text-[9px] text-[#b42318]">{p.travaTexto}</div> : null}
          <div className="grid grid-cols-2 border border-[#dbe1ec]">
            <Celula rotulo="Cliente" valor={p.carimbo.cliente} />
            <Celula rotulo="Obra" valor={`${p.obra.nome} · OS ${p.obra.os}`} />
            <Celula rotulo="Desenho" valor={p.carimbo.desenho} />
            <Celula rotulo="Base" valor={p.carimbo.base} />
            <Celula rotulo="Responsável técnico" valor={p.carimbo.rt} cheia />
            <Celula rotulo="Data" valor={p.emitidaEm ? dataBR(p.emitidaEm) : '—'} />
            <Celula rotulo="Revisão" valor={`R${p.revisao}`} />
          </div>
        </div>
        {p.emitidaEm ? null : (
          <span aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center text-[64px] font-bold tracking-[0.2em] text-[#b42318] opacity-15 -rotate-12">
            RASCUNHO
          </span>
        )}
      </div>
    </div>
  )
}
