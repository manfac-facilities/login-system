'use client'

/**
 * BLOCO **IDENTIFICAÇÃO** da ficha — o que a obra é.
 * J4, seção B do `mockup-j4-v03.html` (`ideLeitura`/`ideForm`, :923-935).
 * Ver spec-ficha-editavel-2026-09-18.md §5.1, R19 e R20.
 *
 * NÚMERO DA OS, LOJA E CHAMADO NÃO SE EDITAM AQUI, e a tela diz por quê em vez
 * de só desabilitar o campo. A razão é do sistema, não da tela: a sincronização
 * com o Field só preenche `loja`/`descricao` quando estão VAZIAS
 * (`sincronizar/_sincronizacao.ts:317-327`). Se a ficha deixasse digitar uma
 * loja, a recarga de 5 minutos nunca mais a corrigiria e ninguém seria avisado
 * da divergência — o erro ficaria congelado no hub para sempre.
 *
 * O corolário é a invariante R20: todo campo que este bloco grava está FORA da
 * lista que o Field toca. Os dois conjuntos são disjuntos, e é por isso que a
 * edição manual e a recarga automática convivem sem trava nenhuma.
 *
 * A ORIGEM SAIU DAQUI (feedback 14 A do cliente) e foi para o bloco
 * Autorização: ela é por onde chegou o OK, não o que a obra é.
 */

import { useState, useTransition } from 'react'
import { Campo, Campos, Pill } from '../../_ui/primitivos'
import { TIPOS_OBRA } from '../../_lib/tipos'
import {
  validarIdentificacao,
  type DadosIdentificacao,
  type Erros,
} from '../../_lib/ficha-campos'
import BlocoEditavel, {
  CampoForm,
  Entrada,
  EtiquetaField,
  GradeForm,
  HINT_SEM_MOTIVO,
  Selecao,
  SoLeitura,
  focarPrimeiroInvalido,
  ERRO_DE_REDE,
} from './_bloco-editavel'

/** O tipo MÍNIMO que este bloco usa de `salvarIdentificacaoAction` (§4.2). */
export type SalvarIdentificacao = (
  obraId: string,
  dados: DadosIdentificacao
) => Promise<{ error?: string; success?: boolean }>

const CAMPOS = [
  ['tipo', 'b-ide-tipo'],
  ['valor', 'b-ide-valor'],
  ['analista', 'b-ide-analista'],
] as const

export default function BlocoIdentificacao({
  obraId,
  valores,
  campoDoField,
  analistas,
  rodape,
  salvar,
}: {
  obraId: string
  /** O que está gravado hoje. `valor` é texto pt-BR: '18.450,00'. */
  valores: DadosIdentificacao
  /** O que vem do Field e não se edita aqui (R19). */
  campoDoField: { os: string | null; loja: string | null; chamado: string | null }
  analistas: readonly string[]
  rodape: React.ReactNode
  salvar: SalvarIdentificacao
}) {
  const [editando, setEditando] = useState(false)
  const [rascunho, setRascunho] = useState<DadosIdentificacao>(valores)
  const [erros, setErros] = useState<Erros<DadosIdentificacao>>({})
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, iniciar] = useTransition()

  function editar() {
    setRascunho(valores)
    setErros({})
    setErro(null)
    setEditando(true)
  }

  function cancelar() {
    setErros({})
    setErro(null)
    setEditando(false)
  }

  function campo<K extends keyof DadosIdentificacao>(k: K, v: DadosIdentificacao[K]) {
    setRascunho((r) => ({ ...r, [k]: v }))
  }

  function aoSalvar() {
    const e = validarIdentificacao(rascunho, { tipoAtual: valores.tipo })
    setErros(e)
    if (Object.keys(e).length) {
      focarPrimeiroInvalido(CAMPOS, e)
      return
    }
    setErro(null)
    iniciar(async () => {
      try {
        const r = await salvar(obraId, rascunho)
        if (r?.error) {
          // R21: o que foi digitado continua na tela.
          setErro(r.error)
          return
        }
        setEditando(false)
      } catch {
        // Queda de rede: a action nunca lança, mas o transporte da Server Action sim.
        // Sem isto a página inteira morre e a promessa da caixa de erro não se cumpre.
        setErro(ERRO_DE_REDE)
      }
    })
  }

  /* ---------------------------------------------------------------- leitura */

  const leitura = (
    <Campos cols={2}>
      <Campo rotulo="Nº OS">
        {campoDoField.os ? (
          <>
            <span className="font-mono">{campoDoField.os}</span>
            <EtiquetaField />
          </>
        ) : null}
      </Campo>
      <Campo rotulo="Loja">
        {campoDoField.loja ? (
          <>
            {campoDoField.loja}
            <EtiquetaField />
          </>
        ) : null}
      </Campo>
      <Campo rotulo="Chamado">
        {campoDoField.chamado ? (
          <>
            {campoDoField.chamado}
            <EtiquetaField />
          </>
        ) : null}
      </Campo>
      <Campo rotulo="Tipo">{valores.tipo}</Campo>
      <Campo rotulo="Valor">
        {valores.valor ? (
          <span className="font-mono">R$ {valores.valor}</span>
        ) : (
          <span className="text-[#f05a28]">sem orçamento</span>
        )}
      </Campo>
      <Campo rotulo="Analista do cliente">{valores.analista}</Campo>
      <Campo rotulo="Classificação">
        {valores.mauUso ? <Pill cor="#f4b73f">Mau uso</Pill> : 'normal'}
      </Campo>
    </Campos>
  )

  /* ------------------------------------------------------------- formulário */

  const formulario = (
    <GradeForm>
      <div className="min-w-0 sm:col-span-2">
        <span className="block text-[11px] uppercase tracking-wide text-[#94a3b8]">
          Nº OS · Loja · Chamado
          <EtiquetaField />
        </span>
        <SoLeitura>
          <span className="font-mono">{campoDoField.os ?? '—'}</span> · {campoDoField.loja ?? '—'}
          <br />
          {campoDoField.chamado ?? '—'}
        </SoLeitura>
        <span className="mt-1 block text-[11px] leading-snug text-[#64748b]">
          Não se editam aqui: corrija no Field. A sincronização só preenche o que está vazio.
        </span>
      </div>

      <CampoForm id="b-ide-tipo" rotulo="Tipo" erro={erros.tipo}>
        <Selecao
          id="b-ide-tipo"
          opcoes={TIPOS_OBRA}
          valor={rascunho.tipo}
          vazio="— não sei ainda —"
          desabilitado={salvando}
          invalido={!!erros.tipo}
          onChange={(v) => campo('tipo', v)}
        />
      </CampoForm>

      <CampoForm id="b-ide-valor" rotulo="Valor (R$)" erro={erros.valor}>
        <Entrada
          id="b-ide-valor"
          tipo="text"
          inputMode="decimal"
          placeholder="ex.: 18.450,00"
          valor={rascunho.valor}
          desabilitado={salvando}
          invalido={!!erros.valor}
          onChange={(v) => campo('valor', v)}
        />
      </CampoForm>

      <CampoForm id="b-ide-analista" rotulo="Analista do cliente" erro={erros.analista} larga>
        <Selecao
          id="b-ide-analista"
          opcoes={analistas}
          valor={rascunho.analista}
          vazio="— não sei ainda —"
          desabilitado={salvando}
          invalido={!!erros.analista}
          onChange={(v) => campo('analista', v)}
        />
      </CampoForm>

      <div className="min-w-0 sm:col-span-2">
        <label
          htmlFor="b-ide-mau"
          className="flex min-h-9 items-center gap-2 text-sm text-[#e8eef7]"
        >
          <input
            id="b-ide-mau"
            type="checkbox"
            checked={rascunho.mauUso}
            disabled={salvando}
            onChange={(e) => campo('mauUso', e.target.checked)}
          />
          Mau uso
        </label>
        <span className="mt-1 block text-[11px] leading-snug text-[#64748b]">
          Dano por uso indevido do cliente. É etiqueta, não etapa: a obra segue o mesmo caminho.
        </span>
      </div>
    </GradeForm>
  )

  return (
    <BlocoEditavel
      id="ide"
      titulo="Identificação"
      editando={editando}
      salvando={salvando}
      erro={erro}
      oQueNaoSalvou="a identificação"
      hint={HINT_SEM_MOTIVO}
      leitura={leitura}
      formulario={formulario}
      rodape={rodape}
      onEditar={editar}
      onSalvar={aoSalvar}
      onCancelar={cancelar}
    />
  )
}
