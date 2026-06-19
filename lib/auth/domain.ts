const ALLOWED_DOMAIN = '@manfac.com.br'
const EXTRA_ALLOWED_EMAILS = ['jvictorco28@gmail.com']

export function isManfacEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase()
  if (EXTRA_ALLOWED_EMAILS.includes(normalized)) return true
  const atCount = normalized.split('@').length - 1
  return atCount === 1 && normalized.endsWith(ALLOWED_DOMAIN)
}

export function getFirstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0]
}
