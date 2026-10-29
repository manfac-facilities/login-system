import Link from 'next/link'
import { Box, BoxB, BoxH, Campo, Campos, KPI } from '../../_ui/primitivos'
import type { ObraGrande } from '../_lib/leitura'
import type { Responsavel } from '../_lib/cronograma'
import SeloSinal, { corSinal } from './sinal'

export type EstadoDiario = 'nao_iniciado' | 'rascunho' | 'validado' | 'enviado'

const ROTULO_DIARIO: Record<EstadoDiario, string> = {
  nao_iniciado: 'Não iniciado',
  rascunho: 'Rascunho',
  validado: 'Validado',
  enviado: 'Enviado',
}
const RESP: Record<Responsavel, string> = {
  cliente: 'Cliente',
  manfac: 'Manfac',
  terceiro: 'Terceiro',
  clima: 'Clima',
}
const DE_RESP: Record<Responsavel, string> = {
  cliente: 'do cliente',
  manfac: 'da Manfac',
  terceiro: 'de terceiros',
  clima: 'do clima',
}
const ORDEM: Responsavel[] = ['cliente', 'manfac', 'terceiro', 'clima']

const pct = (f: number) => `${Math.round(f * 100)}%`
const dataBR = (iso: string) => iso.split('-').reverse().join('/')
const diasEntre = (a: string, b: string) =>
  Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000))

export default function PainelObra({
  dados,
  hoje,
  estadoDiario,
  ultimoEnvio,
}: {
  dados: ObraGrande
  hoje: string
  estadoDiario: EstadoDiario
  ultimoEnvio: string | null
}) {
  const { obra, calc, sinal, atraso, versaoVigente, rascunho, impedimentos } = dados
  const base = `/obras/obras/${obra.id}`

  if (!calc) {
    return (
      <Box>
        <BoxB>
          <p className="text-sm text-[#e8eef7]">Esta OBRA ainda não tem cronograma.</p>
          <Link href={`${base}/cronograma`} className="mt-2 inline-block text-sm text-[#f05a28] underline">
            Montar na aba Cronograma
          </Link>
        </BoxB>
      </Box>
    )
  }

  const baseSalva = !!versaoVigente
  const atrasadas = calc.atividades.filter((a) => a.situacao === 'atrasada' || a.situacao === 'inicio_atrasado')
  const aguardando = calc.atividades.filter((a) => a.situacao === 'aguardando_cliente')
  const travadas = calc.atividades.filter((a) => a.travada)
  const abertos = impedimentos.filter((i) => i.categoria === 'impedimento' && !i.encerradoEm)
  const grupos = ORDEM.map((r) => ({ r, itens: abertos.filter((i) => i.responsavel === r) })).filter(
    (g) => g.itens.length,
  )

  const partes = atraso
    ? ORDEM.filter((r) => atraso[r] > 0)
        .map((r) => `${atraso[r]} ${DE_RESP[r]}`)
        .join(', ')
    : ''

  return (
    <div className="flex flex-col gap-4">
      {!baseSalva && rascunho ? (
        <div className="rounded-lg border border-[#eab308] bg-[#eab30820] px-4 py-2 text-sm text-[#e8eef7]">
          Base ainda não salva — os números abaixo vêm do rascunho.{' '}
          <Link href={`${base}/cronograma`} className="text-[#f05a28] underline">
            Abrir cronograma
          </Link>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-lg border border-[#1e3a5f] bg-[#0d2050] px-3 py-2.5">
          <SeloSinal sinal={sinal} />
          <div className="mt-1 text-[11px] text-[#94a3b8]">Sinal da obra</div>
        </div>
        <KPI rotulo="Previsto" valor={pct(calc.previsto)} />
        <KPI rotulo="Realizado" valor={pct(calc.realizado)} />
        <KPI
          rotulo="Desvio"
          valor={`${calc.desvioPP > 0 ? '+' : ''}${Math.round(calc.desvioPP)} p.p.`}
          cor={sinal ? corSinal(sinal) : undefined}
        />
      </div>

      <Box>
        <BoxH>Previsão de entrega</BoxH>
        <BoxB>
          <p className="text-lg font-semibold text-[#e8eef7]">{dataBR(calc.terminoProjetado)}</p>
          {atraso && atraso.total > 0 ? (
            <p className="text-sm text-[#94a3b8]">
              (+{atraso.total} {atraso.total === 1 ? 'dia' : 'dias'}: {partes})
            </p>
          ) : null}
          <p className="mt-1 text-xs text-[#94a3b8]">
            Prazo da base: {dados.terminoBase ? dataBR(dados.terminoBase) : '—'}
          </p>
        </BoxB>
      </Box>

      {travadas.length ? (
        <div className="rounded-lg border border-[#ef4444] bg-[#ef444420] px-4 py-2 text-sm text-[#e8eef7]">
          {travadas.map((a) => a.descricao).join(', ')} travadas até a atividade {obra.atividade_trava}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Box>
          <BoxH extra={atrasadas.length}>Atividades atrasadas</BoxH>
          <BoxB>
            {atrasadas.length ? (
              <ul className="space-y-1 text-sm text-[#e8eef7]">
                {atrasadas.map((a) => (
                  <li key={a.numero}>
                    {a.numero}. {a.descricao}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[#94a3b8]">Nenhuma.</p>
            )}
          </BoxB>
        </Box>
        <Box>
          <BoxH extra={aguardando.length}>Aguardando o cliente</BoxH>
          <BoxB>
            {aguardando.length ? (
              <ul className="space-y-1 text-sm text-[#e8eef7]">
                {aguardando.map((a) => (
                  <li key={a.numero}>
                    {a.numero}. {a.descricao}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[#94a3b8]">Nenhuma.</p>
            )}
          </BoxB>
        </Box>
      </div>

      <Box>
        <BoxH extra={abertos.length}>Impedimentos abertos</BoxH>
        <BoxB>
          {grupos.length ? (
            <div className="space-y-3">
              {grupos.map((g) => (
                <div key={g.r}>
                  <div className="text-[11px] uppercase tracking-wide text-[#94a3b8]">{RESP[g.r]}</div>
                  <ul className="space-y-1 text-sm text-[#e8eef7]">
                    {g.itens.map((i) => {
                      const n = diasEntre(i.abertoEm, hoje)
                      return (
                        <li key={i.id}>
                          {i.descricao}{' '}
                          <span className="text-[#94a3b8]">
                            — há {n} {n === 1 ? 'dia' : 'dias'}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[#94a3b8]">Nenhum impedimento aberto.</p>
          )}
        </BoxB>
      </Box>

      {baseSalva ? (
        <Box>
          <BoxH>Diário de hoje</BoxH>
          <BoxB className="flex flex-wrap items-center justify-between gap-3">
            <Campos cols={2}>
              <Campo rotulo="Estado">{ROTULO_DIARIO[estadoDiario]}</Campo>
              <Campo rotulo="Último envio">{ultimoEnvio ? dataBR(ultimoEnvio) : null}</Campo>
            </Campos>
            <Link
              href={`${base}/diario`}
              className="inline-flex items-center rounded-md bg-[#f05a28] px-3 py-2 text-sm font-medium text-white hover:bg-[#d94d20]"
            >
              Preencher diário de hoje
            </Link>
          </BoxB>
        </Box>
      ) : null}
    </div>
  )
}
