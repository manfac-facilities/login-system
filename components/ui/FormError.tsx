export default function FormError({ message }: { message?: string }) {
  if (!message) return null

  return (
    <div className="w-full px-4 py-3 rounded-lg bg-[#ef4444]/10 border border-[#ef4444]/30 text-[#ef4444] text-sm">
      {message}
    </div>
  )
}
