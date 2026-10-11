/** @jest-environment node */
/**
 * A imagem do e-mail (spec §5, §11.1). O render real (PNG) NÃO roda aqui: o
 * `next/og` carrega o `@vercel/og` por `import()` dinâmico de módulo ESM, que o
 * jest recusa sem `--experimental-vm-modules`. O PNG de verdade é provado por
 * `node scripts/previa-relatorio-diario.mts` (assinatura, IHDR 900 × alturaDaImagem).
 * Aqui: altura, faixa dos totais, fonte do valor grande e a árvore que o Satori recebe.
 */
import type { ReactElement } from 'react'
import type { Painel } from '../../../../obras/painel/_calculos'
import { ImagemDoPainel, alturaDaImagem, carregarFontes, fonteDoValorKpi, mostraFaixaDosTotais } from '../_imagem'
import { LIDO_EM, painelDiaNormal, painelQuaseVazio, painelValorGrande } from '../__fixtures__/painel'

type El = ReactElement<{ style?: Record<string, unknown>; children?: unknown }>

function filhos(e: El): unknown[] {
  return ([] as unknown[]).concat(e.props?.children ?? []).flat(Infinity as 1)
}
function textos(e: unknown): string[] {
  if (typeof e === 'string' || typeof e === 'number') return [String(e)]
  if (!e || typeof e !== 'object') return []
  return filhos(e as El).flatMap(textos)
}
function todos(e: unknown, acc: El[] = []): El[] {
  if (!e || typeof e !== 'object') return acc
  acc.push(e as El)
  filhos(e as El).forEach((f) => todos(f, acc))
  return acc
}
const arvore = (p: Painel) => ImagemDoPainel({ painel: p, lidoEm: LIDO_EM })
const tudo = (p: Painel) => textos(arvore(p)).join(' ')

describe('alturaDaImagem', () => {
  const base = painelDiaNormal()
  const h0 = alturaDaImagem(base)

  it('é um inteiro positivo e igual à altura da raiz', () => {
    expect(Number.isInteger(h0)).toBe(true)
    expect(h0).toBeGreaterThan(1500)
    expect((arvore(base) as El).props.style!.height).toBe(h0)
  })

  it('cresce com clientes, equipes, motivos de parada e linhas do cronograma', () => {
    const mais = <T,>(l: T[]) => [...l, l[0]]
    const pc = { ...base, porCliente: { ...base.porCliente, linhas: mais(base.porCliente.linhas) } }
    expect(alturaDaImagem(pc)).toBeGreaterThan(h0)
    const eq = { ...base, equipes: { ...base.equipes, linhas: mais(base.equipes.linhas) } }
    expect(alturaDaImagem(eq)).toBeGreaterThan(h0)
    const pa = { ...base, paradas: { ...base.paradas, motivos: Array.from({ length: 4 }, () => base.paradas.motivos).flat() } }
    expect(alturaDaImagem(pa)).toBeGreaterThan(h0)

    const vazio = painelQuaseVazio()
    const linhas = vazio.cronograma.linhas
    expect(linhas.length).toBeLessThan(7)
    const cr = { ...vazio, cronograma: { ...vazio.cronograma, linhas: mais(linhas) } }
    expect(alturaDaImagem(cr)).toBeGreaterThan(alturaDaImagem(vazio))
  })

  it('o cronograma para de crescer no recorte de 7 obras', () => {
    expect(base.cronograma.linhas.length).toBeGreaterThan(7)
    const cr = { ...base, cronograma: { ...base.cronograma, linhas: [...base.cronograma.linhas, ...base.cronograma.linhas] } }
    expect(alturaDaImagem(cr)).toBe(h0)
  })
})

describe('faixa "Atenção aos totais"', () => {
  it('aparece só com mais de 25% da carteira sem valor', () => {
    const normal = painelDiaNormal()
    const vazio = painelQuaseVazio()
    expect(normal.kpis.carteira.semValor).toBe(9)
    expect(vazio.kpis.carteira.semValor).toBe(31)
    expect(mostraFaixaDosTotais(normal)).toBe(false)
    expect(mostraFaixaDosTotais(vazio)).toBe(true)
    expect(tudo(normal)).not.toContain('Atenção aos totais.')
    expect(tudo(vazio)).toContain('Atenção aos totais.')
    expect(tudo(vazio)).toContain('31 das 47 obras ainda não têm valor em R$ no hub.')
  })

  it('exatamente 25% não mostra', () => {
    const p = painelDiaNormal()
    const q = { ...p, kpis: { ...p.kpis, carteira: { ...p.kpis.carteira, qtd: 40, semValor: 10 } } }
    expect(mostraFaixaDosTotais(q)).toBe(false)
  })
})

describe('valor grande do cartão (spec §5.6)', () => {
  it('cai para 20 px acima de 12 caracteres', () => {
    expect(fonteDoValorKpi('R$ 4.280.000')).toBe(24)
    expect(fonteDoValorKpi('R$ 12.345.678')).toBe(20)
  })

  it('na árvore, R$ 12.345.678 sai em 20 px, sem quebra', () => {
    const els = todos(arvore(painelValorGrande())).filter((e) => e.props?.children === 'R$ 12.345.678' && e.props.style?.fontSize !== undefined)
    const kpis = els.filter((e) => e.props.style!.height === 30)
    expect(kpis.length).toBe(2)
    for (const e of kpis) {
      expect(e.props.style!.fontSize).toBe(20)
      expect(e.props.style!.whiteSpace).toBe('nowrap')
    }
  })
})

describe('conteúdo', () => {
  it('traz o "Lido em", os 8 blocos e o rodapé', () => {
    const t = tudo(painelDiaNormal())
    for (const s of [
      `Lido em ${LIDO_EM}`,
      'Metas: carteira e faturamento',
      'Resumo por status',
      'Prazos de resposta (SLA)',
      'Equipes: receita, dias e produtividade',
      'Obras paradas e atrasadas',
      'Ritmo do campo e respostas',
      'Cronograma obra a obra',
      'Histórico de faturamento',
      'Hub Manfac · hub.manfac.com.br/obras/painel',
      `Dados lidos em ${LIDO_EM}`,
    ])
      expect(t).toContain(s)
    expect(t).toMatch(/Mostrando 7 de \d+ obras no cronograma completo/)
  })

  it('quase vazio: zeros em cinza e os vazios da tela', () => {
    const p = painelQuaseVazio()
    const t = tudo(p)
    expect(t).toContain('nenhuma NF emitida de 01/10 a 08/10')
    expect(t).toContain('Nenhuma equipe trabalhou para este filtro no mês.')
    expect(t).toContain('Nenhuma obra parada hoje.')
    const zeros = todos(arvore(p)).filter((e) => e.props?.children === 'R$ 0' && e.props.style?.height === 30)
    expect(zeros.length).toBe(2)
    zeros.forEach((e) => expect(e.props.style!.color).toBe('#94a3b8'))
  })

  it('todo div com filho elemento tem display flex (exigência do Satori)', () => {
    for (const p of [painelDiaNormal(), painelQuaseVazio()]) {
      const ruins = todos(arvore(p)).filter((e) => {
        const c = e.props?.children
        return e.type === 'div' && c !== undefined && c !== null && typeof c !== 'string' && e.props.style?.display !== 'flex'
      })
      expect(ruins).toEqual([])
    }
  })
})

describe('carregarFontes', () => {
  it('lê as 3 fontes estáticas de _fontes/', async () => {
    const f = await carregarFontes()
    expect(f.map((x) => `${x.name} ${x.weight}`)).toEqual(['Inter 400', 'Inter 700', 'JetBrains Mono 700'])
    for (const x of f) expect(x.data.subarray(0, 4).toString('hex')).toBe('00010000')
  })
})
