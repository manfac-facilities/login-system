import { Box, BoxB, BoxH, EstadoVazio } from '../_ui/primitivos'

export type ExecucaoSyncRow = {
  id: string
  iniciada_em: string
  finalizada_em: string | null
  tipo: 'completa' | 'incremental'
  origem: 'agendada' | 'botao'
  status: 'rodando' | 'sucesso' | 'falhou'
  erro: string | null
  total_field: number
  novas: number
  atualizadas: number
  ignoradas: number
  marca_dagua_nova: string | null
}

function dataHora(valor: string | null): string {
  if (!valor) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(valor))
}

const COR_DO_STATUS: Record<ExecucaoSyncRow['status'], string> = {
  rodando: '#f4b73f',
  sucesso: '#35c98a',
  falhou: '#ff4d6d',
}

export default function HistoricoSincronizacao({ execucoes }: { execucoes: ExecucaoSyncRow[] }) {
  return (
    <Box>
      <BoxH extra="últimas 10">Histórico das execuções</BoxH>
      <BoxB>
        {execucoes.length === 0 ? (
          <EstadoVazio>Nenhuma sincronização registrada ainda.</EstadoVazio>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[42rem] text-left text-sm">
              <thead>
                <tr className="border-b border-[#1e3a5f] text-[11px] uppercase tracking-wide text-[#94a3b8]">
                  <th className="py-1.5 pr-3 font-medium">Início</th>
                  <th className="py-1.5 pr-3 font-medium">Tipo</th>
                  <th className="py-1.5 pr-3 font-medium">Origem</th>
                  <th className="py-1.5 pr-3 font-medium">Status</th>
                  <th className="py-1.5 pr-3 font-medium">Resultado</th>
                  <th className="py-1.5 font-medium">Marca d’água</th>
                </tr>
              </thead>
              <tbody>
                {execucoes.map((execucao) => (
                  <tr key={execucao.id} className="border-b border-[#1e3a5f]/50 align-top">
                    <td className="whitespace-nowrap py-2 pr-3 text-[#e8eef7]">
                      {dataHora(execucao.iniciada_em)}
                    </td>
                    <td className="py-2 pr-3 text-[#94a3b8]">{execucao.tipo}</td>
                    <td className="py-2 pr-3 text-[#94a3b8]">{execucao.origem}</td>
                    <td className="py-2 pr-3 font-medium" style={{ color: COR_DO_STATUS[execucao.status] }}>
                      {execucao.status}
                    </td>
                    <td className="py-2 pr-3 text-[#94a3b8]">
                      {execucao.erro
                        ? execucao.erro
                        : `${execucao.total_field} lidas · ${execucao.novas} novas · ${execucao.atualizadas} atualizadas · ${execucao.ignoradas} ignoradas`}
                    </td>
                    <td className="whitespace-nowrap py-2 text-[#94a3b8]">
                      {dataHora(execucao.marca_dagua_nova)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </BoxB>
    </Box>
  )
}
