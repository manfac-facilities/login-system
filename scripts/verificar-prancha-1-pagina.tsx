/**
 * Prova com o react-pdf REAL (fora do Jest, que usa mock) que a prancha de
 * faseamento cabe em exatamente 1 página A3 no pior caso: 12 regras de 200
 * caracteres, legenda com os 13 tipos, trava longa e carimbo cheio.
 *
 * Rodar na raiz do repositório:
 *   TS_NODE_TRANSPILE_ONLY=1 TS_NODE_COMPILER_OPTIONS='{"module":"commonjs","jsx":"react-jsx","moduleResolution":"node","esModuleInterop":true}' \
 *     npx ts-node scripts/verificar-prancha-1-pagina.tsx [saida.pdf]
 */
import { writeFileSync } from 'node:fs'
import { renderToBuffer } from '@react-pdf/renderer'
import { registrarFontes } from '../app/obras/obras/_pdf/base'
import { PranchaFaseamento, type DadosPrancha } from '../app/obras/obras/[id]/faseamento/_lib/prancha-pdf'
import { CAMADAS_EXEMPLO_FASE1, MAX_REGRAS, MAX_TEXTO_CARIMBO, MAX_TEXTO_REGRA, TIPOS, type Camada, type TipoCamada } from '../app/obras/obras/[id]/faseamento/_lib/camadas'
import { textoDaTrava } from '../app/obras/obras/[id]/faseamento/_lib/trava'

const palavras = 'escoramento provisório da viga principal concluído liberado pelo responsável técnico antes de qualquer demolição na zona de obra'.split(' ')
const regra = (i: number, n: number) => {
  let t = `${i} `
  for (let k = 0; t.length < n; k++) t += `${palavras[(k + i) % palavras.length]} `
  return t.slice(0, n).trim()
}
const todosTipos: Camada[] = (Object.keys(TIPOS) as TipoCamada[]).map((t, i): Camada => {
  const g = TIPOS[t].grupo
  if (g === 'zona') return { id: `z${i}`, t, r: [0.1, 0.1, 0.2, 0.2] } as Camada
  if (g === 'linha' || g === 'fluxo') return { id: `l${i}`, t, p: [[0.1, 0.5], [0.8, 0.5]] } as Camada
  return { id: `p${i}`, t, at: [0.5, 0.5] } as Camada
})

const pior: DadosPrancha = {
  obra: { nome: 'Macaé 3 com nome bem comprido', os: '24.0871' },
  fase: { numero: 1, nome: 'Demolição e reforço' },
  revisao: { revisao: 12, emitidaEm: '2026-10-30T15:00:00Z' },
  camadas: [...CAMADAS_EXEMPLO_FASE1, ...todosTipos],
  regras: Array.from({ length: MAX_REGRAS }, (_, i) => regra(i + 1, MAX_TEXTO_REGRA)),
  carimbo: { titulo: regra(0, MAX_TEXTO_CARIMBO), cliente: regra(0, MAX_TEXTO_CARIMBO), desenho: regra(0, MAX_TEXTO_CARIMBO), base: regra(0, MAX_TEXTO_CARIMBO), rt: regra(0, MAX_TEXTO_CARIMBO) },
  travaTexto: textoDaTrava(
    {
      data: '2026-10-30',
      atividade: { numero: 6, descricao: 'Escoramento provisório da viga principal do salão de vendas', status: 'em_andamento' },
      bloqueadas: [11, 12, 13].map((n) => ({ numero: n, descricao: 'Demolição do forro e das divisórias do depósito', status: 'bloqueado' })),
    },
  ),
  plantaUrl: null,
  planta: null,
}

async function main() {
  registrarFontes()
  const casos: [string, DadosPrancha][] = [
    ['pior caso (12 regras x 200, 13 tipos, trava longa)', pior],
    ['limite do degrau 10 pt (1500 caracteres)', { ...pior, regras: Array.from({ length: 10 }, (_, i) => regra(i + 1, 150)) }],
    ['limite do degrau 11,5 pt (900 caracteres)', { ...pior, regras: Array.from({ length: 12 }, (_, i) => regra(i + 1, 75)) }],
    ['exemplo curto', { ...pior, regras: ['Uma regra.'], carimbo: { titulo: 'T', cliente: 'C', desenho: 'D', base: 'B', rt: 'R' }, travaTexto: null }],
  ]
  let falhou = false
  for (const [nome, dados] of casos) {
    const buf = await renderToBuffer(<PranchaFaseamento {...dados} />)
    const paginas = (buf.toString('latin1').match(/\/Type \/Page(?![s\w])/g) ?? []).length
    console.log(`${paginas === 1 ? 'OK ' : 'ERRO'} ${nome}: ${paginas} página(s), ${buf.length} bytes`)
    if (paginas !== 1) falhou = true
    if (process.argv[2] && dados === pior) writeFileSync(process.argv[2], buf)
  }
  if (falhou) process.exit(1)
}
main()
