import { DesenhoFase } from '@/app/obras/obras/[id]/faseamento/_desenho'
import type { FaseCliente } from '../../../_lib/faseamento'

const dataBR = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : null

/** Seção Faseamento da aba Mapa: a última revisão emitida de cada fase, com prévia e "Abrir PDF". */
export default function SecaoFaseamento({ fases, raiz }: { fases: FaseCliente[]; raiz: string }) {
  if (!fases.length) return null
  return (
    <section aria-labelledby="faseamento-titulo" className="flex flex-col gap-3">
      <h2 id="faseamento-titulo" className="text-[20px] font-extrabold text-(--obra-ink)">
        Faseamento
      </h2>
      <p className="text-[14px] text-(--obra-muted-texto)">A planta de cada fase da obra, na última revisão emitida.</p>
      <ul className="grid gap-4 lg:grid-cols-2">
        {fases.map((f) => (
          <li key={f.faseId} className="min-w-0 rounded-2xl border border-(--obra-border) bg-(--obra-card) p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="text-[16px] font-semibold text-(--obra-ink)">
                  Fase {f.numero} · {f.nome}
                </h3>
                <p className="obra-num text-[14px] text-(--obra-muted-texto)">
                  R{f.revisao}
                  {dataBR(f.emitidaEm) ? ` · emitida em ${dataBR(f.emitidaEm)}` : ''}
                </p>
              </div>
              <a
                href={`${raiz}/faseamento/${f.revisaoId}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center rounded-lg border border-(--obra-border) px-3 text-[15px] font-semibold text-(--obra-ink) hover:bg-(--obra-trilho)"
              >
                Abrir PDF
              </a>
            </div>
            <div className="mt-3 overflow-hidden rounded-lg border border-(--obra-border)">
              <DesenhoFase camadas={f.camadas} base={{ url: f.plantaUrl, largura: f.plantaLargura, altura: f.plantaAltura }} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
