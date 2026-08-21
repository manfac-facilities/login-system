/**
 * Bloco reservado para o mapa — provisório de propósito.
 *
 * O endereço da Manfac ainda não foi confirmado pelo cliente. Um mapa
 * apontando para um endereço aproximado manda o cliente para o lugar
 * errado; um bloco assumidamente vazio, não. Mantém a altura do mapa
 * futuro (`h-72 md:h-96`) para não haver salto de layout quando ele entrar.
 */
export default function MapaPlaceholder() {
  return (
    <div className="flex h-72 w-full items-center justify-center rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] md:h-96">
      <p className="text-sm text-[var(--muted)]">
        Endereço a confirmar — o mapa entra assim que a Manfac informar o endereço.
      </p>
    </div>
  )
}
