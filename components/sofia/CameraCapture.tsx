'use client'
import { useRef, useState, useCallback } from 'react'

interface Props {
  posicao: string
  onCapture: (
    blob: Blob,
    posicao: string,
    lat: number | null,
    lng: number | null
  ) => void
}

export default function CameraCapture({ posicao, onCapture }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [streaming, setStreaming] = useState(false)
  const [captured, setCaptured] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const startCamera = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
        setStreaming(true)
      }
    } catch {
      setError('Câmera não disponível. Verifique as permissões.')
    }
  }, [])

  const capture = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')!.drawImage(video, 0, 0)

    canvas.toBlob(async (blob) => {
      if (!blob) return
      const dataUrl = canvas.toDataURL('image/jpeg')
      setCaptured(dataUrl)

      const stream = video.srcObject as MediaStream
      stream?.getTracks().forEach((t) => t.stop())
      setStreaming(false)

      let lat: number | null = null
      let lng: number | null = null
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 })
        )
        lat = pos.coords.latitude
        lng = pos.coords.longitude
      } catch {}

      onCapture(blob, posicao, lat, lng)
    }, 'image/jpeg', 0.85)
  }, [posicao, onCapture])

  const retake = useCallback(() => {
    setCaptured(null)
    startCamera()
  }, [startCamera])

  if (captured) {
    return (
      <div className="flex flex-col gap-2">
        <div className="relative">
          <img
            src={captured}
            alt={posicao}
            className="rounded-lg w-full object-cover max-h-40"
          />
          <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/60 text-white text-xs">
            {posicao}
          </span>
        </div>
        <button
          type="button"
          onClick={retake}
          className="text-xs text-[#f05a28] hover:underline text-center"
        >
          Tirar novamente
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {error && <p className="text-xs text-red-400">{error}</p>}
      {streaming ? (
        <>
          <div className="relative">
            <video
              ref={videoRef}
              className="rounded-lg w-full object-cover max-h-40 bg-black"
              playsInline
              muted
            />
            <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/60 text-white text-xs">
              {posicao}
            </span>
          </div>
          <button
            type="button"
            onClick={capture}
            className="py-2 rounded-lg bg-[#f05a28] text-white text-sm font-medium hover:bg-[#d94e22] transition-colors"
          >
            Tirar Foto
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={startCamera}
          className="py-3 rounded-lg border-2 border-dashed border-[#1e3a5f] text-[#4a6080] text-sm hover:border-[#f05a28] hover:text-[#f05a28] transition-colors"
        >
          📷 {posicao}
        </button>
      )}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}
