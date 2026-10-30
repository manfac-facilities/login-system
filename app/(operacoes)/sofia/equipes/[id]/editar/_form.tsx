'use client'
import { useActionState, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { editarEquipeAction } from '../../_actions'
import Dialogo, { Consequencias } from '@/components/sofia/Dialogo'

interface MotoristaOpcao {
  id: string
  nome: string
  equipeId: string | null
  equipeCodigo: string | null
}

interface Props {
  equipe: { id: string; codigo: string }
  veiculo: { placa: string; modelo: string } | null
  /** motoristas ATIVOS, em ordem de nome */
  motoristas: MotoristaOpcao[]
  outrosCodigos: string[]
}

const juntarNomes = (nomes: string[]) =>
  nomes.length <= 1 ? nomes.join('') : `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`

export default function EditarEquipeForm({ equipe, veiculo, motoristas, outrosCodigos }: Props) {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState(editarEquipeAction, {})
  const atuais = motoristas.filter((m) => m.equipeId === equipe.id)
  const [codigo, setCodigo] = useState(equipe.codigo)
  const [motoristaId, setMotoristaId] = useState(atuais[0]?.id ?? '')
  const [erro, setErro] = useState('')
  const [confirmando, setConfirmando] = useState(false)
  const fechar = useCallback(() => setConfirmando(false), [])

  useEffect(() => {
    // só o id vai na URL: a lista relê o código do banco
    if (state.success) router.push(`/sofia/equipes?editada=${equipe.id}`)
  }, [state, router, equipe.id])

  const codigoNovo = codigo.trim().toUpperCase()
  const novo = motoristas.find((m) => m.id === motoristaId) ?? null
  const mudouCodigo = codigoNovo !== equipe.codigo
  const mudouMotorista = !(
    atuais.length === (novo ? 1 : 0) && (novo ? atuais[0].id === novo.id : true)
  )
  const saem = atuais.filter((m) => m.id !== motoristaId)
  const vemDeOutra = novo && novo.equipeId && novo.equipeId !== equipe.id ? novo : null

  function salvar() {
    if (!codigoNovo) return setErro('Informe o código da equipe')
    if (outrosCodigos.some((c) => c.toUpperCase() === codigoNovo))
      return setErro(`Já existe uma equipe com o código ${codigoNovo}.`)
    if (!mudouCodigo && !mudouMotorista) return setErro('Nada foi alterado.')
    setErro('')
    setConfirmando(true)
  }

  const mensagemErro = erro || state.error

  return (
    <div className="flex flex-col gap-5">
      {mensagemErro && (
        <div className="px-4 py-3 rounded-lg border border-red-600 bg-red-950 text-red-300 text-sm">{mensagemErro}</div>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-[#94a3b8]">Código da equipe *</label>
        <input
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-[#94a3b8]">Motorista</label>
        <select
          value={motoristaId}
          onChange={(e) => setMotoristaId(e.target.value)}
          className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm"
        >
          <option value="">Sem motorista</option>
          {motoristas.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nome}
              {m.equipeId === equipe.id
                ? ' (atual)'
                : m.equipeId
                  ? ` — hoje na ${m.equipeCodigo ?? 'outra equipe'}`
                  : ' — sem equipe'}
            </option>
          ))}
        </select>
        {vemDeOutra && (
          <span className="text-amber-400 text-xs">
            {vemDeOutra.nome} hoje está na {vemDeOutra.equipeCodigo ?? 'outra equipe'}. Ao salvar, ele passa para a{' '}
            {equipe.codigo} e a {vemDeOutra.equipeCodigo ?? 'outra equipe'} fica sem motorista.
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-[#94a3b8]">Veículo</label>
        <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 rounded-lg bg-[#0d2050] border border-[#1e3a5f] text-sm">
          <span className="flex items-center gap-2 text-[#94a3b8]">
            <span aria-hidden="true">🔒</span>
            <span className="font-mono text-white">{veiculo?.placa ?? '—'}</span>
            {veiculo && <span className="text-[#4a6080]">· {veiculo.modelo}</span>}
          </span>
          <Link
            href={`/sofia/checklist/novo?tipo=troca&equipe_destino=${equipe.id}`}
            className="text-xs text-[#f05a28] hover:underline"
          >
            Trocar carro → fazer checklist
          </Link>
        </div>
        <span className="text-[#4a6080] text-xs">
          Trocar o carro exige o checklist de troca: é ele que registra fotos e o estado do carro na entrega.
        </span>
      </div>

      <div className="flex gap-3 mt-2">
        <Link
          href="/sofia/equipes"
          className="flex-1 py-2.5 text-center rounded-lg border border-[#1e3a5f] text-[#94a3b8] text-sm hover:border-[#94a3b8]"
        >
          Cancelar
        </Link>
        <button
          type="button"
          onClick={salvar}
          className="flex-1 py-2.5 rounded-lg bg-[#f05a28] text-white text-sm font-medium hover:bg-[#d94e22]"
        >
          Salvar alterações
        </button>
      </div>

      {confirmando && (
        <Dialogo
          titulo="Salvar alterações da equipe?"
          subtitulo={`${equipe.codigo} · carro ${veiculo?.placa ?? '—'} (não muda)`}
          onFechar={fechar}
        >
          {state.error && (
            <div className="mb-2 px-3 py-2 rounded-lg border border-red-600 bg-red-950 text-red-300 text-sm">
              {state.error}
            </div>
          )}
          <Consequencias titulo="O que vai mudar">
            <ul className="list-disc pl-5 flex flex-col gap-1">
              {mudouCodigo && (
                <li>
                  Código: <s>{equipe.codigo}</s> → <b className="text-white">{codigoNovo}</b>
                </li>
              )}
              {mudouMotorista && (
                <>
                  <li>
                    Motorista: <s>{atuais.length ? atuais.map((m) => m.nome).join(', ') : 'sem motorista'}</s> →{' '}
                    <b className="text-white">{novo ? novo.nome : 'sem motorista'}</b>
                  </li>
                  {saem.length > 0 && (
                    <li>
                      {juntarNomes(saem.map((m) => m.nome))} {saem.length > 1 ? 'ficam' : 'fica'} sem equipe.
                    </li>
                  )}
                  {vemDeOutra && (
                    <li>
                      {vemDeOutra.nome} sai da {vemDeOutra.equipeCodigo ?? 'outra equipe'}, que fica sem motorista.
                    </li>
                  )}
                </>
              )}
              <li>A alteração fica registrada na Auditoria.</li>
            </ul>
          </Consequencias>
          <form action={formAction} className="flex gap-3 mt-4">
            <input type="hidden" name="id" value={equipe.id} />
            <input type="hidden" name="codigo" value={codigoNovo} />
            <input type="hidden" name="motorista_id" value={motoristaId} />
            <button
              type="button"
              onClick={fechar}
              className="flex-1 py-2.5 rounded-lg border border-[#1e3a5f] text-[#94a3b8] text-sm hover:border-[#94a3b8]"
            >
              Voltar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 py-2.5 rounded-lg bg-[#f05a28] text-white text-sm font-medium hover:bg-[#d94e22] disabled:opacity-50"
            >
              {isPending ? 'Salvando...' : 'Salvar'}
            </button>
          </form>
        </Dialogo>
      )}
    </div>
  )
}
