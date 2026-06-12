import { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean
}

export default function Button({
  children,
  loading,
  disabled,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={`w-full py-3 px-6 rounded-lg font-semibold text-white transition-all
        bg-[#f05a28] hover:bg-[#d94e22] active:scale-[0.98]
        disabled:opacity-50 disabled:cursor-not-allowed
        focus:outline-none focus:ring-2 focus:ring-[#f05a28] focus:ring-offset-2 focus:ring-offset-[#0a1628]
        ${className}`}
      {...props}
    >
      {loading ? 'Aguarde...' : children}
    </button>
  )
}
