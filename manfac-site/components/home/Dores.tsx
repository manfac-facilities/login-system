import Reveal from '../Reveal'
import { DORES } from '@/lib/content'

export default function Dores() {
  return (
    <section className="border-b border-[var(--border)]">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <Reveal>
          <p className="font-mono text-xs uppercase tracking-widest text-[var(--orange)]">
            O problema que resolvemos
          </p>
          <h2 className="mt-3 max-w-3xl text-2xl font-bold leading-snug text-[var(--ink)] md:text-3xl">
            Para quem gerencia muitas unidades, cada fornecedor desalinhado vira custo, ruído e
            perda de controle.
          </h2>
        </Reveal>
        <div className="mt-10 overflow-x-auto">
          <table className="w-full border-collapse text-sm md:text-[15px]">
            <thead>
              <tr>
                <th scope="col" className="border-b-2 border-[var(--ink)] px-4 py-3 text-left font-mono text-xs uppercase tracking-widest text-[var(--muted)]">
                  Sua dor hoje
                </th>
                <th scope="col" className="border-b-2 border-[var(--ink)] px-4 py-3 text-left font-mono text-xs uppercase tracking-widest text-[var(--muted)]">
                  Como a Manfac responde
                </th>
              </tr>
            </thead>
            <tbody>
              {DORES.map((d) => (
                <tr key={d.dor}>
                  <td className="w-[38%] border-b border-[var(--border)] px-4 py-4 align-top font-semibold text-[var(--ink)]">
                    {d.dor}
                  </td>
                  <td className="border-b border-[var(--border)] px-4 py-4 align-top text-[var(--body-text)]">
                    {d.resposta}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
