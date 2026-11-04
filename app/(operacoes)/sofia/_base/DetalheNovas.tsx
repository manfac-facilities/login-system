'use client'

/**
 * Gaveta das bases da terceira bateria (Revisões, Manutenção corretiva, Multas, Sinistros, Documentos).
 * Textos do mockup aprovado (docs/frotas/mockups/2026-11-03-mockup-manutencao-e-bases.html, BASES.*.detalhe).
 * Ações específicas de cada tela chegam por `acoes` (prop `acoesDetalhe` do BaseTabela).
 */

import Link from 'next/link'
import { useState } from 'react'
import DeleteConfirmButton from '@/components/sofia/DeleteConfirmButton'
import { dataBR, fmtBrl, fmtKm } from '@/lib/sofia/correcoes'
import { DOCUMENTO_TIPO_LABELS } from '@/lib/sofia/enums'
import { ARCA_LBL, STATUS_LBL } from '@/lib/sofia/manutencoes'
import { textoSituacaoDoc } from '@/lib/sofia/bases/colunas'
import {
  AUT_LBL, MULTA_SIT_LBL, REV_SIT_LBL, SIN_SIT_LBL, SIN_TIPO_LBL,
  type BaseId, type CorrLinha, type DocLinha, type Linha, type MultaLinha, type RevLinha, type SinLinha,
} from '@/lib/sofia/bases/tipos'
import { obterUrlDocumentoPorIdAction } from '../documentos/_actions'
import { excluirRevisaoAction } from '../revisoes/_actions'

function Kv({ itens }: { itens: [string, React.ReactNode][] }) {
  return (
    <dl className="mb-4 grid grid-cols-[130px_1fr] gap-x-3 gap-y-2 text-sm">
      {itens.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-[#4a6080]">{k}</dt>
          <dd className="whitespace-pre-line break-words text-[#e8eef7]">{v ?? '—'}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Abre um arquivo do bucket por URL assinada (a aba abre antes do await: iOS bloqueia depois). */
export function AbrirArquivo({ rotulo, obter }: { rotulo: string; obter: () => Promise<{ url: string } | { error: string }> }) {
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  async function abrir() {
    setErro(null)
    const janela = window.open('', '_blank')
    if (!janela) {
      setErro('Não foi possível abrir o arquivo. Verifique o bloqueador de pop-ups.')
      return
    }
    setCarregando(true)
    const r = await obter()
    setCarregando(false)
    if ('url' in r) janela.location.href = r.url
    else {
      janela.close()
      setErro(r.error)
    }
  }
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button type="button" onClick={abrir} disabled={carregando} className="text-sm text-[#f05a28] hover:underline disabled:opacity-50">
        {carregando ? 'Abrindo…' : rotulo}
      </button>
      {erro && <span className="text-xs text-red-400">{erro}</span>}
    </span>
  )
}

const tipoRev = (t: string) => (t === 'corretiva' ? 'Corretiva' : t === 'preventiva' ? 'Preventiva' : t)

export default function DetalheNovas({
  base, r, podeGerir, acoes,
}: { base: BaseId; r: Linha; hoje: string; podeGerir: boolean; acoes?: React.ReactNode }) {
  if (base === 'rev') {
    const x = r as RevLinha
    const prox = x.proxKm == null
      ? 'sem previsão automática'
      : `${fmtKm(x.proxKm)} km${x.proxAuto && x.km != null ? ` (calculada: ${fmtKm(x.km)} + ${fmtKm(x.intervalo)})` : ' (informada à mão)'}`
    return (
      <>
        <Kv itens={[
          ['Placa', `${x.placa}${x.modelo ? ` · ${x.modelo}` : ''}`], ['Tipo', tipoRev(x.tipo)],
          ['Data / KM', `${x.data ? dataBR(x.data) : '—'} · ${x.km == null ? '—' : `${fmtKm(x.km)} km`}`],
          ['Oficina', x.oficina], ['Valor', x.valor == null ? null : fmtBrl(x.valor)], ['Peças trocadas', x.pecas],
          ['Observações', x.obs], ['Próxima', prox], ['Situação', REV_SIT_LBL[x.sit]],
          ['Origem', x.origem === 'importacao' ? 'Importada da planilha' : 'Registrada à mão'],
        ]} />
        <div className="flex flex-wrap items-center gap-4">
          <Link href={`/sofia/revisoes/nova?veiculo=${x.veiculoId}`} className="rounded-lg bg-[#f05a28] px-4 py-2 text-sm font-medium text-white hover:bg-[#d94e22]">
            Registrar a próxima revisão deste carro
          </Link>
          {podeGerir && (
            <DeleteConfirmButton action={excluirRevisaoAction} id={x.id} label="Excluir" itemLabel={`revisão de ${x.placa}${x.km == null ? '' : ` aos ${fmtKm(x.km)} km`}`} />
          )}
        </div>
        {acoes}
      </>
    )
  }

  if (base === 'corr') {
    const x = r as CorrLinha
    return (
      <>
        <Kv itens={[
          ['Placa', `${x.placa}${x.modelo ? ` · ${x.modelo}` : ''}`], ['Motorista', x.motorista], ['Defeito', x.defeito],
          ['Oficina', x.oficina], ['Entrada', dataBR(x.data)], ['Saída prevista', x.saidaPrev ? dataBR(x.saidaPrev) : null],
          ['Saída real', x.saida ? dataBR(x.saida) : 'ainda na oficina'],
          ['Custo', x.custo == null ? 'a definir' : fmtBrl(x.custo)], ['Quem arca', x.arca ? ARCA_LBL[x.arca] : null],
          ['Status', STATUS_LBL[x.status]],
          ['Carro saiu da equipe', x.tirou ? 'Sim (veículo em manutenção)' : 'Não (reparo de um dia)'],
          ['Dias parado', x.dias == null ? null : String(x.dias)], ['Observações', x.obs],
        ]} />
        {x.status === 'concluida' && (
          <p className="mb-3 rounded-lg border border-[#1e3a5f] bg-[#0d2050] px-3 py-2 text-sm text-[#94a3b8]">
            Manutenção concluída. Alterar depois exige gestor e fica no histórico de auditoria.
          </p>
        )}
        {acoes}
      </>
    )
  }

  if (base === 'multa') {
    const x = r as MultaLinha
    return (
      <>
        <Kv itens={[
          ['Placa', x.placa], ['Motorista', x.motorista], ['Infração', x.infracao], ['Data', dataBR(x.data)],
          ['Valor', fmtBrl(x.valor)], ['Descontado', x.desc ? fmtBrl(x.desc) : null], ['Etapa', MULTA_SIT_LBL[x.sit] ?? x.sit], ['Prazo de indicação', x.prazo ? dataBR(x.prazo) : null],
          ['Autorização', AUT_LBL[x.aut]],
        ]} />
        {acoes}
      </>
    )
  }

  if (base === 'sin') {
    const x = r as SinLinha
    return (
      <>
        <Kv itens={[
          ['Placa', x.placa], ['Motorista', x.motorista], ['Tipo', SIN_TIPO_LBL[x.tipo] ?? x.tipo], ['Data', dataBR(x.data)],
          ['Descrição', x.desc], ['Valor do dano', x.dano == null ? null : fmtBrl(x.dano)],
          ['Descontado', x.descontado ? fmtBrl(x.descontado) : null], ['Situação', SIN_SIT_LBL[x.sit]],
          ['Autorização', AUT_LBL[x.aut]],
        ]} />
        {acoes}
      </>
    )
  }

  const x = r as DocLinha
  return (
    <>
      <Kv itens={[
        ['Placa', `${x.placa}${x.modelo ? ` · ${x.modelo}` : ''}`], ['Tipo', DOCUMENTO_TIPO_LABELS[x.tipo] ?? x.tipo],
        ['Número', x.numero], ['Vencimento', dataBR(x.venc)], ['Situação', textoSituacaoDoc(x)],
      ]} />
      {x.temArquivo
        ? <AbrirArquivo rotulo="Ver arquivo" obter={() => obterUrlDocumentoPorIdAction(x.id)} />
        : <p className="text-sm text-[#4a6080]">Sem arquivo anexado.</p>}
      {acoes}
    </>
  )
}
