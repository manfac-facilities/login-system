'use client'
import Link from 'next/link'
import { useActionState, useState } from 'react'
import { enviarExtratoAction } from '../_actions'
import { brl, dataBR } from '@/lib/sofia/extratos/agrupar'

// Limite padrão de corpo de Server Action (1 MB) — docs/DIVIDAS.md de 28/10/2026
const LIMITE_BYTES = 1_000_000

const fld =
  'w-full px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white placeholder-[#4a6080] focus:outline-none focus:border-[#f05a28] text-sm'

export default function EnviarExtratoForm() {
  const [state, formAction, pendente] = useActionState(enviarExtratoAction, {})
  const [plataforma, setPlataforma] = useState<'ticketlog' | 'veloe'>('ticketlog')
  const [grande, setGrande] = useState(false)
  const ext = plataforma === 'ticketlog' ? '.xlsx' : '.csv'
  const nome = plataforma === 'ticketlog' ? 'Ticketlog' : 'Veloe'
  const r = state.resultado

  return (
    <div className="grid lg:grid-cols-2 gap-6 items-start">
      <form action={formAction} className="rounded-xl border border-[#1e3a5f] bg-[#0d2050] p-5">
        <fieldset className="mb-5">
          <legend className="block text-xs text-[#94a3b8] mb-1">1. Plataforma</legend>
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                ['ticketlog', 'Ticketlog', 'extrato .xlsx (aba “Transações”)'],
                ['veloe', 'Veloe', 'extrato .csv (separado por ;)'],
              ] as const
            ).map(([v, t, sub]) => (
              <label
                key={v}
                className={`cursor-pointer rounded-lg border p-3 ${plataforma === v ? 'border-[#f05a28] bg-[#f05a28]/10' : 'border-[#1e3a5f] hover:border-[#94a3b8]'}`}
              >
                <input
                  type="radio"
                  name="plataforma"
                  value={v}
                  checked={plataforma === v}
                  onChange={() => {
                    setPlataforma(v)
                    setGrande(false)
                  }}
                  className="sr-only"
                />
                <span className="block text-white font-semibold text-sm">{t}</span>
                <span className="block text-xs text-[#94a3b8]">{sub}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mb-5">
          <label className="block text-xs text-[#94a3b8] mb-1" htmlFor="arquivo">
            2. Arquivo ({ext})
          </label>
          <input
            key={plataforma}
            id="arquivo"
            name="arquivo"
            type="file"
            accept={ext}
            required
            onChange={(e) => setGrande((e.target.files?.[0]?.size ?? 0) > LIMITE_BYTES)}
            className={fld}
          />
          {grande && (
            <p role="alert" className="text-amber-300 text-xs mt-2">
              Este arquivo passa de 1 MB e o sistema não consegue receber. Baixe o extrato de um período menor (por
              exemplo, um mês) e envie em partes.
            </p>
          )}
        </div>

        <div className="mb-5">
          <label className="block text-xs text-[#94a3b8] mb-1" htmlFor="saldo">
            3. Saldo atual na plataforma (obrigatório)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-2.5 text-[#94a3b8] text-sm">R$</span>
            <input id="saldo" name="saldo" inputMode="decimal" placeholder="0,00" required className={`${fld} !pl-9`} />
          </div>
          <p className="text-xs text-[#94a3b8] mt-2">
            Digite o saldo que a {nome} mostra agora no portal. O extrato não traz saldo, e o financeiro usa esse
            número para conferir a conta corrente.
          </p>
        </div>

        <button
          type="submit"
          disabled={pendente || grande}
          className="w-full px-4 py-2.5 rounded-lg bg-[#f05a28] text-white text-sm font-medium hover:bg-[#d94e22] transition-colors disabled:opacity-50"
        >
          {pendente ? 'Enviando...' : 'Enviar extrato'}
        </button>
      </form>

      <div>
        {state.error && (
          <div role="alert" className="rounded-xl border border-red-700 bg-red-900/20 p-5">
            <div className="text-red-300 font-semibold mb-1">Não foi possível enviar</div>
            <p className="text-sm text-red-200">{state.error}</p>
          </div>
        )}
        {r && (
          <div className="rounded-xl border border-green-700 bg-green-900/15 p-5">
            <div className="text-green-300 font-semibold mb-3">Extrato processado</div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                ['novas', r.novas, 'text-white'],
                ['já existiam (ignoradas)', r.existentes, 'text-white'],
                ['sem centro de custo', r.semCentroCusto, r.semCentroCusto ? 'text-amber-400' : 'text-white'],
              ].map(([t, n, cor]) => (
                <div key={String(t)} className="bg-[#0a1628] rounded-lg p-3 text-center">
                  <div className={`text-2xl font-bold ${cor}`}>{n}</div>
                  <div className="text-xs text-[#94a3b8]">{t}</div>
                </div>
              ))}
            </div>
            <dl className="text-sm space-y-1">
              <div className="flex justify-between gap-3">
                <dt className="text-[#94a3b8]">Período coberto</dt>
                <dd className="text-white">
                  {dataBR(r.periodo.inicio)} a {dataBR(r.periodo.fim)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[#94a3b8]">Saldo registrado</dt>
                <dd className="text-white tabular-nums">{brl(r.saldo)}</dd>
              </div>
            </dl>
            {r.novas === 0 && r.divergentes.length === 0 && (
              <p className="text-xs text-green-200 mt-3">
                Nenhuma linha nova: este arquivo já tinha sido enviado. O saldo digitado foi guardado mesmo assim.
              </p>
            )}
            {r.divergentes.length > 0 && (
              <div className="mt-4 rounded-lg border border-amber-700 bg-amber-900/20 p-3">
                <p className="text-amber-300 text-sm font-semibold mb-1">
                  {r.divergentes.length} transação(ões) já existiam com valor diferente
                </p>
                <p className="text-xs text-[#94a3b8] mb-2">
                  Nada foi sobrescrito: vale o valor que já estava gravado. Confira com a plataforma.
                </p>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[#4a6080] text-left">
                      <th className="py-1 pr-2">Código</th>
                      <th className="py-1 pr-2 text-right">Gravado</th>
                      <th className="py-1 text-right">No arquivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.divergentes.map((d) => (
                      <tr key={d.codigo} className="text-[#cbd5e1]">
                        <td className="py-1 pr-2 tabular-nums">{d.codigo}</td>
                        <td className="py-1 pr-2 text-right tabular-nums">{brl(d.valorGravado)}</td>
                        <td className="py-1 text-right tabular-nums">{brl(d.valorArquivo)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex flex-wrap gap-2 mt-4">
              {r.semCentroCusto > 0 && (
                <Link
                  href="/sofia/extratos/sem-centro-custo"
                  className="px-3 py-1.5 rounded-lg bg-[#f05a28] text-white text-sm hover:bg-[#d94e22] transition-colors"
                >
                  Resolver “sem centro de custo”
                </Link>
              )}
              <Link
                href="/sofia/extratos/gastos"
                className="px-3 py-1.5 rounded-lg border border-[#1e3a5f] text-[#94a3b8] text-sm hover:border-[#94a3b8] transition-colors"
              >
                Ver gastos
              </Link>
            </div>
          </div>
        )}
        {!state.error && !r && (
          <div className="rounded-xl border border-[#1e3a5f] bg-[#0d2050] p-5 text-sm text-[#94a3b8]">
            <div className="text-white font-semibold mb-2">O que acontece ao enviar</div>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Cada linha é guardada pelo código da transação. Código que já existe é ignorado e nunca sobrescrito.</li>
              <li>A data usada é a data de uso (Veloe: não a de processamento).</li>
              <li>Se o cartão ou a tag não tem equipe, a linha entra mesmo assim e aparece em “Sem centro de custo”.</li>
              <li>Se o arquivo estiver errado, nada é gravado, nem o saldo.</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
