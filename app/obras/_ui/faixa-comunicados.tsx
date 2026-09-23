'use client'

/**
 * Faixa "Novidade" no topo das telas de /obras — seção 1 do mockup aprovado
 * (docs/cliente/2026-08-31-sistema-controle-de-obras/mockup-comunicado-atualizacoes-2026-09-22.html).
 *
 * Mostra o comunicado mais recente; o chip "+N novidade(s)" abre os demais.
 * "Entendi" confirma a faixa inteira (todos os não lidos). O corpo é texto
 * puro — primeira linha é o texto curto, as outras são o "ver o que mudou" —
 * e é renderizado como texto, nunca como HTML.
 */

import { useEffect, useState } from 'react'
import {
  listarComunicadosNaoLidos,
  marcarComunicadoLido,
  type Comunicado,
} from '../_comunicados-actions'

function linhas(corpo: string) {
  return corpo.split('\n').map((l) => l.trim()).filter(Boolean)
}

export default function FaixaComunicados() {
  const [comunicados, setComunicados] = useState<Comunicado[]>([])
  const [expandido, setExpandido] = useState(false)
  const [demaisAbertas, setDemaisAbertas] = useState(false)
  const [erro, setErro] = useState(false)

  useEffect(() => {
    listarComunicadosNaoLidos().then(setComunicados)
  }, [])

  if (comunicados.length === 0) return null

  const [primeiro, ...demais] = comunicados
  const [textoCurto, ...detalhe] = linhas(primeiro.corpo)

  async function entendi() {
    try {
      const resultados = await Promise.all(comunicados.map((c) => marcarComunicadoLido(c.id)))
      if (resultados.every((r) => r.ok)) setComunicados([])
      else setErro(true)
    } catch {
      // Action que lança (rede caiu) é o mesmo estado "erro ao marcar como lido" do mockup.
      setErro(true)
    }
  }

  return (
    <div className="border-b border-[#1e3a5f] bg-[#0b1b36]">
      <div className="max-w-[1000px] mx-auto px-[14px] py-3 sm:px-[22px] sm:py-[13px] flex flex-wrap sm:flex-nowrap gap-3 items-start">
        <div
          aria-hidden="true"
          className="flex-none w-[26px] h-[26px] mt-px rounded-full grid place-items-center text-[13px] text-[#5aa9f0] bg-[rgba(90,169,240,.13)] border border-[rgba(90,169,240,.45)]"
        >
          🔔
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="font-semibold text-[13.5px] text-[#e9f0fa]">{primeiro.titulo}</span>
            <span className="inline-block text-[9.5px] tracking-[.07em] uppercase font-bold text-[#5aa9f0] border border-[rgba(90,169,240,.45)] bg-[rgba(90,169,240,.13)] rounded-full px-1.5 whitespace-nowrap">
              novidade
            </span>
            {demais.length > 0 && (
              <button
                type="button"
                onClick={() => setDemaisAbertas(!demaisAbertas)}
                className="bg-[rgba(0,0,0,.25)] border border-[#1e3a5f] text-[#94a3b8] px-[9px] py-0.5 rounded-full text-[11.5px] hover:text-[#e9f0fa] hover:border-[#2b4f7d]"
              >
                {demaisAbertas
                  ? demais.length === 1
                    ? 'ocultar a outra novidade'
                    : 'ocultar as outras novidades'
                  : `+${demais.length} ${demais.length === 1 ? 'novidade' : 'novidades'}`}
              </button>
            )}
          </div>
          {textoCurto && <p className="text-[12.5px] text-[#94a3b8] mt-[3px] max-w-[70ch]">{textoCurto}</p>}
          <div className="flex flex-wrap gap-4 items-center mt-[9px]">
            {detalhe.length > 0 && (
              <button
                type="button"
                onClick={() => setExpandido(!expandido)}
                className="text-[#f05a28] text-[12.5px] underline underline-offset-[3px]"
              >
                {expandido ? 'ocultar o que mudou' : 'ver o que mudou'}
              </button>
            )}
            <button
              type="button"
              onClick={entendi}
              className="bg-transparent text-[#94a3b8] border border-[#1e3a5f] rounded-[5px] px-[11px] py-1 text-xs hover:text-[#e9f0fa] hover:border-[#2b4f7d]"
            >
              Entendi
            </button>
          </div>
          {expandido && (
            <div className="mt-2.5 pt-2.5 border-t border-dashed border-[#162c4a] text-[12.5px] text-[#94a3b8]">
              <ul className="mt-1 pl-[18px] list-disc flex flex-col gap-1">
                {detalhe.map((linha, i) => (
                  <li key={i}>{linha}</li>
                ))}
              </ul>
            </div>
          )}
          {demaisAbertas &&
            demais.map((c) => (
              <div key={c.id} className="mt-3 pt-3 border-t border-dashed border-[#162c4a]">
                <span className="font-semibold text-[13.5px] text-[#e9f0fa]">{c.titulo}</span>
                <p className="text-[12.5px] text-[#94a3b8] mt-[3px] max-w-[70ch]">{linhas(c.corpo)[0]}</p>
              </div>
            ))}
          {erro && (
            <div className="mt-[9px] flex gap-[7px] items-start text-xs text-[#f4b73f]">
              <span aria-hidden="true" className="flex-none">
                ⚠
              </span>
              <span>
                Não deu para salvar sua confirmação agora. A faixa continua aparecendo — tentaremos de
                novo sozinhos na próxima vez que você abrir o Controle de Obras.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
