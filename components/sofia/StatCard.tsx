interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  accent?: boolean
}

export default function StatCard({ label, value, sub, accent }: StatCardProps) {
  return (
    <div
      className={`rounded-xl p-5 border ${
        accent
          ? 'border-[#f05a28] bg-[#1a0a00]'
          : 'border-[#1e3a5f] bg-[#0d2050]'
      }`}
    >
      <p className="text-xs text-[#4a6080] uppercase tracking-wider font-medium mb-1">
        {label}
      </p>
      <p
        className={`text-3xl font-bold ${accent ? 'text-[#f05a28]' : 'text-white'}`}
      >
        {value}
      </p>
      {sub && <p className="text-xs text-[#4a6080] mt-1">{sub}</p>}
    </div>
  )
}
