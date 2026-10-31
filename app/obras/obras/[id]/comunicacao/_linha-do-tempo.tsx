'use client'

/**
 * Linha do tempo da Comunicação (Leva 2 §3.1): diários e semanais enviados (Abrir PDF),
 * registros manuais (ata: Baixar PDF / Enviar por e-mail) e comunicações
 * imediatas, com os envios de cada uma. Editar/Apagar só aparece quando o
 * servidor calculou `podeEditar` (autor ≤ 24 h ou admin) — e a action confere.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { apagarRegistroAction } from './_actions'
import EnvioAta from './_ata-envio'
import FormRegistro, { botaoSecundario } from './_registro-form'
import { TIPOS_REGISTRO, type DestinatarioOpcao, type Envio, type ItemLinha, type Registro } from './_tipos'

const dataBR = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '—')
const quando = (ts: string) => new Date(ts).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })
const ISO = /^\d{4}-\d{2}-\d{2}$/

const ROTULO_ENVIO: Record<string, string> = {
  diario: 'Diário enviado',
  ata: 'Ata enviada',
  imediata: 'Comunicação imediata enviada',
  semanal: 'Relatório semanal enviado',
}
const rotuloRegistro = (r: Registro) =>
  r.tipo === 'imediata' ? 'Comunicação imediata' : (TIPOS_REGISTRO.find((t) => t.valor === r.tipo)?.rotulo ?? r.tipo)

function LinhaEnvio({ e, obraId, compacta }: { e: Envio; obraId: string; compacta?: boolean }) {
  const ok = e.resultado === 'ok'
  return (
    <div className={compacta ? 'border-t border-[#e9e9e7] pt-2' : ''}>
      <div className="flex flex-wrap justify-between gap-2">
        <strong className="text-[#00345e]">
          {compacta ? 'E-mail' : (ROTULO_ENVIO[e.tipo ?? 'diario'] ?? 'Envio')}
          {e.tipo === 'diario' ? ` · diário de ${dataBR(e.referencia)}` : ''}
          {e.tipo === 'semanal' ? ` · semana de ${dataBR(e.referencia)}` : ''} · {e.lado === 'interno' ? 'interno' : 'cliente'}
        </strong>
        <span className={ok ? 'text-[#136c38]' : 'text-[#b23232]'}>{ok ? 'enviado' : e.resultado === 'falha' ? 'falhou' : '—'}</span>
      </div>
      <p className="text-xs text-[#5a7380]">
        {quando(e.enviadoEm)}
        {e.enviadoPor ? ` · por ${e.enviadoPor}` : ''}
      </p>
      <p className="break-words text-xs text-[#5a7380]">Para: {e.destinatarios.join(', ') || '—'}</p>
      {e.detalhe ? <p className="break-words text-xs text-[#b23232]">{e.detalhe}</p> : null}
      {e.tipo === 'diario' && e.referencia && ISO.test(e.referencia) ? (
        <a href={`/obras/obras/${obraId}/diario/pdf/${e.referencia}`} target="_blank" rel="noopener" className={`${botaoSecundario} mt-2`}>
          Abrir PDF
        </a>
      ) : null}
      {e.tipo === 'semanal' && e.referencia && ISO.test(e.referencia) ? (
        <a
          href={`/obras/obras/${obraId}/comunicacao/semanal/pdf/${e.referencia}`}
          target="_blank"
          rel="noopener"
          className={`${botaoSecundario} mt-2`}
        >
          Abrir PDF
        </a>
      ) : null}
    </div>
  )
}

function ItemRegistro({
  item,
  obraId,
  hoje,
  podeEnviar,
  destinatarios,
}: {
  item: Extract<ItemLinha, { tipo: 'registro' }>
  obraId: string
  hoje: string
  podeEnviar: boolean
  destinatarios: DestinatarioOpcao[]
}) {
  const router = useRouter()
  const r = item.registro
  const [editando, setEditando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const ata = r.tipo === 'reuniao' ? r.ata : null
  const pessoas = (r.participantes ?? '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean)

  async function apagar() {
    if (!window.confirm('Apagar este registro? Os envios já feitos continuam no histórico.')) return
    setErro(null)
    const res = await apagarRegistroAction(obraId, r.id)
    if (!res.ok) setErro(res.erro)
    else router.refresh()
  }

  if (editando && r.tipo !== 'imediata') {
    return (
      <FormRegistro
        obraId={obraId}
        hoje={hoje}
        registroId={r.id}
        inicial={{
          tipo: r.tipo,
          data: r.data,
          participantes: r.participantes ?? '',
          texto: r.texto ?? '',
          ata: ata ? { pauta: ata.pauta ?? '', decisoes: ata.decisoes ?? [], pendencias: ata.pendencias ?? [] } : null,
        }}
        onFeito={() => setEditando(false)}
      />
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <strong className="text-[#00345e]">
          {rotuloRegistro(r)} · <span className="obra-num">{dataBR(r.data)}</span>
        </strong>
        {r.tipo === 'imediata' && r.nivel ? (
          <span
            className={`rounded-full border px-2 text-xs font-bold ${
              r.nivel === 'urgente' ? 'border-[#d64545] text-[#b23232]' : 'border-[#f7cb15] text-[#7a5c00]'
            }`}
          >
            {r.nivel === 'urgente' ? 'URGENTE' : 'ATENÇÃO'}
          </span>
        ) : null}
      </div>
      <p className="text-xs text-[#5a7380]">
        registrado {quando(r.criadoEm)}
        {r.criadoPor ? ` por ${r.criadoPor}` : ''}
        {r.editadoEm ? ` · editado ${quando(r.editadoEm)}` : ''}
      </p>
      {r.tipo === 'imediata' && r.ata?.assunto ? <p className="font-semibold">{r.ata.assunto}</p> : null}
      {pessoas.length ? <p className="text-xs text-[#5a7380]">Participantes: {pessoas.join(', ')}</p> : null}
      {ata ? (
        <div className="flex flex-col gap-1">
          <p><span className="text-xs text-[#5a7380]">Pauta:</span> {ata.pauta}</p>
          {ata.decisoes?.length ? (
            <div>
              <span className="text-xs text-[#5a7380]">Decisões</span>
              <ol className="list-decimal pl-5">{ata.decisoes.map((d, i) => <li key={i}>{d}</li>)}</ol>
            </div>
          ) : null}
          {ata.pendencias?.length ? (
            <div>
              <span className="text-xs text-[#5a7380]">Pendências</span>
              <ul className="list-disc pl-5">
                {ata.pendencias.map((p, i) => (
                  <li key={i}>
                    {p.oque}
                    {p.responsavel ? ` — ${p.responsavel}` : ''}
                    {p.prazo ? <span className="obra-num"> · até {dataBR(p.prazo)}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
      {r.texto ? <p className="whitespace-pre-wrap break-words">{r.texto}</p> : null}

      {item.envios.map((e) => (
        <LinhaEnvio key={e.id} e={e} obraId={obraId} compacta />
      ))}

      <div className="flex flex-wrap gap-2">
        {r.tipo === 'reuniao' ? (
          <a href={`/obras/obras/${obraId}/comunicacao/ata/${r.id}`} className={botaoSecundario}>
            Baixar PDF
          </a>
        ) : null}
        {item.podeEditar && r.tipo !== 'imediata' ? (
          <button type="button" onClick={() => setEditando(true)} className={botaoSecundario}>
            Editar
          </button>
        ) : null}
        {item.podeEditar ? (
          <button type="button" onClick={apagar} className={botaoSecundario}>
            Apagar
          </button>
        ) : null}
      </div>
      {r.tipo === 'reuniao' && podeEnviar ? (
        <EnvioAta obraId={obraId} registroId={r.id} resumo={ata?.pauta ?? ''} destinatarios={destinatarios} />
      ) : null}
      {erro ? <p role="alert" className="text-sm text-[#b23232]">{erro}</p> : null}
    </div>
  )
}

export default function LinhaDoTempo({
  itens,
  obraId,
  hoje,
  podeEnviar,
  destinatarios,
}: {
  itens: ItemLinha[]
  obraId: string
  hoje: string
  podeEnviar: boolean
  destinatarios: DestinatarioOpcao[]
}) {
  return (
    <ul className="flex flex-col gap-2">
      {itens.map((it) => (
        <li key={it.chave} className="rounded-xl border border-[#dadad8] bg-[#ffffff] p-3 text-sm text-[#333336]">
          {it.tipo === 'envio' ? (
            <LinhaEnvio e={it.envio} obraId={obraId} />
          ) : (
            <ItemRegistro item={it} obraId={obraId} hoje={hoje} podeEnviar={podeEnviar} destinatarios={destinatarios} />
          )}
        </li>
      ))}
    </ul>
  )
}
