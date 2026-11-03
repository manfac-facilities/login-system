/** Server action só da origem do portal: Origin presente tem de bater com o host da requisição. */
export function origemConfere(h: { get(n: string): string | null }): boolean {
  const origem = h.get('origin')
  if (!origem) return true // sem Origin = mesma origem (o navegador sempre manda em POST cross-site)
  try {
    const host = (h.get('x-forwarded-host') ?? h.get('host') ?? '').split(',')[0].trim().toLowerCase()
    return host !== '' && new URL(origem).host.toLowerCase() === host
  } catch {
    return false
  }
}
