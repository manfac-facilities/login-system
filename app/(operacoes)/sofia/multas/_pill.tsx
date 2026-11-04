import type { ClassePrazo } from '@/lib/sofia/multaEtapas'

const ESTILO: Record<ClassePrazo['tipo'], string> = {
  indicado: 'bg-green-900 text-green-300',
  vencido: 'bg-red-900 text-red-300',
  urgente: 'bg-red-900 text-red-300',
  atencao: 'bg-amber-900 text-amber-300',
  normal: 'bg-[#1e3a5f] text-[#94a3b8]',
}

export default function PillPrazo({ prazo }: { prazo: ClassePrazo | null }) {
  if (!prazo) return <span className="text-[#4a6080]">—</span>
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${ESTILO[prazo.tipo]}`}>
      {prazo.texto}
    </span>
  )
}
