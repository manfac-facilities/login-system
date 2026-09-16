/**
 * @jest-environment node
 */
/**
 * Regressão do incidente de 15/09/2026 — `/obras/sincronizar` fora do ar em
 * produção por um dia inteiro.
 *
 * Causa: `app/obras/sincronizar/_actions.ts`, marcado `'use server'`, tinha
 * `export type { EstadoSincronizacao, RelatorioSincronizacao }`. Em arquivo
 * `'use server'`, TODO export vira referência de runtime no build de
 * produção do Next — e um tipo não existe em runtime. O módulo inteiro
 * morria com `ReferenceError: EstadoSincronizacao is not defined` antes de
 * rodar uma linha sequer, e a tela caía com erro genérico de Server
 * Component.
 *
 * O mais grave: 451 testes passavam e `tsc --noEmit` estava limpo. Em
 * ambiente de teste os tipos somem corretamente antes de rodar, então nada
 * acusava — o defeito só existia no build de produção, e só apareceu quando
 * um humano clicou no botão.
 *
 * Regra aplicada aqui (lida em `node_modules/next/dist/docs/` da versão
 * instalada, Next 16.2.11, antes de escrever este teste):
 *
 *  - `node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md`,
 *    linha ~38: a diretiva `'use server'` pode ir "at the top of a separate
 *    file to mark all exports of that file" (como Server Functions) — ou
 *    seja, TODO export do arquivo vira Server Function.
 *  - `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-cache.md`,
 *    linha ~72: regra irmã, explícita, para a diretiva `'use cache'` (mesma
 *    família de diretiva de arquivo): "When used at file level, all function
 *    exports must be async functions."
 *  - A própria checagem que o Next roda em produção confirma isso em código:
 *    `node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-validate.js`
 *    lança `A "use server" file can only export async functions, found
 *    ${typeof action}.` para qualquer export cujo valor, em runtime, não seja
 *    uma função — é exatamente o que `export type` produz: `typeof
 *    undefined`, que nem chega a essa checagem porque o `ReferenceError`
 *    acontece antes, na resolução do binding.
 *
 * O que ESTE teste permite, de propósito: declaração de tipo INLINE
 * (`export type X = {...}`, `export interface X {...}`) continua liberada.
 * O TypeScript apaga a declaração inteira antes do runtime — não sobra
 * nenhuma referência para o build resolver. É diferente de REEXPORTAR um
 * tipo (`export type { X }`, `export { type X } from '...'`), que é o que
 * quebrou em produção: aí o nome vira uma referência de export que o build
 * tenta resolver em runtime, e ela não existe. Hoje 6 arquivos do projeto
 * fazem a declaração inline (permitida) — este teste roda contra eles para
 * provar que a regra não os reprova.
 *
 * Varre todo arquivo `.ts`/`.tsx` do hub (`app/`, `lib/`, `components/`, e
 * `middleware.ts` na raiz — os outros diretórios da raiz, como
 * `manfac-site/` e `sistema-os/`, são outros apps, fora deste projeto Next)
 * cuja primeira instrução seja a diretiva `'use server'`, e falha se algum
 * export do arquivo não for: (a) uma função declarada `async` diretamente
 * ali, ou (b) uma declaração de tipo inline (`type`/`interface`). Reprova
 * `export type { ... }`, `export { type X }`, `export { X } from '...'`,
 * `export * from '...'`, `export const`/`let`/`var` que não seja função
 * async, `export default` que não seja função async, e export de
 * classe/enum — qualquer forma que o Next proíbe num arquivo `'use server'`.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import * as ts from 'typescript'

const RAIZ = join(__dirname, '..')

// Só os diretórios que são código deste app Next (ver AGENTS.md: os outros
// diretórios da raiz — manfac-site/, sistema-os/, docs/, etc. — não são
// deste projeto).
const DIRETORIOS_DA_APLICACAO = ['app', 'lib', 'components']
const ARQUIVOS_RAIZ_DA_APLICACAO = ['middleware.ts']

function listarArquivosTs(dir: string, acc: string[] = []): string[] {
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const caminho = join(dir, entrada.name)
    if (entrada.isDirectory()) {
      listarArquivosTs(caminho, acc)
    } else if (/\.tsx?$/.test(entrada.name)) {
      acc.push(caminho)
    }
  }
  return acc
}

function todosArquivosTsDaAplicacao(): string[] {
  const acc: string[] = []
  for (const dir of DIRETORIOS_DA_APLICACAO) {
    listarArquivosTs(join(RAIZ, dir), acc)
  }
  for (const arquivo of ARQUIVOS_RAIZ_DA_APLICACAO) {
    acc.push(join(RAIZ, arquivo))
  }
  return acc
}

/**
 * Mesma regra do Next: a diretiva precisa ser a primeira instrução do
 * arquivo (comentários e linhas em branco antes dela não contam como
 * instrução).
 */
function comecaComUseServer(sourceFile: ts.SourceFile): boolean {
  const primeira = sourceFile.statements[0]
  if (!primeira || !ts.isExpressionStatement(primeira)) return false
  const expr = primeira.expression
  return ts.isStringLiteral(expr) && expr.text === 'use server'
}

function temModificador(node: ts.Node, kind: ts.SyntaxKind): boolean {
  if (!ts.canHaveModifiers(node)) return false
  return !!ts.getModifiers(node)?.some((m) => m.kind === kind)
}

function ehFuncaoAsyncInline(expr: ts.Expression | undefined): boolean {
  if (!expr) return false
  if (!ts.isArrowFunction(expr) && !ts.isFunctionExpression(expr)) return false
  return temModificador(expr, ts.SyntaxKind.AsyncKeyword)
}

interface Violacao {
  linha: number
  trecho: string
  motivo: string
}

function linhaDe(sourceFile: ts.SourceFile, node: ts.Node): number {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1
}

function trechoDe(sourceFile: ts.SourceFile, node: ts.Node): string {
  return node.getText(sourceFile).split('\n')[0].trim().slice(0, 140)
}

/**
 * Varre os top-level statements de um arquivo 'use server' e devolve todo
 * export que não seja função async (nem declaração de tipo inline).
 */
function encontrarExportsInvalidos(caminho: string, codigoFonte: string): Violacao[] {
  const scriptKind = caminho.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const sourceFile = ts.createSourceFile(caminho, codigoFonte, ts.ScriptTarget.Latest, true, scriptKind)
  const violacoes: Violacao[] = []

  const registrar = (node: ts.Node, motivo: string) =>
    violacoes.push({ linha: linhaDe(sourceFile, node), trecho: trechoDe(sourceFile, node), motivo })

  for (const stmt of sourceFile.statements) {
    // Declaração de tipo inline: o TS apaga a instrução inteira antes do
    // runtime. Não sobra export nenhum para o build resolver -- permitido.
    if (ts.isTypeAliasDeclaration(stmt) || ts.isInterfaceDeclaration(stmt)) continue

    // `export { ... }`, `export type { ... }`, `export { type X } from ...`,
    // `export * from '...'`: sempre reprovado. Este é exatamente o formato
    // que derrubou a tela em 15/09/2026.
    if (ts.isExportDeclaration(stmt)) {
      registrar(
        stmt,
        'reexport (`export { ... }` / `export type { ... }` / `export * from`) vira ' +
          'referência de runtime que pode não existir -- declare a função async diretamente neste arquivo'
      )
      continue
    }

    if (ts.isFunctionDeclaration(stmt)) {
      if (!temModificador(stmt, ts.SyntaxKind.ExportKeyword)) continue // não exportado, não é regra nossa
      if (!temModificador(stmt, ts.SyntaxKind.AsyncKeyword)) {
        registrar(stmt, 'export de função que não é async')
      }
      continue
    }

    if (ts.isVariableStatement(stmt)) {
      if (!temModificador(stmt, ts.SyntaxKind.ExportKeyword)) continue
      for (const decl of stmt.declarationList.declarations) {
        if (!ehFuncaoAsyncInline(decl.initializer)) {
          registrar(decl, 'export const/let/var que não é uma função async declarada inline')
        }
      }
      continue
    }

    if (ts.isExportAssignment(stmt)) {
      // export default <expr>
      if (!ehFuncaoAsyncInline(stmt.expression)) {
        registrar(stmt, 'export default que não é uma função async declarada inline')
      }
      continue
    }

    if (ts.isClassDeclaration(stmt) && temModificador(stmt, ts.SyntaxKind.ExportKeyword)) {
      registrar(stmt, 'export de classe -- não é função')
      continue
    }

    if (ts.isEnumDeclaration(stmt) && temModificador(stmt, ts.SyntaxKind.ExportKeyword)) {
      registrar(stmt, 'export de enum -- não é função')
      continue
    }

    if (ts.isModuleDeclaration(stmt) && temModificador(stmt, ts.SyntaxKind.ExportKeyword)) {
      registrar(stmt, 'export de namespace/module -- não é função')
      continue
    }
  }

  return violacoes
}

const arquivosDaAplicacao = todosArquivosTsDaAplicacao().map((caminho) => ({
  caminho,
  codigo: readFileSync(caminho, 'utf8'),
}))

const arquivosUseServer = arquivosDaAplicacao
  .map(({ caminho, codigo }) => ({
    caminho,
    codigo,
    sourceFile: ts.createSourceFile(
      caminho,
      codigo,
      ts.ScriptTarget.Latest,
      true,
      caminho.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    ),
  }))
  .filter(({ sourceFile }) => comecaComUseServer(sourceFile))
  .map(({ caminho, codigo }) => ({ caminho, codigo }))

describe("'use server' só pode exportar função async (regressão do incidente de /obras/sincronizar, 15/09/2026)", () => {
  it('encontrou arquivos "use server" para varrer -- sanity check do próprio teste', () => {
    // Se isto cair para 0, o teste está varrendo o diretório errado e
    // passando "verde" por não achar nada -- pior que não existir.
    expect(arquivosUseServer.length).toBeGreaterThan(0)
  })

  it.each(arquivosUseServer.map(({ caminho, codigo }) => [relative(RAIZ, caminho), caminho, codigo] as const))(
    '%s só exporta função async (ou tipo declarado inline)',
    (_nomeRelativo, caminho, codigo) => {
      const violacoes = encontrarExportsInvalidos(caminho, codigo)
      if (violacoes.length > 0) {
        const detalhe = violacoes.map((v) => `  linha ${v.linha}: ${v.trecho}\n    -> ${v.motivo}`).join('\n')
        throw new Error(
          `${relative(RAIZ, caminho)} tem export inválido em arquivo 'use server' ` +
            `(quebraria em produção como no incidente de 15/09/2026):\n${detalhe}`
        )
      }
    }
  )

  it('não reprova as declarações de tipo inline que já existem hoje em produção', () => {
    const comTipoInline = arquivosUseServer.filter(({ codigo }) => /^export\s+(type|interface)\s/m.test(codigo))
    // Confirma que o teste está de fato exercitando o caso permitido, não só
    // não achando nenhum.
    expect(comTipoInline.length).toBeGreaterThanOrEqual(6)
    for (const { caminho, codigo } of comTipoInline) {
      expect(encontrarExportsInvalidos(caminho, codigo)).toEqual([])
    }
  })
})
