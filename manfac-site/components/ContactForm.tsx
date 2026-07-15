'use client'

import { useState } from 'react'
import { buildWhatsAppUrl, type DemandPath } from '../lib/whatsapp'

const PATHS: { path: DemandPath; description: string }[] = [
  {
    path: 'Manutenção recorrente',
    description: 'Contrato mensal com SLA, equipe, rotina de chamados e relatórios para suas unidades.',
  },
  {
    path: 'Obra ou reforma',
    description: 'Projeto pontual com escopo fechado, cronograma, orçamento e entrega técnica.',
  },
  {
    path: 'Avaliação técnica',
    description: 'Leitura técnica da sua operação atual para identificar riscos e oportunidades.',
  },
]

const inputCls =
  'min-h-11 rounded-lg border border-[var(--border)] bg-white px-3.5 py-3 text-[15px] text-[var(--body-text)] outline-none focus:border-[var(--orange)] focus:ring-2 focus:ring-[var(--orange)]/30'
const labelCls = 'text-[13px] font-semibold text-[var(--ink)]'

export default function ContactForm() {
  const [path, setPath] = useState<DemandPath | null>(null)

  function handleSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault()
    if (!path) return
    const f = new FormData(ev.currentTarget)
    const url = buildWhatsAppUrl({
      path,
      nome: String(f.get('nome') ?? ''),
      empresa: String(f.get('empresa') ?? ''),
      email: String(f.get('email') ?? ''),
      telefone: String(f.get('telefone') ?? ''),
      cargo: String(f.get('cargo') ?? '') || undefined,
      localidade: String(f.get('localidade') ?? ''),
      unidades: String(f.get('unidades') ?? '') || undefined,
      resumo: String(f.get('resumo') ?? '') || undefined,
    })
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <section className="border-b border-[var(--border)]">
      <div className="mx-auto max-w-4xl px-6 py-20 text-center md:py-28">
        <p className="font-mono text-xs uppercase tracking-widest text-[var(--orange)]">Contato</p>
        <h1 className="mt-3 text-3xl font-bold leading-tight text-[var(--ink)] md:text-4xl">
          Qual é a sua demanda?
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-[var(--muted)]">
          Escolha o caminho — leva menos de 1 minuto e sua mensagem já chega qualificada.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-3" role="group" aria-label="Tipo de demanda">
          {PATHS.map((p) => (
            <button
              key={p.path}
              type="button"
              aria-pressed={path === p.path}
              onClick={() => setPath(p.path)}
              className={`rounded-2xl border-2 p-5 text-left transition-shadow ${
                path === p.path
                  ? 'border-[var(--orange)] shadow-[0_0_0_3px_rgba(248,94,11,0.15)]'
                  : 'border-[var(--border)] hover:shadow-md'
              }`}
            >
              <span className="block font-bold text-[var(--ink)]">{p.path}</span>
              <span className="mt-1.5 block text-[13px] leading-relaxed text-[var(--muted)]">
                {p.description}
              </span>
            </button>
          ))}
        </div>

        {path && (
          <form onSubmit={handleSubmit} className="mt-8 grid gap-4 text-left md:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ct-nome" className={labelCls}>Nome</label>
              <input id="ct-nome" name="nome" required placeholder="Seu nome" className={inputCls} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ct-empresa" className={labelCls}>Empresa</label>
              <input id="ct-empresa" name="empresa" required placeholder="Nome da empresa" className={inputCls} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ct-email" className={labelCls}>E-mail corporativo</label>
              <input id="ct-email" name="email" type="email" required placeholder="nome@empresa.com.br" className={inputCls} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ct-telefone" className={labelCls}>Telefone / WhatsApp</label>
              <input id="ct-telefone" name="telefone" type="tel" required placeholder="(21) 9 9999-9999" className={inputCls} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ct-cargo" className={labelCls}>
                Cargo <span className="font-normal text-[var(--muted)]">(opcional)</span>
              </label>
              <input id="ct-cargo" name="cargo" placeholder="Ex.: Gerente de Facilities" className={inputCls} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ct-localidade" className={labelCls}>Localidade das unidades</label>
              <input id="ct-localidade" name="localidade" required placeholder="Ex.: RJ capital e Baixada" className={inputCls} />
            </div>
            {path === 'Manutenção recorrente' && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="ct-unidades" className={labelCls}>Nº de unidades</label>
                <select id="ct-unidades" name="unidades" className={inputCls} defaultValue="">
                  <option value="" disabled>Selecione…</option>
                  <option>1 a 10</option>
                  <option>11 a 50</option>
                  <option>51 a 200</option>
                  <option>200+</option>
                </select>
              </div>
            )}
            <div className="flex flex-col gap-1.5 md:col-span-2">
              <label htmlFor="ct-resumo" className={labelCls}>
                Resumo da demanda <span className="font-normal text-[var(--muted)]">(opcional)</span>
              </label>
              <textarea
                id="ct-resumo"
                name="resumo"
                rows={3}
                placeholder="Ex.: rede com 30 lojas, manutenção fragmentada em 4 fornecedores…"
                className={inputCls}
              />
            </div>
            <div className="flex flex-wrap items-center gap-5 md:col-span-2">
              <button
                type="submit"
                className="rounded-full bg-[var(--orange)] px-8 py-3.5 font-semibold uppercase tracking-wider text-white transition-colors hover:bg-[var(--orange-hover)]"
              >
                Agendar conversa técnica
              </button>
              <p className="text-xs leading-relaxed text-[var(--muted)]">
                Abre no seu WhatsApp · Resposta em até 1 dia útil
                <br />
                Prefere e-mail?{' '}
                <a href="mailto:contato@manfac.com.br" className="underline">contato@manfac.com.br</a>
              </p>
            </div>
          </form>
        )}
      </div>
    </section>
  )
}
