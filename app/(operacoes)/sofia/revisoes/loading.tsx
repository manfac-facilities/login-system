export default function Carregando() {
  return (
    <div className="p-4 sm:p-8" aria-busy="true" aria-label="Carregando revisões">
      <div className="mb-6 h-8 w-48 animate-pulse rounded bg-[#0d2050]" />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-[#0d2050]" />)}
      </div>
      {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="mb-2 h-10 animate-pulse rounded bg-[#0d2050]" />)}
    </div>
  )
}
