/**
 * @jest-environment node
 *
 * Confere a leitura contra as amostras REAIS de 27/10/2026. Elas têm dado
 * pessoal e ficam fora do Git (.gitignore): sem a pasta, este teste é pulado.
 * Para rodar: EXTRATOS_AMOSTRAS=<pasta> npx jest amostras-reais
 * (padrão: docs/cliente/2026-10-27-frotas-extratos-amostras na raiz do repo).
 * Nada daqui imprime conteúdo das linhas — só contagens.
 */
import fs from 'node:fs'
import path from 'node:path'
import { lerTicketlog } from '../ticketlog'
import { lerVeloe } from '../veloe'
import { resumirLinhas } from '../tipos'

const PASTA =
  process.env.EXTRATOS_AMOSTRAS ??
  path.join(__dirname, '..', '..', '..', '..', 'docs', 'cliente', '2026-10-27-frotas-extratos-amostras')
const existe = fs.existsSync(PASTA)
const arquivo = (re: RegExp) => {
  const nome = fs.readdirSync(PASTA).find((f) => re.test(f))
  if (!nome) throw new Error(`amostra ${re} não encontrada em ${PASTA}`)
  return fs.readFileSync(path.join(PASTA, nome))
}

;(existe ? describe : describe.skip)('amostras reais de 27/10/2026', () => {
  it('Ticketlog: 206 transações, 26 cartões, sem motorista', async () => {
    const linhas = await lerTicketlog(arquivo(/^RFCV_.*\.xlsx$/))
    const r = resumirLinhas(linhas)
    expect(r.total).toBe(206)
    expect(r.identificadores).toBe(26)
    expect(r.inicio! >= '2026-10-01' && r.fim! <= '2026-10-27').toBe(true)
    expect(linhas.every((l) => l.placa === null)).toBe(true)
  })

  it('Veloe: 403 transações, 27 tags, 40 REENVIO, data de uso ≠ processamento preservada', () => {
    const linhas = lerVeloe(arquivo(/^Extrato_veloe.*\.csv$/))
    const r = resumirLinhas(linhas)
    expect(r.total).toBe(403)
    expect(r.identificadores).toBe(27)
    expect(linhas.filter((l) => l.servico === 'REENVIO DENTRO SLA')).toHaveLength(40)
    expect(linhas.filter((l) => l.servico === 'Estadia Dentro SLA')).toHaveLength(44)
    expect(JSON.stringify(linhas)).not.toMatch(/EQUIPE/i) // Informacao 1 = nome do motorista
  })
})
