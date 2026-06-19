'use client'

export default function PrintExportButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print px-4 py-2 rounded-lg border border-[#1e3a5f] text-[#94a3b8] text-sm font-medium hover:border-[#94a3b8] transition-colors"
    >
      {label}
    </button>
  )
}
