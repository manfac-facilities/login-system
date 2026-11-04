'use client'
import { useState } from 'react'
import CameraCapture from './CameraCapture'
import { TETO_FOTOS, cabeMaisFoto, type FotoRascunho } from '@/lib/sofia/fotosChecklist'

let seq = 0
export function novoIdLocal(prefixo: string): string {
  seq += 1
  return `${prefixo}-${Date.now()}-${seq}`
}

export function fotoRascunho(blob: Blob, lat: number | null, lng: number | null): FotoRascunho {
  return { id: novoIdLocal('f'), blob, url: URL.createObjectURL(blob), lat, lng }
}

/**
 * Lista de fotos ainda não salvas + botão para tirar mais uma. O "x" existe só
 * aqui (rascunho): depois de salva, a foto é prova e ninguém apaga.
 * `totalAtual` = tudo o que o formulário já tem (para o teto de 30 valer no conjunto).
 */
export default function FotosAdicionais({
  fotos,
  onChange,
  totalAtual,
  rotuloBotao = '+ Mais fotos (ângulo livre)',
  permitirGaleria = true,
}: {
  fotos: FotoRascunho[]
  onChange: (fotos: FotoRascunho[]) => void
  totalAtual: number
  rotuloBotao?: string
  permitirGaleria?: boolean
}) {
  // muda a cada foto para o CameraCapture voltar ao estado inicial
  const [rodada, setRodada] = useState(0)

  function adicionar(blob: Blob, _posicao: string, lat: number | null, lng: number | null) {
    onChange([...fotos, fotoRascunho(blob, lat, lng)])
    setRodada((r) => r + 1)
  }

  function remover(id: string) {
    const f = fotos.find((x) => x.id === id)
    if (f) URL.revokeObjectURL(f.url)
    onChange(fotos.filter((x) => x.id !== id))
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {fotos.map((f, i) => (
        <div key={f.id} className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={f.url} alt={`Foto ${i + 1}`} className="rounded-lg w-full object-cover h-28" />
          <button
            type="button"
            onClick={() => remover(f.id)}
            aria-label="Remover foto (ainda não salva)"
            className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/70 text-white text-xs"
          >
            ×
          </button>
        </div>
      ))}
      {cabeMaisFoto(totalAtual) ? (
        <CameraCapture key={rodada} posicao={rotuloBotao} onCapture={adicionar} permitirGaleria={permitirGaleria} />
      ) : (
        <p className="text-xs text-[#94a3b8] self-center">Limite de {TETO_FOTOS} fotos</p>
      )}
    </div>
  )
}
