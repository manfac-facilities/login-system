const ADMIN_EMAILS = [
  'jose.guilherme@manfac.com.br',
  'jvictorco28@gmail.com',
]

export function isAdminEmail(email: string): boolean {
  return ADMIN_EMAILS.includes(email.trim().toLowerCase())
}
