const ADMIN_EMAILS = [
  'ewerton.silva@manfac.com.br',
  'jose.guilherme@manfac.com.br',
  'jvictorco28@gmail.com',
]

export function isAdminEmail(email: string): boolean {
  return ADMIN_EMAILS.includes(email.trim().toLowerCase())
}
