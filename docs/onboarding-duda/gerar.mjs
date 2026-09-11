/**
 * Gera a página de frentes a partir do template e dos três .md deste diretório.
 *
 * POR QUE ISTO É UM SCRIPT, e não um comando colado no README: em 11/09/2026 a página
 * foi editada à mão, direto no HTML gerado, e o `_template.html` ficou divergente da
 * página publicada. Deu para reconciliar porque o gerador é determinístico — mas só
 * porque alguém percebeu. Comando que mora dentro de documentação não é executado;
 * arquivo que se roda, sim.
 *
 * Uso:
 *   node docs/onboarding-duda/gerar.mjs           # gera
 *   node docs/onboarding-duda/gerar.mjs --check   # só confere, não escreve
 *
 * O `--check` existe para o caso inverso: descobrir que alguém editou o HTML à mão
 * ANTES de regerar por cima e perder a edição.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const aqui = dirname(fileURLToPath(import.meta.url))
const SAIDA = join(aqui, '..', 'cliente', '2026-08-31-sistema-controle-de-obras', 'frentes-joao-duda.html')

/** Os três .md entram dentro de um <pre>, então `&`, `<` e `>` viram entidade. */
const escapar = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const MAPA = {
  __MD_00__: '00-CONTEXTO.md',
  __MD_01__: '01-REGRAS-DE-TRABALHO.md',
  __MD_02__: '02-FRENTES-DO-DUDA.md',
}

let html = readFileSync(join(aqui, '_template.html'), 'utf8')

for (const [marcador, arquivo] of Object.entries(MAPA)) {
  if (!html.includes(marcador)) {
    console.error(`ERRO: o template não tem o marcador ${marcador}. Alguém o removeu?`)
    process.exit(1)
  }
  html = html.replace(marcador, escapar(readFileSync(join(aqui, arquivo), 'utf8')))
}

if (process.argv.includes('--check')) {
  const emDisco = readFileSync(SAIDA, 'utf8')
  const igual = html.trim() === emDisco.trim()
  console.log(igual ? 'OK — a página em disco é exatamente o que o template gera.' : 'DIVERGENTE — a página em disco não corresponde ao template + .md.')
  if (!igual) {
    console.log(`   gerado: ${html.length} bytes | em disco: ${emDisco.length} bytes`)
    console.log('   Se a diferença for uma edição feita à mão no HTML, porte-a para o _template.html ANTES de regerar.')
  }
  process.exit(igual ? 0 : 1)
}

writeFileSync(SAIDA, html)
console.log(`Gerado: ${SAIDA}`)
console.log(`${html.length} bytes. Republique no mesmo artifact para manter a URL.`)
