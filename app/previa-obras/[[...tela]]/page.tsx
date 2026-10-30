/**
 * Prévia visual da Leva 1 — SÓ EM DESENVOLVIMENTO (404 em produção), sem banco
 * nem login. Renderiza as telas reais com a fixture de Macaé 3:
 *   /previa-obras              → Painel
 *   /previa-obras/cronograma   → árvore + Gantt (rascunho v2, células editáveis)
 *   /previa-obras/cronograma?status=1 → gaveta "Atualizar status" aberta
 *   /previa-obras/diario       → passos do diário
 * Fora de /obras porque o middleware exige sessão lá. O segmento de rota (e não
 * ?tela=) faz o menu do ShellObra marcar a seção certa.
 * As actions continuam as reais; sem sessão, elas recusam (nada é gravado).
 */
import { notFound } from 'next/navigation'
import ShellObra from '../../obras/obras/_ui/shell'
import PainelObra from '../../obras/obras/_ui/painel'
import TelaCronograma from '../../obras/obras/[id]/cronograma/_tela'
import { montarDadosCronograma } from '../../obras/obras/[id]/cronograma/_dados'
import PassosDiario from '../../obras/obras/[id]/diario/_passos'
import { montarDiario } from '../../obras/obras/[id]/diario/_preenchimento'
import ListaImpedimentos from '../../obras/obras/[id]/impedimentos/_lista'
import FormImpedimento from '../../obras/obras/[id]/impedimentos/_form'
import GavetaPrevia from '../_gaveta'
import { HOJE, OBRA_ID, VERSOES, calcDoRascunho, dadosDaPrevia } from '../_fixture'

export const dynamic = 'force-dynamic'

export default async function PreviaObrasPage({
  params,
  searchParams,
}: {
  params: Promise<{ tela?: string[] }>
  searchParams: Promise<{ status?: string }>
}) {
  if (process.env.NODE_ENV === 'production') notFound()
  const { tela } = await params
  const { status } = await searchParams
  const qual = tela?.[0] ?? 'painel'
  if (!['painel', 'cronograma', 'diario'].includes(qual) || (tela?.length ?? 0) > 1) notFound()

  const d = dadosDaPrevia()
  const { obra } = d
  const doShell = { id: OBRA_ID, os: obra.os, loja: obra.loja, cliente: obra.cliente, descricao: obra.descricao }

  let conteudo: React.ReactNode
  if (qual === 'cronograma') {
    const dados = montarDadosCronograma({
      obraDados: d,
      exibida: calcDoRascunho(d),
      alvo: VERSOES[1],
      versoes: VERSOES,
      podeEditar: true,
      hoje: HOJE,
    })
    conteudo = (
      <>
        <TelaCronograma dados={dados} />
        {status ? (
          <GavetaPrevia
            hoje={HOJE}
            atividades={dados.statusAtividades}
            cores={Object.fromEntries(dados.etapas.map((e) => [e.chave, e.cor]))}
            atividadeTrava={dados.atividadeTrava}
          />
        ) : null}
      </>
    )
  } else if (qual === 'diario') {
    const { inicial, atividades } = montarDiario({
      calc: d.calc!, plano: d.plano, exec: d.exec, atividadeTrava: obra.atividade_trava, feriados: d.feriados,
      data: HOJE, rdo: null, avancosSalvos: [], ultimo: { efetivo: 6, equipeTexto: 'Equipe do Carlos + 2 ajudantes' },
    })
    conteudo = (
      <PassosDiario
        obraId={OBRA_ID}
        data={HOJE}
        rdoId={null}
        estado={null}
        inicial={inicial}
        atividades={atividades}
        fotos={[]}
        impedimentos={
          <div className="flex flex-col gap-4">
            <ListaImpedimentos itens={d.impedimentos} hoje={HOJE} feriados={d.feriados} somenteAbertos />
            <FormImpedimento
              obraId={OBRA_ID}
              dataDiario={HOJE}
              atividades={d.plano.map((p) => ({ numero: p.numero, descricao: p.descricao }))}
              orientacoes={d.impedimentos
                .filter((i) => i.categoria === 'orientacao')
                .map((o) => ({ id: o.id, descricao: o.descricao, abertoEm: o.abertoEm }))}
            />
          </div>
        }
      />
    )
  } else {
    conteudo = <PainelObra dados={d} hoje={HOJE} estadoDiario="rascunho" ultimoEnvio="2026-10-28" />
  }

  return (
    <ShellObra raiz="/previa-obras" obra={doShell} sinal={d.sinal} dadosAte={d.dadosAte} versao={d.versaoVigente}>
      {conteudo}
    </ShellObra>
  )
}
