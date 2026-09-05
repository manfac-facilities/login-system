'use client'

import { useState } from 'react'
import { Box, BoxB, BoxH, Botao, EstadoVazio, KPI } from '../_ui/primitivos'
import { importarPlanilhaAction, type EstadoImportacao } from './_actions'

export default function FormImportacao() {
  const [estado, setEstado] = useState<EstadoImportacao | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [nomeArquivo, setNomeArquivo] = useState('')

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setEnviando(true)
    setEstado(null)
    try {
      setEstado(await importarPlanilhaAction(new FormData(e.currentTarget)))
    } catch {
      setEstado({ error: 'Não deu para importar. Tente de novo.' })
    } finally {
      setEnviando(false)
    }
  }

  const rel = estado?.relatorio

  return (
    <div className="space-y-4">
      <Box>
        <BoxH>Carregar a planilha</BoxH>
        <BoxB>
          <form onSubmit={enviar} className="space-y-3">
            <p className="text-sm text-[#94a3b8]">
              A planilha precisa ter as abas <strong className="text-[#e8eef7]">Pipeline DPSP</strong>{' '}
              e <strong className="text-[#e8eef7]">Planejamento DPSP</strong>. A Pipeline cria as
              obras; a Planejamento completa as que estão em campo.
            </p>

            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] uppercase tracking-wide text-[#94a3b8]">Arquivo .xlsx</span>
              <input
                type="file"
                name="planilha"
                accept=".xlsx"
                required
                onChange={(e) => setNomeArquivo(e.target.files?.[0]?.name ?? '')}
                className="block w-full rounded-md border border-[#1e3a5f] bg-[#0a1628] px-3 py-2 text-sm text-[#e8eef7] file:mr-3 file:rounded file:border-0 file:bg-[#1e3a5f] file:px-3 file:py-1.5 file:text-sm file:text-[#e8eef7]"
              />
            </label>

            <div className="flex items-center gap-3">
              <Botao type="submit" disabled={enviando || !nomeArquivo}>
                {enviando ? 'Importando…' : 'Importar'}
              </Botao>
              {enviando ? (
                <span className="text-xs text-[#94a3b8]">
                  Lendo a planilha e gravando. Não feche a página.
                </span>
              ) : null}
            </div>
          </form>
        </BoxB>
      </Box>

      {estado?.error ? (
        <Box>
          <BoxB>
            <p className="text-sm text-[#ff4d6d]">{estado.error}</p>
          </BoxB>
        </Box>
      ) : null}

      {rel ? (
        <Box>
          <BoxH extra="importação concluída">Relatório</BoxH>
          <BoxB className="space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              <KPI rotulo="Linhas na Pipeline" valor={rel.lidasPipeline} />
              <KPI rotulo="Linhas na Planejamento" valor={rel.lidasPlanejamento} />
              <KPI rotulo="Obras criadas" valor={rel.inseridas} cor="#35c98a" />
              <KPI rotulo="Obras atualizadas" valor={rel.atualizadas} cor="#5aa9f0" />
              <KPI
                rotulo="Linhas descartadas"
                valor={rel.descartadas.length}
                cor={rel.descartadas.length ? '#f4b73f' : undefined}
              />
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold text-[#e8eef7]">O que ficou de fora</h3>
              {rel.descartadas.length === 0 ? (
                <EstadoVazio>Nenhuma linha foi descartada.</EstadoVazio>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[32rem] text-left text-sm">
                    <thead>
                      <tr className="border-b border-[#1e3a5f] text-[11px] uppercase tracking-wide text-[#94a3b8]">
                        <th className="py-1.5 pr-3 font-medium">Aba</th>
                        <th className="py-1.5 pr-3 font-medium">Linha</th>
                        <th className="py-1.5 font-medium">Por quê</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rel.descartadas.map((d, i) => (
                        <tr key={`${d.origem}-${d.linha}-${i}`} className="border-b border-[#1e3a5f]/50">
                          <td className="py-1.5 pr-3 whitespace-nowrap text-[#94a3b8]">
                            {d.origem === 'pipeline' ? 'Pipeline' : 'Planejamento'}
                          </td>
                          <td className="py-1.5 pr-3 text-[#94a3b8]">{d.linha}</td>
                          <td className="py-1.5 text-[#e8eef7]">{d.motivo}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="mt-2 text-xs text-[#64748b]">
                Toda linha que não entrou está listada aqui com o motivo. Importar em silêncio
                esconderia obra que o cliente acha que existe no sistema.
              </p>
            </div>
          </BoxB>
        </Box>
      ) : null}
    </div>
  )
}
