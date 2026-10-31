/**
 * Situação para o cliente no portal (Leva 5 §7, Task 6): a Visão geral mostra
 * a última situação PUBLICADA com "atualizado em dd/mm por <nome>" (sem
 * e-mail); sem publicação o bloco não aparece. Respostas do analista (internas
 * ou não) nunca chegam ao portal: só o texto publicado passa.
 */
import { renderToStaticMarkup } from 'react-dom/server'
import { situacaoParaCliente, situacaoRowDe } from '@/app/obras/obras/_lib/situacao'
import { obraGrandePdf } from '@/app/obras/obras/_pdf/__tests__/fixtures/rdo'
import { montarVisaoCliente } from '../(obra)/_lib/visao'
import { SlotSituacaoCliente } from '../(obra)/_ui/blocos'

const publicada = situacaoRowDe({
  versao: 2,
  explicacao: 'O atraso é de responsabilidade da Manfac: o drywall levou mais tempo que o planejado.',
  acoes: [
    { oque: 'Segunda equipe de drywall', quando: 'desde 23/11', efeito: 'recupera cerca de 2 dias úteis' },
    { oque: 'Pintura pelos setores prontos', quando: '', efeito: '' },
  ],
  numeros: { atraso: { manfac: 4 } },
  publicada_por: 'jose.guilherme@manfac.com.br',
  publicada_em: '2026-11-16T15:00:00Z',
})!

describe('situação no portal', () => {
  it('montarVisaoCliente leva a situação publicada; sem ela, null', () => {
    const og = obraGrandePdf()
    const sem = montarVisaoCliente({ obra: og, planos: [], restricoes: [], hoje: '2026-11-16' })
    expect(sem.situacao).toBeNull()
    const com = montarVisaoCliente({ obra: og, planos: [], restricoes: [], hoje: '2026-11-16', situacao: situacaoParaCliente(publicada) })
    expect(com.situacao).toEqual({
      explicacao: publicada.explicacao, acoes: publicada.acoes, atualizadoEm: '16/11/2026', por: 'Jose Guilherme',
    })
    // Retrato interno dos números e o e-mail de quem publicou não vão ao cliente.
    expect(Object.keys(com.situacao!).sort()).toEqual(['acoes', 'atualizadoEm', 'explicacao', 'por'])
    expect(JSON.stringify(com.situacao)).not.toContain('@')
  })

  it('bloco: explicação, ações de recuperação e "atualizado em dd/mm por <nome>"', () => {
    const html = renderToStaticMarkup(<SlotSituacaoCliente situacao={situacaoParaCliente(publicada)} />)
    expect(html).toContain('responsabilidade da Manfac')
    expect(html).toContain('O que estamos fazendo para recuperar')
    expect(html).toContain('Segunda equipe de drywall')
    expect(html).toContain('desde 23/11 · recupera cerca de 2 dias úteis')
    expect(html).toMatch(/Atualizado em <span[^>]*>16\/11<\/span> por Jose Guilherme/)
    expect(html).not.toContain('@')
  })

  it('sem situação publicada, nada aparece', () => {
    expect(renderToStaticMarkup(<SlotSituacaoCliente situacao={null} />)).toBe('')
  })
})
