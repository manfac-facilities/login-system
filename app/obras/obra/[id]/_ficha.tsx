/**
 * FICHA DA OBRA — a tela que responde "onde ela está, de quem é a vez e há
 * quanto tempo".
 *
 * A ordem dos blocos é a do mockup aprovado (modelo-mockup.md §2.4) e não se
 * reabre: cabeçalho → caixa de alerta (UMA só) → caixa de cobertura → Ciclo de
 * vida → Autorização → Identificação → Cronograma → Remarcações → Evolução em
 * fotos → Linha do tempo do diário → Tarefas que as faltas geraram →
 * Pendências e próxima ação → Vindo do Field.
 *
 * Server Component. O único pedaço interativo é o `<SeletorEtapa>`, que é
 * client e vive dentro do bloco de ciclo de vida.
 *
 * O QUE ESTA TELA NÃO FAZ: escrever no diário. Quem escreve é a frente C
 * (`/obras/diario`); aqui a linha do tempo é só leitura.
 */

import Link from 'next/link'
import {
  ESTEIRA,
  ETAPAS,
  br,
  diasSemOS,
  encalhada,
  encerrada,
  liberada,
  moeda,
  nomeEtapa,
  paradaTxt,
  pedeFoto,
  posCampo,
  prazoTxt,
  semCobertura,
  sitTarefa,
  travado,
  SEM_BLOQUEIO,
  NAO_FALTOU,
  critico,
  type DiarioRow,
  type Etapa,
  type Obra,
  type PessoaRow,
  type RemarcacaoRow,
  type TarefaRow,
} from '../../_lib/tipos'
import { Box, BoxB, BoxH, Campo, Campos, EstadoVazio, Placeholder } from '../../_ui/primitivos'
import {
  BadgeDias,
  EtiquetaCobertura,
  EtiquetaEtapa,
  EtiquetaMauUso,
  EtiquetaOS,
  EtiquetaPrioridade,
} from '../../base/_etiquetas'
import SeletorEtapa from './_etapa'

/** `MARCO_DE(mockup:3302)`, traduzido para as colunas reais de `obras_obra`. */
const MARCO_DE: Record<string, keyof Obra> = {
  relatorio: 'marco_relatorio',
  aprovarOS: 'marco_os_aprov',
  fecharOS: 'marco_fechou_os',
  pendFat: 'marco_liberou_fat',
  faturado: 'marco_faturou',
}

export type FotoDoDia = { data: string; url: string | null }

/* -------------------------------------------------------------------------- */
/* Esteira                                                                    */
/* -------------------------------------------------------------------------- */

function Passo({
  estado,
  nome,
  dono,
  onde,
  cod,
  quando,
  desvio = false,
  children,
}: {
  estado: 'feito' | 'atual' | 'futuro' | 'pulado'
  nome: string
  dono: string
  onde: string
  cod?: string
  quando: string
  desvio?: boolean
  children?: React.ReactNode
}) {
  const cor =
    estado === 'atual'
      ? '#f05a28'
      : estado === 'feito'
        ? '#35c98a'
        : estado === 'pulado'
          ? '#334e78'
          : '#64748b'
  return (
    <li className="flex gap-3 py-2.5">
      <span
        className="mt-1.5 h-2.5 w-2.5 flex-none rounded-full"
        style={{ backgroundColor: cor, opacity: estado === 'futuro' ? 0.4 : 1 }}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="text-sm font-semibold"
            style={{ color: estado === 'futuro' || estado === 'pulado' ? '#64748b' : '#e8eef7' }}
          >
            {nome}
          </span>
          {desvio ? (
            <span className="rounded border border-[#1e3a5f] px-1.5 py-px text-[10px] text-[#94a3b8]">
              desvio
            </span>
          ) : null}
          {estado === 'atual' ? (
            <span className="rounded-full bg-[#f05a28] px-2 py-px text-[10px] font-semibold text-white">
              a obra está aqui
            </span>
          ) : null}
        </div>
        <div className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-[#94a3b8]">
          <span>{dono}</span>
          <span>{onde}</span>
          {cod ? <span className="font-mono text-[#64748b]">{cod}</span> : null}
        </div>
        {children ? <div className="mt-1.5 text-[11px] leading-relaxed">{children}</div> : null}
      </div>
      <span className="flex-none text-[11px] whitespace-nowrap" style={{ color: cor }}>
        {quando}
      </span>
    </li>
  )
}

function Esteira({ obra }: { obra: Obra }) {
  const campoFeito = !!obra.marco_exec_fim
  return (
    <ol className="divide-y divide-[#1e3a5f]">
      {/* Passo zero: a execução em campo, que é onde o diário do dia atua. */}
      <Passo
        estado={campoFeito ? 'feito' : 'atual'}
        nome="Execução em campo"
        dono={obra.equipe ? `Equipe ${obra.equipe}` : 'Equipe a definir'}
        onde="Campo · diário do dia"
        cod="EXECUTAR"
        quando={campoFeito ? br(obra.marco_exec_fim) : 'em curso'}
      >
        {campoFeito ? null : (
          <span className="text-[#94a3b8]">
            {prazoTxt(obra)} · {paradaTxt(obra)}
          </span>
        )}
      </Passo>

      {ESTEIRA.map((k) => {
        const c = ETAPAS[k]

        /* O DESVIO. Quando a obra já tinha OS aprovada ele não acontece — mas
           continua desenhado, apagado, para o caminho inteiro ficar visível. */
        if (k === 'aprovarOS' && obra.os_aprovada) {
          return (
            <Passo
              key={k}
              estado="pulado"
              desvio
              nome="Pendente fechamento"
              dono={`Desvio não usado — a OS já estava aprovada em ${br(obra.marco_os_aprov ?? obra.aprovacao)}, então, com o relatório existindo, a obra vai direto para Fechar OS.`}
              onde=""
              quando="não se aplica"
            />
          )
        }

        const data = obra[MARCO_DE[k]] as string | null
        const estado: 'feito' | 'atual' | 'futuro' = data
          ? 'feito'
          : obra.etapa === k
            ? 'atual'
            : 'futuro'
        const quando = data
          ? br(data)
          : estado === 'atual'
            ? `há ${obra.paradaEtapa ?? 0} ${obra.paradaEtapa === 1 ? 'dia' : 'dias'}`
            : '—'

        return (
          <Passo
            key={k}
            estado={estado}
            desvio={k === 'aprovarOS'}
            nome={c.nome}
            dono={
              c.dono === 'Responsável da obra'
                ? obra.pcm
                  ? `Responsável ${obra.pcm}`
                  : 'Responsável a definir'
                : c.dono
            }
            onde={c.onde}
            cod={c.planilha || undefined}
            quando={quando}
          >
            {estado === 'atual' && encalhada(obra) ? (
              <p className="text-[#f4b73f]">
                Parada aqui há <b>{obra.paradaEtapa} dias</b>. Enquanto não sair desta etapa, a obra
                não vira dinheiro.
              </p>
            ) : null}

            {/* O relatório não é marcado por ninguém — ele é DEDUZIDO. */}
            {k === 'relatorio' ? (
              <p className="text-[#94a3b8]">
                Ninguém marca esta etapa à mão. O sistema lê o fechamento da OS no Field Control:{' '}
                <b className="text-[#e8eef7]">OS fechada no Field, o relatório existe</b>. Enquanto o
                Field não devolver o fechamento, a obra fica parada aqui.
              </p>
            ) : null}

            {/* A cobrança precisa ter NOME. */}
            {k === 'aprovarOS' ? (
              liberada(obra) ? (
                <p className="text-[#94a3b8]">
                  Relatório pronto, OS não aprovada: quem destrava é o cliente, não nós. A execução
                  foi liberada por <b className="text-[#e8eef7]">{obra.liberado_por}</b> em{' '}
                  {br(obra.liberado_em)} — é com ele que a cobrança da OS começa.
                </p>
              ) : (
                <p className="text-[#ff4d6d]">
                  Ninguém liberou esta obra: não há OS aprovada e não há nome de quem autorizou a
                  execução. A cobrança fica <b>sem a quem recorrer</b>.
                </p>
              )
            ) : null}
          </Passo>
        )
      })}
    </ol>
  )
}

/* -------------------------------------------------------------------------- */
/* Caixa de alerta — UMA só, nunca empilhada                                  */
/* -------------------------------------------------------------------------- */

function CaixaAlerta({ obra }: { obra: Obra }) {
  const grave = critico(obra)

  if (posCampo(obra) && !encerrada(obra) && (critico(obra) || encalhada(obra))) {
    const cor = grave ? '#ff4d6d' : '#f4b73f'
    return (
      <div
        className="flex flex-wrap items-center gap-4 rounded-lg border px-4 py-3"
        style={{ borderColor: `${cor}66`, backgroundColor: `${cor}1a`, borderLeftWidth: 4, borderLeftColor: cor }}
      >
        <div className="text-center">
          <div className="text-2xl font-bold" style={{ color: cor }}>
            {obra.paradaEtapa}
          </div>
          <div className="text-[10px] text-[#94a3b8]">dias parada aqui</div>
        </div>
        <div className="min-w-[240px] flex-1">
          <h3 className="text-sm font-semibold" style={{ color: cor }}>
            Obra entregue em {br(obra.marco_exec_fim)} e ainda não faturada.
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-[#94a3b8]">
            Ela saiu de campo e está na etapa <b className="text-[#e8eef7]">{nomeEtapa(obra.etapa)}</b>{' '}
            desde <b className="text-[#e8eef7]">{br(obra.desde_etapa)}</b>, com{' '}
            <b className="text-[#e8eef7]">{obra.dono}</b>.
            {obra.valor !== null ? (
              <>
                {' '}
                São <b className="text-[#e8eef7]">{moeda(obra.valor)}</b> de serviço entregue que
                ainda não viraram nota.
              </>
            ) : null}
          </p>
        </div>
      </div>
    )
  }

  if (grave && obra.duracao) {
    return (
      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-[#ff4d6d]/40 border-l-4 border-l-[#ff4d6d] bg-[#ff4d6d]/10 px-4 py-3">
        <div className="text-center">
          <div className="text-2xl font-bold text-[#ff4d6d]">{obra.dias}</div>
          <div className="text-[10px] text-[#94a3b8]">dias em aberto</div>
        </div>
        <div className="min-w-[240px] flex-1">
          <h3 className="text-sm font-semibold text-[#ff4d6d]">
            Obra aprovada em {br(obra.aprovacao)} e ainda não concluída.
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-[#94a3b8]">
            A duração planejada é de <b className="text-[#e8eef7]">{obra.duracao} dias</b>. Estão
            contados <b className="text-[#e8eef7]">{obra.dias} dias</b> desde a aprovação —{' '}
            <b className="text-[#e8eef7]">
              {Math.round((obra.dias ?? 0) / obra.duracao)} vezes
            </b>{' '}
            o prazo combinado. O cliente enxerga essa mesma OS aberta no sistema dele.
          </p>
        </div>
      </div>
    )
  }

  if (!posCampo(obra) && obra.atraso !== null && obra.atraso > 0) {
    return (
      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-[#f4b73f]/40 border-l-4 border-l-[#f4b73f] bg-[#f4b73f]/10 px-4 py-3">
        <div className="text-center">
          <div className="text-2xl font-bold text-[#f4b73f]">{obra.atraso}</div>
          <div className="text-[10px] text-[#94a3b8]">dias além do prazo</div>
        </div>
        <div className="min-w-[240px] flex-1">
          <h3 className="text-sm font-semibold text-[#f4b73f]">Passou da duração planejada.</h3>
          <p className="mt-1 text-xs leading-relaxed text-[#94a3b8]">
            Início em <b className="text-[#e8eef7]">{br(obra.inicio_real || obra.inicio_plan)}</b> com{' '}
            <b className="text-[#e8eef7]">{obra.duracao} dias</b> de duração: deveria ter terminado em{' '}
            <b className="text-[#e8eef7]">{br(obra.fimCalc)}</b>.
          </p>
        </div>
      </div>
    )
  }

  return null
}

/** Houve caixa de alerta? Decide se a caixa "Sem OS aprovada" se repete. */
function temAlerta(obra: Obra): boolean {
  if (posCampo(obra) && !encerrada(obra) && (critico(obra) || encalhada(obra))) return true
  if (critico(obra) && obra.duracao) return true
  if (!posCampo(obra) && obra.atraso !== null && obra.atraso > 0) return true
  return false
}

/* -------------------------------------------------------------------------- */
/* Ficha                                                                      */
/* -------------------------------------------------------------------------- */

export default function Ficha({
  obra,
  diario,
  remarcacoes,
  tarefas,
  pessoas,
  fotos,
}: {
  obra: Obra
  diario: DiarioRow[]
  remarcacoes: RemarcacaoRow[]
  tarefas: TarefaRow[]
  pessoas: Record<string, PessoaRow>
  fotos: Record<string, string>
}) {
  const ultimos = diario.slice(-8)
  const comFoto = ultimos.filter((d) => !!d.foto_path).length
  const dSemOS = diasSemOS(obra)

  return (
    <div className="flex flex-col gap-4">
      {/* ---------- cabeçalho ---------- */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#e8eef7]">{obra.loja ?? '—'}</h1>
          <p className="mt-0.5 font-mono text-xs text-[#94a3b8]">
            OS {obra.os ?? '—'} · {obra.tipo ?? '—'} · {moeda(obra.valor)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <EtiquetaEtapa obra={obra} />
          <EtiquetaMauUso obra={obra} />
          <EtiquetaPrioridade obra={obra} />
          <EtiquetaOS obra={obra} />
          <EtiquetaCobertura obra={obra} />
          <BadgeDias obra={obra} />
        </div>
      </header>

      {/* ---------- caixa de alerta condicional (uma só) ---------- */}
      <CaixaAlerta obra={obra} />

      {/* ---------- cobertura: o destaque mais forte da tela ---------- */}
      {semCobertura(obra) ? (
        <div className="rounded-lg border-2 border-[#ff4d6d] bg-[#ff4d6d]/20 px-4 py-3">
          <span className="inline-block rounded-full bg-[#ff4d6d] px-2 py-0.5 text-[11px] font-bold text-white">
            Sem cobertura
          </span>
          <p className="mt-2 text-xs leading-relaxed text-[#e8eef7]">
            Esta obra {posCampo(obra) ? 'foi executada' : 'está sendo executada'}{' '}
            <b>sem OS aprovada na DPSP e sem ninguém que tenha liberado a execução</b>. Não existe
            documento e não existe nome: se a DPSP não aprovar a OS, não há a quem recorrer, porque
            não há registro de quem disse &ldquo;pode fazer&rdquo;.
            {obra.valor !== null ? (
              <>
                {' '}
                São <b>{moeda(obra.valor)}</b> de serviço sem cobertura nenhuma.
              </>
            ) : null}{' '}
            É o estado de maior risco da base, e é ele que o campo <b>Liberado por</b> existe para
            evitar.
          </p>
        </div>
      ) : !obra.os_aprovada && !temAlerta(obra) ? (
        <div className="rounded-lg border border-[#ff4d6d]/45 border-l-4 border-l-[#ff4d6d] bg-[#ff4d6d]/10 px-4 py-3">
          <span className="inline-block rounded-full border border-[#ff4d6d] px-2 py-0.5 text-[11px] font-semibold text-[#ff4d6d]">
            Sem OS aprovada
          </span>
          <p className="mt-2 text-xs leading-relaxed text-[#94a3b8]">
            Esta obra {posCampo(obra) ? 'foi executada' : 'está sendo executada'}{' '}
            <b className="text-[#e8eef7]">sem OS aprovada no sistema da DPSP</b>.{' '}
            {posCampo(obra)
              ? 'Ela não pode ser encerrada nem faturada enquanto a DPSP não aprovar a OS. O serviço já foi entregue e ainda não tem cobertura no sistema do cliente.'
              : 'Se ela terminar em campo antes de a OS ser aprovada, não vai direto para o fechamento: entra na etapa de cobrar a aprovação, e o faturamento fica parado ali.'}
          </p>
        </div>
      ) : null}

      {/* ---------- ciclo de vida ---------- */}
      <Box>
        <BoxH extra="onde ela está, de quem é a vez e há quanto tempo">Ciclo de vida da obra</BoxH>
        <BoxB>
          <Campos cols={4}>
            <Campo rotulo="Etapa atual">
              <EtiquetaEtapa obra={obra} />
            </Campo>
            <Campo rotulo="Dono da etapa">{obra.dono}</Campo>
            <Campo rotulo={posCampo(obra) ? 'Parada nesta etapa' : 'Prazo'}>
              <span className={encalhada(obra) ? 'text-[#f4b73f]' : undefined}>
                {posCampo(obra)
                  ? encerrada(obra)
                    ? 'encerrada'
                    : obra.paradaEtapa === null
                      ? '—'
                      : `${obra.paradaEtapa} ${obra.paradaEtapa === 1 ? 'dia' : 'dias'}`
                  : prazoTxt(obra)}
              </span>
            </Campo>
            <Campo rotulo="Caminho">
              {obra.os_aprovada
                ? 'direto — a OS já estava aprovada'
                : 'com desvio — vai parar em Pendente fechamento'}
            </Campo>
          </Campos>

          <div className="mt-3 border-t border-[#1e3a5f] pt-1">
            <Esteira obra={obra} />
          </div>

          <p className="mt-3 text-[11px] leading-relaxed text-[#64748b]">
            Os nomes das etapas são os que a Manfac já usa na coluna{' '}
            <b className="text-[#94a3b8]">STATUS MANFAC</b> da planilha. Hoje a planilha guarda o
            status, mas nunca <b className="text-[#94a3b8]">desde quando</b> — é esse número, o
            &ldquo;parada há N dias&rdquo;, que não existe em lugar nenhum e faz a obra sumir por
            semanas depois de entregue.
            <br />
            <br />
            <b className="text-[#94a3b8]">Fechar OS</b> é o que depende de nós — alguém pega o
            relatório e encerra. <b className="text-[#94a3b8]">Pendente fechamento</b> é o que
            depende do cliente — só a aprovação da OS destrava, e o que resolve é insistir com o
            analista que liberou.
            <br />
            <br />
            <b className="text-[#94a3b8]">Mau uso</b> não é etapa, é classificação: a obra de mau uso
            percorre esta mesma esteira e só carrega uma etiqueta.
          </p>
        </BoxB>

        {/* Decisão técnica 6 da spec: sem isto o quadro trava no primeiro dia. */}
        <SeletorEtapa obraId={obra.id} etapa={obra.etapa as Etapa} />
      </Box>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* -------------------- coluna esquerda -------------------- */}
        <div className="flex flex-col gap-4">
          {/* ---------- autorização ---------- */}
          <Box>
            <BoxH extra="o que destrava a execução e o que destrava o fechamento">Autorização</BoxH>
            <BoxB>
              <Campos cols={2}>
                <Campo rotulo="Liberação">
                  {liberada(obra) ? (
                    <>
                      Liberado por <b>{obra.liberado_por}</b> · {br(obra.liberado_em)}
                    </>
                  ) : (
                    <span className="font-semibold text-[#ff4d6d]">Ninguém liberou esta obra</span>
                  )}
                </Campo>
                <Campo rotulo="OS do cliente">
                  {obra.os_aprovada ? (
                    <>OS aprovada · {br(obra.marco_os_aprov ?? obra.aprovacao)}</>
                  ) : (
                    <>
                      <span className="font-semibold text-[#ff4d6d]">OS ainda não aprovada</span>
                      {dSemOS !== null ? (
                        <span className="text-[#94a3b8]"> · há {dSemOS} dias</span>
                      ) : null}
                    </>
                  )}
                </Campo>
              </Campos>
              <p className="mt-3 text-[11px] leading-relaxed text-[#94a3b8]">
                {obra.os_aprovada && liberada(obra) ? (
                  <>
                    A obra tem as duas coberturas: alguém autorizou a execução{' '}
                    <b className="text-[#e8eef7]">e</b> existe OS aprovada no sistema do cliente. É o
                    caso normal.
                  </>
                ) : obra.os_aprovada ? (
                  <>
                    A obra não precisou de liberação: a{' '}
                    <b className="text-[#e8eef7]">OS já estava aprovada</b> quando a equipe foi a
                    campo, e a OS é a própria autorização.
                  </>
                ) : liberada(obra) ? (
                  <>
                    A execução aconteceu com o{' '}
                    <b className="text-[#e8eef7]">OK de {obra.liberado_por}</b>, que se comprometeu a
                    aprovar a OS depois. Faz <b className="text-[#e8eef7]">{dSemOS} dias</b> que essa
                    OS não sai — e é o {obra.liberado_por} quem a Manfac vai procurar.
                  </>
                ) : (
                  <>
                    <b className="text-[#ff4d6d]">Nem uma coisa nem outra.</b> A obra{' '}
                    {posCampo(obra) ? 'foi executada' : 'está sendo executada'} sem OS e sem ninguém
                    nomeado que tenha autorizado. É o que a Manfac não consegue ver hoje.
                  </>
                )}
              </p>
            </BoxB>
          </Box>

          {/* ---------- identificação ---------- */}
          <Box>
            <BoxH>Identificação</BoxH>
            <BoxB>
              <Campos cols={2}>
                <Campo rotulo="Nº OS">{obra.os}</Campo>
                <Campo rotulo="Loja">{obra.loja}</Campo>
                <Campo rotulo="Chamado">{obra.descricao}</Campo>
                <Campo rotulo="Tipo">{obra.tipo}</Campo>
                {obra.mau_uso ? (
                  <Campo rotulo="Classificação">
                    <EtiquetaMauUso obra={obra} />
                    <div className="mt-1 text-[11px] leading-relaxed text-[#64748b]">
                      Dano por uso indevido do cliente — a Manfac conserta e cobra. É etiqueta, não
                      etapa: a obra segue a mesma esteira de todas as outras.
                    </div>
                  </Campo>
                ) : null}
                <Campo rotulo="Prioridade">
                  <EtiquetaPrioridade obra={obra} />
                </Campo>
                <Campo rotulo="Valor">{moeda(obra.valor)}</Campo>
                <Campo rotulo="Analista">{obra.analista_cliente}</Campo>
                <Campo rotulo="Responsável da obra">
                  {obra.pcm ?? <span className="text-[#f05a28]">a definir</span>}
                </Campo>
                <Campo rotulo="Equipe / prestador">{obra.equipe}</Campo>
                <Campo rotulo="Origem">{obra.origem}</Campo>
                <Campo rotulo="Bloqueio atual">
                  {!obra.bloqueio || obra.bloqueio === SEM_BLOQUEIO ? (
                    <span className="text-[#64748b]">sem bloqueio</span>
                  ) : (
                    <>
                      <span className="font-semibold text-[#ff4d6d]">{obra.bloqueio}</span>
                      {travado(obra) ? (
                        <span className="text-[#94a3b8]"> há {obra.bloqueada_dias} dias</span>
                      ) : null}
                    </>
                  )}
                </Campo>
              </Campos>
            </BoxB>
          </Box>

          {/* ---------- cronograma ---------- */}
          <Box>
            <BoxH>Cronograma</BoxH>
            <BoxB>
              <Campos cols={4}>
                <Campo rotulo="Início planejado">{br(obra.inicio_plan)}</Campo>
                <Campo rotulo="Início real">{br(obra.inicio_real)}</Campo>
                <Campo rotulo="Duração">
                  {obra.duracao !== null ? `${obra.duracao} dias` : 'a definir'}
                </Campo>
                <Campo rotulo="Final calculado">{br(obra.fimCalc)}</Campo>
              </Campos>
              <p className="mt-3 text-[11px] leading-relaxed text-[#64748b]">
                A obra é planejada por <b className="text-[#94a3b8]">duração</b>, não por data de
                entrega. O final é consequência do início mais os dias combinados e se recalcula
                sozinho a cada remarcação — ninguém precisa reescrever data final.
              </p>
            </BoxB>
          </Box>

          {/* ---------- remarcações ---------- */}
          <Box>
            <BoxH extra={String(remarcacoes.length)}>Remarcações</BoxH>
            <BoxB>
              {remarcacoes.length === 0 ? (
                <EstadoVazio>Nenhuma remarcação registrada.</EstadoVazio>
              ) : (
                <ul className="flex flex-col gap-2">
                  {remarcacoes.map((r) => (
                    <li key={r.id} className="flex gap-3 text-xs">
                      <span className="flex-none font-mono text-[#64748b]">{br(r.data)}</span>
                      <div className="min-w-0">
                        <div className="text-[#e8eef7]">
                          início de <b>{br(r.de)}</b> para <b>{br(r.para)}</b>
                        </div>
                        {r.motivo ? <div className="text-[#94a3b8]">{r.motivo}</div> : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </BoxB>
          </Box>
        </div>

        {/* -------------------- coluna direita -------------------- */}
        <div className="flex flex-col gap-4">
          {/* ---------- evolução em fotos ---------- */}
          {pedeFoto(obra) && diario.length > 0 ? (
            <Box>
              <BoxH extra="os últimos dias, na ordem em que aconteceram">Evolução em fotos</BoxH>
              <BoxB>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {ultimos.map((d) => (
                    <div key={d.id} className="w-[92px] flex-none">
                      {d.foto_path && fotos[d.foto_path] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={fotos[d.foto_path]}
                          alt={`Foto da obra em ${br(d.data)}`}
                          className="h-16 w-full rounded border border-[#1e3a5f] object-cover"
                        />
                      ) : (
                        <Placeholder>sem foto</Placeholder>
                      )}
                      <div className="mt-1 text-center font-mono text-[10px] text-[#94a3b8]">
                        {br(d.data).slice(0, 5)}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-[11px] leading-relaxed text-[#64748b]">
                  <b className="text-[#94a3b8]">
                    {comFoto} de {ultimos.length} dias com foto.
                  </b>{' '}
                  Uma foto por dia, em sequência: é assim que dá para ver a obra andando sem ir até a
                  loja. O dia em que a foto não veio aparece marcado — a falta de foto é falta como
                  qualquer outra e vira tarefa com dono e prazo, na mesma mecânica das outras faltas.
                </p>
              </BoxB>
            </Box>
          ) : null}

          {/* ---------- linha do tempo do diário ---------- */}
          <Box>
            <BoxH extra="só leitura — quem responde é o diário do dia">
              Linha do tempo do diário
            </BoxH>
            <BoxB>
              {diario.length === 0 ? (
                <EstadoVazio>Nenhum dia respondido ainda nesta obra.</EstadoVazio>
              ) : (
                <ul className="flex flex-col">
                  {diario
                    .slice()
                    .reverse()
                    .map((d) => {
                      const cor = d.andou ? '#35c98a' : '#ff4d6d'
                      const sub: string[] = []
                      if (!d.andou && d.motivo) sub.push(d.motivo)
                      if (d.item && d.item !== NAO_FALTOU) sub.push(`faltou ${d.item.toLowerCase()}`)
                      return (
                        <li key={d.id} className="flex gap-3 border-b border-[#1e3a5f] py-2.5 last:border-0">
                          <span className="w-10 flex-none font-mono text-[11px] text-[#64748b]">
                            {br(d.data).slice(0, 5)}
                          </span>
                          <span
                            className="mt-1.5 h-2 w-2 flex-none rounded-full"
                            style={{ backgroundColor: cor }}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold" style={{ color: cor }}>
                              {d.andou ? 'Andou' : 'Não andou'}
                            </div>
                            {sub.length ? (
                              <div className="text-[11px] text-[#94a3b8]">{sub.join(' · ')}</div>
                            ) : null}
                            {d.obs ? (
                              <div className="mt-1 text-xs text-[#e8eef7]">{d.obs}</div>
                            ) : null}
                            {pedeFoto(obra) ? (
                              <div className="mt-1.5 text-[11px]">
                                {d.foto_path ? (
                                  <span className="text-[#35c98a]">
                                    Foto da evolução recebida em {br(d.data).slice(0, 5)}
                                  </span>
                                ) : (
                                  <span className="text-[#f4b73f]">A foto deste dia não veio</span>
                                )}
                              </div>
                            ) : null}
                          </div>
                        </li>
                      )
                    })}
                </ul>
              )}
            </BoxB>
          </Box>

          {/* ---------- tarefas que as faltas geraram ---------- */}
          {tarefas.length > 0 ? (
            <Box>
              <BoxH extra={String(tarefas.length)}>Tarefas que as faltas geraram</BoxH>
              <BoxB>
                <ul className="flex flex-col gap-2">
                  {tarefas
                    .slice()
                    .sort((a, b) => (a.aberta < b.aberta ? 1 : -1))
                    .map((t) => {
                      const s = sitTarefa(t)
                      const cor =
                        s === 'respondida' ? '#35c98a' : s === 'vencida' ? '#ff4d6d' : '#f4b73f'
                      const p = t.dono ? pessoas[t.dono] : undefined
                      return (
                        <li
                          key={t.id}
                          className="rounded-md border border-[#1e3a5f] bg-[#0a1628] px-3 py-2"
                          style={{ borderLeftWidth: 3, borderLeftColor: cor }}
                        >
                          <div className="text-[11px] text-[#94a3b8]">
                            Faltou {t.item.toLowerCase()} · {br(t.aberta).slice(0, 5)}
                          </div>
                          <div className="mt-0.5 text-xs text-[#e8eef7]">
                            {p ? `${p.area ?? '—'} · ${p.nome}` : (t.dono ?? 'sem dono')} · prazo fim
                            do dia {br(t.prazo).slice(0, 5)}
                          </div>
                          <span
                            className="mt-1 inline-block text-[11px] font-semibold"
                            style={{ color: cor }}
                          >
                            {s}
                          </span>
                        </li>
                      )
                    })}
                </ul>
                <Link
                  href="/obras/tarefas"
                  className="mt-3 inline-block text-xs text-[#f05a28] hover:underline"
                >
                  Ver a conversa do agente →
                </Link>
              </BoxB>
            </Box>
          ) : null}

          {/* ---------- pendências ---------- */}
          <Box>
            <BoxH>Pendências e próxima ação</BoxH>
            <BoxB>
              <Campos cols={2}>
                <Campo rotulo="Pendência">{obra.pendencia}</Campo>
                <Campo rotulo="Responsável">{obra.pend_resp}</Campo>
                <Campo rotulo="Prazo">{br(obra.pend_prazo)}</Campo>
                <Campo rotulo="Próxima ação">{obra.prox_acao}</Campo>
                <Campo rotulo="Última atualização">{br(obra.atualizacao)}</Campo>
              </Campos>
            </BoxB>
          </Box>

          {/* ---------- vindo do Field ---------- */}
          <Box>
            <BoxH>Vindo do Field</BoxH>
            <BoxB className="flex flex-col gap-2">
              <Placeholder alto>
                <span>
                  <b>Relatório fotográfico</b> — as fotos que o técnico tira em campo entram aqui
                  quando a OS é preenchida no Field.
                </span>
              </Placeholder>
              <Placeholder alto>
                <span>
                  <b>Relatório de entrega (PDF)</b> — o arquivo final que o responsável anexa no
                  sistema do cliente para encerrar a OS. É o documento que destrava toda a esteira
                  acima.
                </span>
              </Placeholder>
            </BoxB>
          </Box>
        </div>
      </div>
    </div>
  )
}
