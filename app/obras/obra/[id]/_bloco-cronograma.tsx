'use client'

/**
 * BLOCO **CRONOGRAMA** da ficha — quando a obra acontece, e por que a data mudou.
 * J4, seção B do `mockup-j4-v03.html` (`croLeitura`/`croForm`/`dinCro`, :866-960).
 * Ver spec-ficha-editavel-2026-09-18.md §5.1, R9, R10, R11, R12 e R13.
 *
 * A REGRA QUE DÁ SENTIDO A ESTE BLOCO: mudar o **início** é uma remarcação e
 * exige motivo; mudar a **duração**, o responsável, a equipe ou a prioridade é
 * livre (R12). A obra é planejada por duração, não por data de entrega — não
 * existe campo "data final", ele é consequência e se recalcula sozinho.
 *
 * QUANDO A JANELA ABRE: quando `precisaRemarcar()` diz que sim, e ela diz sim
 * quando JÁ HAVIA um início e ele passou a ser outro — **inclusive quando o
 * novo valor é vazio**. Apagar uma data combinada é justamente o caso em que
 * alguém precisa saber por quê. Preencher um início que estava em branco NÃO é
 * remarcação: não há nada a remarcar, e pedir motivo ali seria cobrar
 * explicação de quem está só completando o cadastro (R9).
 *
 * A DECISÃO É DE `precisaRemarcar` EM `_lib/ficha-campos.ts`, não deste
 * arquivo: a MESMA função decide aqui e na Server Action. Se a tela decidisse
 * sozinha, as duas divergiriam na primeira correção de regra — e a tela é a que
 * não é fronteira de autorização.
 *
 * REMARCAR NÃO MEXE NA CONTAGEM DE DIAS EM ABERTO (R13): `ancoraDias` olha
 * `aprovacao`, `liberado_em` e a entrada, nunca `inicio_plan`. O texto da
 * janela diz isso a quem remarca, para ninguém achar que adiar a obra "limpa" o
 * alerta dela.
 */

import { useState, useTransition } from 'react'
import { Campo, Campos } from '../../_ui/primitivos'
import { PRIORIDADES, br, somaDias } from '../../_lib/tipos'
import {
  ehMotivoOutro,
  precisaRemarcar,
  validarCronograma,
  type DadosCronograma,
  type Erros,
} from '../../_lib/ficha-campos'
import BlocoEditavel, {
  CampoForm,
  Entrada,
  GradeForm,
  Selecao,
  focarPrimeiroInvalido,
  ERRO_DE_REDE,
} from './_bloco-editavel'
import DialogoRemarcar, {
  type CadastrarMotivo,
  type Remarcacao,
} from './_dialogo-remarcar'

/** O tipo MÍNIMO que este bloco usa de `salvarCronogramaAction` (§4.3). */
export type SalvarCronograma = (
  obraId: string,
  dados: DadosCronograma
) => Promise<{ error?: string; success?: boolean }>

const CAMPOS = [
  ['resp', 'b-cro-resp'],
  ['equipe', 'b-cro-equipe'],
  ['prioridade', 'b-cro-prioridade'],
  ['inicio', 'b-cro-inicio'],
  ['duracao', 'b-cro-duracao'],
] as const

/** `textoMotivo(mockup:820)` — o motivo como ele aparece escrito. */
function textoMotivo(motivo: string, detalhe: string): string {
  return ehMotivoOutro(motivo) && detalhe ? `Outro: ${detalhe}` : motivo
}

function dias(duracao: string): number | null {
  const t = duracao.trim()
  return /^\d+$/.test(t) ? Number(t) : null
}

export default function BlocoCronograma({
  obraId,
  valores,
  responsaveis,
  equipes,
  motivos,
  rodape,
  salvar,
  cadastrarMotivo,
}: {
  obraId: string
  /** O que está gravado hoje. `valores.inicio` é o que define a remarcação. */
  valores: DadosCronograma
  responsaveis: readonly string[]
  equipes: readonly string[]
  /** A lista padronizada, de `obras_motivo_remarcacao`, ordenada pelo servidor. */
  motivos: readonly string[]
  rodape: React.ReactNode
  salvar: SalvarCronograma
  /** Ausente: a janela não oferece "+ Cadastrar novo motivo". */
  cadastrarMotivo?: CadastrarMotivo
}) {
  const [editando, setEditando] = useState(false)
  const [rascunho, setRascunho] = useState<DadosCronograma>(valores)
  const [erros, setErros] = useState<Erros<DadosCronograma>>({})
  const [erro, setErro] = useState<string | null>(null)
  const [janela, setJanela] = useState(false)
  /** O motivo da última tentativa — a caixa de erro o cita, como no mockup. */
  const [tentativa, setTentativa] = useState<Remarcacao | null>(null)
  const [salvando, iniciar] = useTransition()

  const remarcando = editando && precisaRemarcar(valores.inicio, rascunho.inicio)

  function editar() {
    setRascunho({ ...valores, motivo: '', detalhe: '' })
    setErros({})
    setErro(null)
    setTentativa(null)
    setEditando(true)
  }

  function cancelar() {
    setErros({})
    setErro(null)
    setEditando(false)
  }

  function campo<K extends keyof DadosCronograma>(k: K, v: DadosCronograma[K]) {
    setRascunho((r) => ({ ...r, [k]: v }))
  }

  function gravar(dados: DadosCronograma) {
    setErro(null)
    iniciar(async () => {
      try {
        const r = await salvar(obraId, dados)
        if (r?.error) {
          // R21: continua em edição, com tudo o que foi digitado.
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
    // Valida só os campos do formulário. O motivo ainda não existe: ele é
    // coletado na janela, e é lá que a regra dele é conferida.
    const e = validarCronograma({ ...rascunho, motivo: '', detalhe: '' }, {
      inicioAtual: valores.inicio,
    })
    delete e.motivo
    delete e.detalhe
    setErros(e)
    if (Object.keys(e).length) {
      focarPrimeiroInvalido(CAMPOS, e)
      return
    }
    if (precisaRemarcar(valores.inicio, rascunho.inicio)) {
      setJanela(true)
      return
    }
    setTentativa(null)
    gravar({ ...rascunho, motivo: '', detalhe: '' })
  }

  function confirmarRemarcacao(r: Remarcacao) {
    const completo: DadosCronograma = { ...rascunho, motivo: r.motivo, detalhe: r.detalhe }
    // A mesma validação do servidor, agora com o motivo em mãos (R10). A janela
    // já barra o caso comum; isto fecha a porta de vez.
    const e = validarCronograma(completo, { inicioAtual: valores.inicio })
    if (Object.keys(e).length) {
      setErros(e)
      focarPrimeiroInvalido(CAMPOS, e)
      return
    }
    setErros({})
    setRascunho(completo)
    setTentativa(r)
    gravar(completo)
  }

  /* ---------------------------------------------------------------- leitura */

  const fimAtual = somaDias(valores.inicio, dias(valores.duracao))

  const leitura = (
    <>
      <Campos cols={3}>
        <Campo rotulo="Responsável da obra">{valores.resp}</Campo>
        <Campo rotulo="Equipe / prestador">{valores.equipe}</Campo>
        <Campo rotulo="Prioridade">{valores.prioridade}</Campo>
        <Campo rotulo="Início planejado">
          {valores.inicio ? (
            <span className="font-mono">{br(valores.inicio)}</span>
          ) : (
            <span className="text-[#f05a28]">a definir</span>
          )}
        </Campo>
        <Campo rotulo="Duração">
          {valores.duracao ? (
            <span className="font-mono">{valores.duracao} dias</span>
          ) : (
            <span className="text-[#f05a28]">a definir</span>
          )}
        </Campo>
        <Campo rotulo="Final calculado">
          {fimAtual ? <span className="font-mono">{br(fimAtual)}</span> : null}
        </Campo>
      </Campos>
      <p className="mt-3 text-[11px] leading-relaxed text-[#64748b]">
        A obra é planejada por <b className="text-[#94a3b8]">duração</b>, não por data de entrega. O
        final é o início mais os dias combinados e se recalcula sozinho a cada remarcação.
      </p>
    </>
  )

  /* ------------------------------------------------------------- formulário */

  // `dinCro(mockup:866)` — o aviso e o recálculo ao vivo, enquanto se digita.
  const fimAntes = somaDias(valores.inicio, dias(valores.duracao))
  const fimDepois = somaDias(rascunho.inicio, dias(rascunho.duracao))

  const formulario = (
    <GradeForm>
      <CampoForm id="b-cro-resp" rotulo="Responsável da obra" erro={erros.resp}>
        <Selecao
          id="b-cro-resp"
          opcoes={responsaveis}
          valor={rascunho.resp}
          vazio="— escolher —"
          desabilitado={salvando}
          onChange={(v) => campo('resp', v)}
        />
      </CampoForm>

      <CampoForm id="b-cro-equipe" rotulo="Equipe / prestador" erro={erros.equipe}>
        {/* Texto livre com sugestões (ajuste 3 de 23/09). */}
        <Entrada
          id="b-cro-equipe"
          valor={rascunho.equipe}
          desabilitado={salvando}
          list="equipes-cro"
          autoComplete="off"
          placeholder="Digite a equipe ou o prestador"
          onChange={(v) => campo('equipe', v)}
        />
        <datalist id="equipes-cro">
          {equipes.map((e) => (
            <option key={e} value={e} />
          ))}
        </datalist>
      </CampoForm>

      <CampoForm id="b-cro-prioridade" rotulo="Prioridade" erro={erros.prioridade}>
        <Selecao
          id="b-cro-prioridade"
          opcoes={PRIORIDADES}
          valor={rascunho.prioridade}
          vazio="— escolher —"
          desabilitado={salvando}
          invalido={!!erros.prioridade}
          onChange={(v) => campo('prioridade', v)}
        />
      </CampoForm>

      <CampoForm
        id="b-cro-inicio"
        rotulo="Início planejado"
        dica={
          valores.inicio ? 'mudar vira remarcação, com motivo' : 'quando a equipe entra na loja'
        }
        erro={erros.inicio}
      >
        <Entrada
          id="b-cro-inicio"
          tipo="date"
          valor={rascunho.inicio}
          desabilitado={salvando}
          invalido={!!erros.inicio}
          onChange={(v) => campo('inicio', v)}
        />
      </CampoForm>

      <CampoForm
        id="b-cro-duracao"
        rotulo="Duração em dias"
        dica="muda livre, sem motivo"
        erro={erros.duracao}
        larga
      >
        <Entrada
          id="b-cro-duracao"
          tipo="number"
          min={1}
          max={180}
          valor={rascunho.duracao}
          desabilitado={salvando}
          invalido={!!erros.duracao}
          onChange={(v) => campo('duracao', v)}
        />
      </CampoForm>

      <div className="min-w-0 sm:col-span-2" id="b-cro-din">
        {remarcando ? (
          <div className="rounded-md border border-[#f4b73f73] bg-[#f4b73f14] px-3 py-2.5">
            <strong className="block text-[13px] text-[#f4b73f]">
              Mudar o início é uma remarcação
            </strong>
            <p className="mt-0.5 text-[12px] leading-relaxed text-[#94a3b8]">
              De <b className="text-[#e8eef7]">{br(valores.inicio)}</b> para{' '}
              <b className="text-[#e8eef7]">
                {rascunho.inicio ? br(rascunho.inicio) : 'nenhuma data'}
              </b>
              . Ao clicar em Salvar, você escolhe o <b className="text-[#e8eef7]">motivo</b> numa
              lista padronizada (obrigatório). Fica em Remarcações e no histórico.
            </p>
          </div>
        ) : null}
        {fimAntes && fimDepois && fimAntes !== fimDepois ? (
          <p className="mt-2 text-[11px] text-[#94a3b8]">
            Final calculado: <b className="text-[#e8eef7]">{br(fimAntes)}</b> →{' '}
            <b className="text-[#e8eef7]">{br(fimDepois)}</b>
            {rascunho.duracao !== valores.duracao ? ' A duração muda sem motivo.' : ''}
          </p>
        ) : null}
      </div>
    </GradeForm>
  )

  return (
    <>
      <BlocoEditavel
        id="cro"
        titulo="Cronograma"
        editando={editando}
        salvando={salvando}
        erro={erro}
        oQueNaoSalvou="o cronograma"
        complementoErro={
          tentativa?.motivo ? (
            <>
              : nem o início novo, nem a remarcação (motivo escolhido:{' '}
              {textoMotivo(tentativa.motivo, tentativa.detalhe)})
            </>
          ) : undefined
        }
        hint={
          remarcando
            ? 'Ao salvar, o motivo da remarcação é pedido.'
            : 'Duração, equipe e prioridade mudam sem motivo. Fica no histórico quem salvou.'
        }
        leitura={leitura}
        formulario={formulario}
        rodape={rodape}
        onEditar={editar}
        onSalvar={aoSalvar}
        onCancelar={cancelar}
      />

      <DialogoRemarcar
        aberto={janela}
        de={valores.inicio}
        para={rascunho.inicio}
        duracao={rascunho.duracao}
        motivos={motivos}
        cadastrarMotivo={cadastrarMotivo}
        onConfirmar={confirmarRemarcacao}
        onFechar={() => setJanela(false)}
      />
    </>
  )
}
