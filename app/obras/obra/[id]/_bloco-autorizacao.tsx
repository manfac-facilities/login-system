'use client'

/**
 * BLOCO **AUTORIZAÇÃO** da ficha — o que destrava a execução.
 * J4, seção B do `mockup-j4-v03.html` (`autLeitura`/`autForm`, :898-920).
 * Ver spec-ficha-editavel-2026-09-18.md §5.1, R7, R8, R16 e R17.
 *
 * O PROBLEMA QUE ELE RESOLVE: estes quatro campos só eram editáveis na Triagem,
 * e a Triagem desaparece quando a obra sai da etapa `definir`. Obra que já
 * andou nunca mais registrava quem liberou nem a data de aprovação da OS — e
 * são exatamente esses dois números que alimentam a contagem de obra em
 * atenção/crítica e os SLAs apresentados ao cliente toda semana.
 *
 * A ORIGEM MORA AQUI, não na Identificação: foi o pedido do cliente no feedback
 * 14 A — "por onde chegou o OK" é parte da autorização, não da identificação da
 * obra.
 *
 * "OS APROVADA EM" É UM CAMPO DE TELA PARA TRÊS COLUNAS (R7). A tela não sabe
 * disso e não precisa saber: ela manda uma data, e a Server Action mantém
 * `aprovacao`, `os_aprovada` e `marco_os_aprov` sempre coerentes.
 *
 * O AVANÇO DE ETAPA (E8/R16) é decidido pelo SERVIDOR; o que é da tela é
 * avisar antes. Com a obra parada em "Executado - pendente aprovação OS", preencher a
 * aprovação a faz avançar para "Fechar OS" — e ninguém pode descobrir isso
 * depois do clique. Por isso a janela de confirmação, com a lista do que vai
 * acontecer.
 */

import { useState, useTransition } from 'react'
import { Campo, Campos } from '../../_ui/primitivos'
import Dialogo, { type BotaoDialogo } from '../../_ui/dialogo'
import { ORIGENS, br, nomeEtapa, type Etapa } from '../../_lib/tipos'
import {
  validarAutorizacao,
  type DadosAutorizacao,
  type Erros,
} from '../../_lib/ficha-campos'
import BlocoEditavel, {
  CampoForm,
  Entrada,
  GradeForm,
  HINT_SEM_MOTIVO,
  Selecao,
  focarPrimeiroInvalido,
  ERRO_DE_REDE,
} from './_bloco-editavel'

/**
 * O tipo MÍNIMO que este bloco usa de `salvarAutorizacaoAction` (§4.1).
 * Vem por prop, e não por `import` de `_actions.ts`, para a tela não depender
 * do arquivo da outra frente nem para compilar nem para ser testada.
 */
export type SalvarAutorizacao = (
  obraId: string,
  dados: DadosAutorizacao
) => Promise<{ error?: string; success?: boolean; avancou?: boolean }>

/** Ordem da tela — é ela que decide para onde o foco vai no erro. */
const CAMPOS = [
  ['origem', 'b-aut-origem'],
  ['libPor', 'b-aut-libPor'],
  ['libEm', 'b-aut-libEm'],
  ['aprovadaEm', 'b-aut-aprov'],
] as const

export default function BlocoAutorizacao({
  obraId,
  valores,
  analistas,
  hoje,
  diasSemOS,
  etapa,
  responsavel,
  rodape,
  salvar,
}: {
  obraId: string
  /** O que está gravado hoje. O rascunho nasce daqui a cada **Editar**. */
  valores: DadosAutorizacao
  /** Quem pode aparecer em "Liberado por": os analistas do cliente. */
  analistas: readonly string[]
  /** `AAAA-MM-DD` vindo do servidor — a tela não inventa "hoje". */
  hoje: string
  /** Dias esperando a aprovação da OS. Só o texto de leitura usa. */
  diasSemOS: number | null
  etapa: Etapa
  /** Nome do responsável da obra, para o texto da janela de avanço. */
  responsavel: string | null
  rodape: React.ReactNode
  salvar: SalvarAutorizacao
}) {
  const [editando, setEditando] = useState(false)
  const [rascunho, setRascunho] = useState<DadosAutorizacao>(valores)
  const [erros, setErros] = useState<Erros<DadosAutorizacao>>({})
  const [erro, setErro] = useState<string | null>(null)
  const [avisoAvanco, setAvisoAvanco] = useState(false)
  const [salvando, iniciar] = useTransition()

  const liberada = !!valores.libPor
  const aprovada = !!valores.aprovadaEm

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

  function campo<K extends keyof DadosAutorizacao>(k: K, v: DadosAutorizacao[K]) {
    setRascunho((r) => ({ ...r, [k]: v }))
  }

  function gravar() {
    setErro(null)
    iniciar(async () => {
      try {
        const r = await salvar(obraId, rascunho)
        if (r?.error) {
          // R21: nada de sair do modo edição nem de limpar o rascunho.
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

  function aoSalvar() {
    const e = validarAutorizacao(rascunho, { hoje, origemAtual: valores.origem })
    setErros(e)
    if (Object.keys(e).length) {
      focarPrimeiroInvalido(CAMPOS, e)
      return
    }
    // R16: só a obra parada em `aprovarOS`, ganhando uma aprovação que não
    // tinha, avança. Em qualquer outra etapa a aprovação não move a obra (R17).
    if (etapa === 'aprovarOS' && rascunho.aprovadaEm && !valores.aprovadaEm) {
      setAvisoAvanco(true)
      return
    }
    gravar()
  }

  const botoesAvanco: BotaoDialogo[] = [
    { id: 'dlg-b-avancar', texto: 'Salvar e avançar para Fechar OS', onClick: gravar },
    { id: 'dlg-b-voltar', texto: 'Voltar ao formulário', ghost: true },
  ]

  /* ---------------------------------------------------------------- leitura */

  const leitura = (
    <>
      <Campos cols={2}>
        <Campo rotulo="Origem">
          {valores.origem || <span className="text-[#f05a28]">a definir</span>}
        </Campo>
        <Campo rotulo="Liberação">
          {liberada ? (
            <>
              Liberado por <b>{valores.libPor}</b> · {br(valores.libEm)}
            </>
          ) : (
            <span className="font-semibold text-[#ff4d6d]">Ninguém liberou esta obra</span>
          )}
        </Campo>
        <Campo rotulo="OS do cliente">
          {aprovada ? (
            <>OS aprovada em {br(valores.aprovadaEm)}</>
          ) : (
            <>
              <span className="font-semibold text-[#ff4d6d]">OS ainda não aprovada</span>
              {diasSemOS !== null ? (
                <span className="text-[#94a3b8]">
                  {' '}
                  · esperando a aprovação da OS há {diasSemOS} dias
                </span>
              ) : null}
            </>
          )}
        </Campo>
      </Campos>
      <p className="mt-3 text-[11px] leading-relaxed text-[#94a3b8]">
        {aprovada && liberada ? (
          <>
            A obra tem as duas coberturas: alguém autorizou a execução{' '}
            <b className="text-[#e8eef7]">e</b> existe OS aprovada no sistema do cliente. É o caso
            normal.
          </>
        ) : aprovada ? (
          <>
            A obra não precisou de liberação: a{' '}
            <b className="text-[#e8eef7]">OS já estava aprovada</b>, e a OS é a própria autorização.
          </>
        ) : liberada ? (
          <>
            A execução acontece com o <b className="text-[#e8eef7]">OK de {valores.libPor}</b>
            {valores.origem ? <> (chegou por {valores.origem.toLowerCase()})</> : null}, que se
            comprometeu a aprovar a OS depois.
            {diasSemOS !== null ? (
              <>
                {' '}
                Os dias esperando a aprovação da OS já somam{' '}
                <b className="text-[#e8eef7]">{diasSemOS} dias</b>, e é {valores.libPor} quem a
                Manfac vai procurar.
              </>
            ) : null}
          </>
        ) : (
          <>
            <b className="text-[#ff4d6d]">Nem uma coisa nem outra.</b> A obra está sendo executada
            sem OS e sem ninguém nomeado que tenha autorizado.
          </>
        )}
      </p>
    </>
  )

  /* ------------------------------------------------------------- formulário */

  const formulario = (
    <GradeForm>
      <CampoForm
        id="b-aut-origem"
        rotulo="Origem"
        dica="por onde chegou o OK para executar"
        erro={erros.origem}
        larga
      >
        <Selecao
          id="b-aut-origem"
          opcoes={ORIGENS}
          valor={rascunho.origem}
          vazio="— não sei ainda —"
          desabilitado={salvando}
          invalido={!!erros.origem}
          onChange={(v) => campo('origem', v)}
        />
      </CampoForm>

      <CampoForm
        id="b-aut-libPor"
        rotulo="Liberado por"
        dica="analista do cliente que deu o OK"
        erro={erros.libPor}
      >
        <Selecao
          id="b-aut-libPor"
          opcoes={analistas}
          valor={rascunho.libPor}
          vazio="— ninguém liberou —"
          desabilitado={salvando}
          invalido={!!erros.libPor}
          onChange={(v) => campo('libPor', v)}
        />
      </CampoForm>

      <CampoForm
        id="b-aut-libEm"
        rotulo="Data da liberação"
        dica="é outra data, não a da aprovação"
        erro={erros.libEm}
      >
        <Entrada
          id="b-aut-libEm"
          tipo="date"
          max={hoje}
          valor={rascunho.libEm}
          desabilitado={salvando}
          invalido={!!erros.libEm}
          onChange={(v) => campo('libEm', v)}
        />
      </CampoForm>

      <CampoForm
        id="b-aut-aprov"
        rotulo="OS aprovada em"
        dica="Vazio: OS ainda não aprovada. Com data: a OS conta como aprovada, a data vale para o caminho da obra e encerra os dias esperando a aprovação da OS."
        erro={erros.aprovadaEm}
        larga
      >
        <Entrada
          id="b-aut-aprov"
          tipo="date"
          max={hoje}
          valor={rascunho.aprovadaEm}
          desabilitado={salvando}
          invalido={!!erros.aprovadaEm}
          onChange={(v) => campo('aprovadaEm', v)}
        />
      </CampoForm>
    </GradeForm>
  )

  return (
    <>
      <BlocoEditavel
        id="aut"
        titulo="Autorização"
        editando={editando}
        salvando={salvando}
        erro={erro}
        oQueNaoSalvou="a autorização"
        hint={HINT_SEM_MOTIVO}
        leitura={leitura}
        formulario={formulario}
        rodape={rodape}
        onEditar={editar}
        onSalvar={aoSalvar}
        onCancelar={cancelar}
      />

      <Dialogo
        aberto={avisoAvanco}
        titulo="Salvar a aprovação e avançar a obra"
        botoes={botoesAvanco}
        onFechar={() => setAvisoAvanco(false)}
      >
        <p className="m-0">
          Esta obra está em <b className="text-[#e8eef7]">{nomeEtapa('aprovarOS')}</b>, esperando
          justamente a aprovação da OS. Ao salvar:
        </p>
        <ul className="mt-1 mb-0 list-disc pl-5">
          <li>
            Grava <b className="text-[#e8eef7]">OS aprovada em {br(rascunho.aprovadaEm)}</b>.
          </li>
          <li>
            O passo <b className="text-[#e8eef7]">{nomeEtapa('aprovarOS')}</b> fica concluído com
            essa data.
          </li>
          <li>
            A obra passa para <b className="text-[#e8eef7]">{nomeEtapa('fecharOS')}</b>, o contador
            &quot;parada nesta etapa&quot; recomeça hoje, e a vez passa do{' '}
            <b className="text-[#e8eef7]">Cliente</b> para o{' '}
            <b className="text-[#e8eef7]">Responsável {responsavel || 'a definir'}</b>.
          </li>
          <li>
            Os <b className="text-[#e8eef7]">dias em aberto</b> não mudam: eles contam da liberação,
            da aprovação ou da entrada — a mais antiga das três. Uma aprovação mais recente não
            derruba a contagem.
          </li>
          <li>Fica no histórico com o seu nome: a informação e a mudança de etapa.</li>
        </ul>
      </Dialogo>
    </>
  )
}
