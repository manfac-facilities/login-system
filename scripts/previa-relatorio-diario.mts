/**
 * Prévia da imagem do e-mail diário (spec §11.1): gera os PNGs de verdade, com
 * o `ImageResponse` de `next/og`, nos painéis fictícios "dia normal", "quase
 * vazio" e "valor grande", e confere assinatura PNG + IHDR (900 × alturaDaImagem).
 *
 * Existe porque o render não roda dentro do jest: o `next/og` carrega o
 * `@vercel/og` por `import()` dinâmico de um módulo ESM, e o jest (CommonJS)
 * recusa sem `--experimental-vm-modules`.
 *
 * Uso (da raiz do repositório):  node scripts/previa-relatorio-diario.mts [pasta-de-saída]   (padrão: <tmp>/previa-relatorio-diario)
 * O `jiti` (já instalado, via eslint/tailwind) transpila o TSX do app.
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { createJiti } from 'jiti'

const raiz = resolve(import.meta.dirname, '..')
const saida = resolve(process.argv[2] ?? join(tmpdir(), 'previa-relatorio-diario'))
const jiti = createJiti(import.meta.url, { jsx: { runtime: 'automatic' }, alias: { '@': raiz } })

type Mod = typeof import('../app/api/obras/relatorio-diario/_imagem.tsx')
type Fix = typeof import('../app/api/obras/relatorio-diario/__fixtures__/painel.ts')
const img = await jiti.import<Mod>(join(raiz, 'app/api/obras/relatorio-diario/_imagem.tsx'))
const fx = await jiti.import<Fix>(join(raiz, 'app/api/obras/relatorio-diario/__fixtures__/painel.ts'))

await mkdir(saida, { recursive: true })
let falhou = false
for (const [nome, painel] of [
  ['previa-normal.png', fx.painelDiaNormal()],
  ['previa-vazio.png', fx.painelQuaseVazio()],
  ['previa-valor-grande.png', fx.painelValorGrande()],
] as const) {
  const png = await img.gerarPng(painel, fx.LIDO_EM)
  const assinatura = png.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  const ihdr = png.subarray(12, 16).toString('latin1') === 'IHDR'
  const largura = png.readUInt32BE(16)
  const altura = png.readUInt32BE(20)
  const esperada = img.alturaDaImagem(painel)
  const ok = assinatura && ihdr && largura === 900 && altura === esperada
  if (!ok) falhou = true
  await writeFile(join(saida, nome), png)
  console.log(`${ok ? 'OK ' : 'FALHOU'} ${nome}: ${largura} × ${altura} (esperado 900 × ${esperada}), ${png.length} bytes`)
}
console.log(`PNGs em ${saida}`)
process.exit(falhou ? 1 : 0)
