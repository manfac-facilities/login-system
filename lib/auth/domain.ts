const ALLOWED_DOMAIN = '@manfac.com.br'

export function isManfacEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase()
  const atCount = normalized.split('@').length - 1
  return atCount === 1 && normalized.endsWith(ALLOWED_DOMAIN)
}

export function getFirstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0]
}
