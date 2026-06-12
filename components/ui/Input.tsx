import { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
}

export default function Input({
  label,
  error,
  id,
  className = '',
  ...props
}: InputProps) {
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, '-')

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-[#94a3b8]">
        {label}
      </label>
      <input
        id={inputId}
        className={`w-full px-4 py-3 rounded-lg text-white placeholder-[#4a6080]
          bg-[#0f1f3d] border transition-colors
          ${error ? 'border-[#ef4444]' : 'border-[#1e3a5f] focus:border-[#f05a28]'}
          focus:outline-none focus:ring-1 focus:ring-[#f05a28]
          ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-[#ef4444]">{error}</p>}
    </div>
  )
}
