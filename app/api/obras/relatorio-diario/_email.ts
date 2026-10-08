import { R, fd } from '../../../obras/painel/_ui'

export const LINK_PAINEL = 'https://hub.manfac.com.br/obras/painel'
export const CID_IMAGEM = 'painel-gerencial@manfac'

/** O que o e-mail lê do painel; `Painel` de `montarPainel` satisfaz. */
export type PainelParaEmail = {
  hoje: string
  kpis: {
    carteira: { valor: number }
    faturamentoMes: { valor: number }
    faturadoAno: { valor: number }
    pendente: { valor: number }
  }
}

type LinhaEmail = { user_email: string | null }
type LinhaAcesso = LinhaEmail & { has_access?: boolean | null }

const normaliza = (e: string | null | undefined) => (typeof e === 'string' ? e.trim().toLowerCase() : '')

/**
 * Quem recebe: acesso ao slug `obras` (só `has_access === true` estrito) mais
 * administradores. Minúsculas, sem vazios, sem repetição, em ordem estável.
 */
export function montarDestinatarios(acesso: LinhaAcesso[], admins: LinhaEmail[]): string[] {
  const todos = new Set<string>()
  for (const l of acesso) {
    if (l.has_access !== true) continue
    const e = normaliza(l.user_email)
    if (e) todos.add(e)
  }
  for (const l of admins) {
    const e = normaliza(l.user_email)
    if (e) todos.add(e)
  }
  return [...todos].sort()
}

/** `SMTP_REMETENTE` como vem; se for só o endereço, acrescenta o nome "Manfac". Quem lê o env é a rota. */
export function remetenteDe(valor: string): string {
  const v = valor.trim()
  return v.includes('<') ? v : `"Manfac" <${v}>`
}

/** `AAAA-MM-DD` → `DD/MM/AAAA`. */
const dataBr = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`

export function assuntoDoDia(hoje: string): string {
  return `Gestão de Obras — Painel gerencial de ${dataBr(hoje)}`
}

/** `DD/MM/AAAA às HH:MM` em horário de Brasília. */
export function formatarLidoEm(d: Date): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(d)
      .map((x) => [x.type, x.value])
  )
  return `${p.day}/${p.month}/${p.year} às ${p.hour}:${p.minute}`
}

export function textoAlternativo(painel: PainelParaEmail): string {
  const k = painel.kpis
  return (
    `Painel gerencial de ${dataBr(painel.hoje)} — ` +
    `Carteira ${R(k.carteira.valor)} · Faturamento do mês ${R(k.faturamentoMes.valor)} · ` +
    `Faturado no ano ${R(k.faturadoAno.valor)} · Pendente faturamento ${R(k.pendente.valor)}`
  )
}

export function escapar(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const SAUDACAO = 'Bom dia! Segue o Painel gerencial de hoje.'
const MOTIVO = 'Você recebe este e-mail porque tem acesso ao Gestão de Obras no hub Manfac.'
const lidoEmFrase = (lidoEm: string) => `Dados lidos em ${lidoEm} (horário de Brasília).`

export function htmlDoEmail({ painel, lidoEm, alt }: { painel: PainelParaEmail; lidoEm: string; alt: string }): string {
  void painel
  const fonte = 'font-family:Arial,Helvetica,sans-serif'
  return `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#e9edf4;${fonte}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e9edf4"><tr><td align="center" style="padding:16px 8px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:8px">
<tr><td style="padding:14px 20px;border-bottom:3px solid #f05a28;${fonte};font-size:14px"><strong style="color:#f05a28;letter-spacing:1px">MANFAC</strong> <span style="color:#64748b">Gestão de Obras</span></td></tr>
<tr><td style="padding:20px 20px 12px;${fonte};font-size:16px;color:#0f172a">${escapar(SAUDACAO)}</td></tr>
<tr><td style="padding:0 20px 16px"><img src="cid:${CID_IMAGEM}" width="560" alt="${escapar(alt)}" style="display:block;width:100%;max-width:560px;height:auto;border-radius:6px"></td></tr>
<tr><td style="padding:0 20px 20px"><a href="${LINK_PAINEL}" style="display:inline-block;background:#f05a28;color:#ffffff;${fonte};font-size:15px;font-weight:bold;text-decoration:none;padding:12px 22px;border-radius:6px">Abrir o Painel no hub</a></td></tr>
<tr><td style="padding:16px 20px 20px;border-top:1px solid #e2e8f0;${fonte};font-size:12px;line-height:1.5;color:#64748b"><p style="margin:0 0 6px">${escapar(MOTIVO)}</p><p style="margin:0">${escapar(lidoEmFrase(lidoEm))}</p></td></tr>
</table>
</td></tr></table>
</body>
</html>`
}

export function textoDoEmail({ painel, lidoEm }: { painel: PainelParaEmail; lidoEm: string }): string {
  const k = painel.kpis
  return [
    SAUDACAO,
    '',
    `Carteira: ${R(k.carteira.valor)}`,
    `Faturamento do mês: ${R(k.faturamentoMes.valor)}`,
    `Faturado no ano: ${R(k.faturadoAno.valor)}`,
    `Pendente faturamento: ${R(k.pendente.valor)}`,
    '',
    `Abrir o Painel no hub: ${LINK_PAINEL}`,
    '',
    MOTIVO,
    lidoEmFrase(lidoEm),
  ].join('\n')
}
