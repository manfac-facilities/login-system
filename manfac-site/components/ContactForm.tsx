'use client'

import { useState } from 'react'
import { buildWhatsAppUrl, type DemandPath } from '../lib/whatsapp'
import { registrarLeadAction, completarLeadAction } from '@/app/contato/_actions'
import { TEXTO_CONSENTIMENTO } from '@/lib/leads'

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
  const [etapa, setEtapa] = useState<1 | 2>(1)
  const [leadId, setLeadId] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  // Etapa 1 — obrigatórios.
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [consentimento, setConsentimento] = useState(false)
  const [armadilha, setArmadilha] = useState('')

  // Etapa 2 — tudo opcional.
  const [empresa, setEmpresa] = useState('')
  const [cargo, setCargo] = useState('')
  const [localidade, setLocalidade] = useState('')
  const [unidades, setUnidades] = useState('')
  const [resumo, setResumo] = useState('')

  function escolherPath(p: DemandPath) {
    setPath(p)
    setEtapa(1)
    setErro(null)
  }

  async function enviarEtapa1(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault()
    if (!path || enviando) return
    setEnviando(true)
    setErro(null)
    const r = await registrarLeadAction({ path, nome, email, telefone, consentimento, armadilha })
    setEnviando(false)
    if (r.ok === false) {
      setErro(r.erro)
      return
    }
    setLeadId(r.id)
    setEtapa(2)
  }

  async function concluir(comContexto: boolean) {
    if (comContexto && leadId) {
      await completarLeadAction(leadId, { empresa, cargo, localidade, unidades, resumo })
    }
    const url = buildWhatsAppUrl({
      path: path!,
      nome,
      email,
      telefone,
      ...(comContexto ? { empresa, cargo, localidade, unidades, resumo } : {}),
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
              onClick={() => escolherPath(p.path)}
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

        {path && etapa === 1 && (
          <form onSubmit={enviarEtapa1} className="mt-8 grid gap-4 text-left md:grid-cols-2">
            {/*
              Campo-armadilha: fora da tela, sem tab, invisível para leitor de tela.
              Gente nunca preenche; robô que varre o DOM preenche quase sempre.
            */}
            <input
              type="text"
              name="armadilha"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              className="absolute left-[-9999px] h-0 w-0 opacity-0"
              value={armadilha}
              onChange={(e) => setArmadilha(e.target.value)}
            />

            <div className="flex flex-col gap-1.5">
              <label htmlFor="ct-nome" className={labelCls}>
                Nome <span className="text-[var(--orange)]">*</span>
              </label>
              <input
                id="ct-nome"
                name="nome"
                required
                placeholder="Seu nome"
                className={inputCls}
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ct-email" className={labelCls}>
                E-mail <span className="text-[var(--orange)]">*</span>
              </label>
              <input
                id="ct-email"
                name="email"
                type="email"
                required
                placeholder="nome@empresa.com.br"
                className={inputCls}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ct-telefone" className={labelCls}>
                Telefone / WhatsApp <span className="text-[var(--orange)]">*</span>
              </label>
              <input
                id="ct-telefone"
                name="telefone"
                type="tel"
                required
                placeholder="(21) 9 9999-9999"
                className={inputCls}
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
              />
            </div>

            <label className="flex items-start gap-2.5 text-left md:col-span-2">
              <input
                type="checkbox"
                checked={consentimento}
                onChange={(e) => setConsentimento(e.target.checked)}
                className="mt-0.5 h-4 w-4 flex-none accent-[var(--orange)]"
              />
              <span className="text-[13px] leading-relaxed text-[var(--muted)]">
                {TEXTO_CONSENTIMENTO}
              </span>
            </label>

            {erro && (
              <p className="text-sm text-red-600 md:col-span-2" role="alert">
                {erro}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-5 md:col-span-2">
              <button
                type="submit"
                disabled={enviando}
                className="rounded-full bg-[var(--orange)] px-8 py-3.5 font-semibold uppercase tracking-wider text-white transition-colors hover:bg-[var(--orange-hover)] disabled:opacity-60"
              >
                {enviando ? 'Enviando…' : 'Continuar'}
              </button>
              <p className="text-xs leading-relaxed text-[var(--muted)]">
                <span className="text-[var(--orange)]">*</span> Campos obrigatórios{' '}
                · Resposta em até 1 dia útil
              </p>
            </div>
          </form>
        )}

        {path && etapa === 2 && (
          <div className="mt-8 grid gap-4 text-left md:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ct-empresa" className={labelCls}>
                Empresa <span className="font-normal text-[var(--muted)]">(opcional)</span>
              </label>
              <input
                id="ct-empresa"
                name="empresa"
                placeholder="Nome da empresa"
                className={inputCls}
                value={empresa}
                onChange={(e) => setEmpresa(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ct-cargo" className={labelCls}>
                Cargo <span className="font-normal text-[var(--muted)]">(opcional)</span>
              </label>
              <input
                id="ct-cargo"
                name="cargo"
                placeholder="Ex.: Gerente de Facilities"
                className={inputCls}
                value={cargo}
                onChange={(e) => setCargo(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ct-localidade" className={labelCls}>
                Localidade das unidades <span className="font-normal text-[var(--muted)]">(opcional)</span>
              </label>
              <input
                id="ct-localidade"
                name="localidade"
                placeholder="Ex.: RJ capital e Baixada"
                className={inputCls}
                value={localidade}
                onChange={(e) => setLocalidade(e.target.value)}
              />
            </div>
            {path === 'Manutenção recorrente' && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="ct-unidades" className={labelCls}>
                  Nº de unidades <span className="font-normal text-[var(--muted)]">(opcional)</span>
                </label>
                <select
                  id="ct-unidades"
                  name="unidades"
                  className={inputCls}
                  value={unidades}
                  onChange={(e) => setUnidades(e.target.value)}
                >
                  <option value="">Selecione…</option>
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
                value={resumo}
                onChange={(e) => setResumo(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-3 md:col-span-2">
              <button
                type="button"
                onClick={() => concluir(true)}
                className="rounded-full bg-[var(--orange)] px-8 py-3.5 font-semibold uppercase tracking-wider text-white transition-colors hover:bg-[var(--orange-hover)]"
              >
                Enviar e falar no WhatsApp
              </button>
              <button
                type="button"
                onClick={() => concluir(false)}
                className="rounded-full border border-[var(--border)] px-8 py-3.5 font-semibold uppercase tracking-wider text-[var(--ink)] transition-colors hover:border-[var(--orange)]"
              >
                Pular e falar agora
              </button>
              <p className="text-xs leading-relaxed text-[var(--muted)]">
                Abre no seu WhatsApp · Resposta em até 1 dia útil
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
