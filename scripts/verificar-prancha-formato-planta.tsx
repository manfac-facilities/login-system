/**
 * Prova com o react-pdf REAL (fora do Jest, que usa mock) o C1 da revisão final da Leva 6b:
 * o `@react-pdf/image` só lê JPEG e PNG. Passa pelo caminho de produção inteiro
 * (`carregarPrancha` → `renderizarPrancha`), com a planta servida por HTTP local:
 *
 * - planta .png e .jpg: a imagem (333 px de largura) entra no PDF;
 * - planta .webp: a imagem NÃO entra, a URL nem é assinada, e o rodapé traz o aviso
 *   "Formato da planta não suportado no PDF…" (lido do texto do PDF pelo pdfjs), sem "Sem planta enviada".
 *
 * As imagens de teste são geradas com `sharp`, que já vem no node_modules pelo Next (só neste script).
 *
 * Rodar na raiz do repositório:
 *   TS_NODE_TRANSPILE_ONLY=1 TS_NODE_COMPILER_OPTIONS='{"module":"commonjs","jsx":"react-jsx","moduleResolution":"node","esModuleInterop":true}' \
 *     npx ts-node scripts/verificar-prancha-formato-planta.tsx
 */
import { createServer } from 'node:http'
import sharp from 'sharp'
import type { SupabaseClient } from '@supabase/supabase-js'
import { carregarPrancha, renderizarPrancha } from '../app/obras/obras/[id]/faseamento/_pdf'

const OBRA = '11111111-2222-4333-8444-555555555555'
const REV = '33333333-3333-4333-8333-333333333333'
const AVISO = 'Formato da planta não suportado no PDF; envie JPG, PNG ou PDF em Montar o mapa'

/** Cliente mínimo: as duas leituras da emitida e a URL assinada, apontando para o servidor local. */
function cliente(port: number, ext: string, assinadas: string[]) {
  const linhas: Record<string, unknown> = {
    obras_obra: { id: OBRA, os: '24.0871', loja: 'Macaé 3', descricao: null, cliente: 'DPSP', modalidade: 'obra' },
    obras_fase_revisao: {
      id: REV, obra_id: OBRA, status: 'emitida', revisao: 0, emitida_em: '2026-11-01T12:00:00Z',
      fase_numero: 1, fase_nome: 'Demolição', planta_path: `${OBRA}/mapa/planta.${ext}`, planta_largura: 333, planta_altura: 222,
      camadas: [{ id: 'c1', t: 'zona_obra', r: [0.1, 0.1, 0.3, 0.3], rot: 'ZONA' }], regras: ['Uma regra.'], carimbo: {}, usa_trava: false, trava_snapshot: null,
    },
  }
  return {
    from: (t: string) => {
      const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: linhas[t] ?? null, error: null }) }
      return q
    },
    storage: {
      from: () => ({
        createSignedUrl: async (path: string) => {
          assinadas.push(path)
          return { data: { signedUrl: `http://127.0.0.1:${port}/${path.split('/').pop()}?token=x` }, error: null }
        },
      }),
    },
  } as unknown as SupabaseClient
}

/** Texto do PDF pelo pdfjs (o react-pdf grava o texto em glifos, não dá para procurar nos bytes). */
async function textoDoPdf(buf: Buffer): Promise<string> {
  const importar = new Function('s', 'return import(s)') as (s: string) => Promise<typeof import('pdfjs-dist')>
  const pdfjs = await importar('pdfjs-dist/legacy/build/pdf.mjs')
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), useSystemFonts: false }).promise
  const pagina = await doc.getPage(1)
  const c = await pagina.getTextContent()
  return c.items.map((i) => ('str' in i ? i.str : '')).join('')
}

async function main() {
  const base = sharp({ create: { width: 333, height: 222, channels: 3, background: { r: 200, g: 30, b: 30 } } })
  const imgs: Record<string, Buffer> = {
    '/planta.png': await base.clone().png().toBuffer(),
    '/planta.jpg': await base.clone().jpeg().toBuffer(),
    '/planta.webp': await base.clone().webp().toBuffer(),
  }
  const srv = createServer((req, res) => {
    const b = imgs[(req.url ?? '').split('?')[0]]
    res.writeHead(b ? 200 : 404)
    res.end(b)
  })
  await new Promise<void>((ok) => srv.listen(0, ok))
  const port = (srv.address() as { port: number }).port
  let falhou = false
  try {
    for (const ext of ['png', 'jpg', 'webp']) {
      const assinadas: string[] = []
      const c = await carregarPrancha(cliente(port, ext, assinadas), OBRA, REV)
      if (!c.ok) throw new Error(`carregarPrancha falhou: ${c.erro}`)
      const buf = await renderizarPrancha(c.dados)
      const temImagem = (buf.toString('latin1').match(/\/Width \d+/g) ?? ([] as string[])).includes('/Width 333')
      const texto = await textoDoPdf(buf)
      const temAviso = texto.includes(AVISO)
      const temSemPlanta = texto.includes('Sem planta enviada')
      const esperado = ext === 'webp' ? !temImagem && temAviso && !temSemPlanta && assinadas.length === 0 : temImagem && !temAviso && !temSemPlanta
      if (!esperado) falhou = true
      console.log(
        `${esperado ? 'OK  ' : 'ERRO'} planta .${ext}: imagem 333 px no PDF=${temImagem}, aviso de formato=${temAviso}, "Sem planta enviada"=${temSemPlanta}, URLs assinadas=${assinadas.length}`,
      )
    }
  } finally {
    srv.close()
  }
  if (falhou) process.exit(1)
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
