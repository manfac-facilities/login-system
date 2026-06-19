'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'

export default function FilterSelect({
  paramName,
  options,
  allLabel = 'Todos',
}: {
  paramName: string
  options: { value: string; label: string }[]
  allLabel?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  return (
    <select
      defaultValue={searchParams.get(paramName) ?? ''}
      onChange={(e) => {
        const params = new URLSearchParams(searchParams.toString())
        if (e.target.value) params.set(paramName, e.target.value)
        else params.delete(paramName)
        router.push(`${pathname}?${params.toString()}`)
      }}
      className="px-4 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-[#94a3b8] text-sm focus:outline-none focus:border-[#f05a28]"
    >
      <option value="">{allLabel}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}
