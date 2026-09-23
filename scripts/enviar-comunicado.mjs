#!/usr/bin/env node
/**
 * Envia por e-mail um comunicado de hub_comunicados
 * (spec docs/superpowers/specs/2026-09-22-comunicado-atualizacoes-design.md, peça 2).
 *
 * USO: node scripts/enviar-comunicado.mjs <comunicado_id> [--enviar]
 *   Sem --enviar é SIMULAÇÃO: imprime os destinatários e o e-mail renderizado,
 *   não envia nada.
 *
 * Destinatários: hub_system_access com o slug do comunicado e has_access =
 * true, mais os administradores de hub_user_roles — em minúsculas, sem
 * repetição. Um e-mail por pessoa (nunca CC/BCC coletivo).
 *
 * Lê pela Management API (PAT em C:\Users\joao-\.supabase-pat, roda como
 * postgres, acima da RLS — só SELECT aqui) e envia pela Resend (chave em
 * C:\Users\joao-\.resend-key). Nenhuma das duas é impressa.
 */

import { readFileSync } from 'node:fs'

const PROJETO = 'iyytcavcgukfjnjjrerx'
const CAMINHO_PAT = 'C:\\Users\\joao-\\.supabase-pat'
const CAMINHO_RESEND = 'C:\\Users\\joao-\\.resend-key'
const REMETENTE = 'Controle de Obras <avisos@manfac.com.br>'
const LINK = 'https://hub.manfac.com.br/obras'
const RODAPE = 'Você recebeu este e-mail porque tem acesso ao Controle de Obras no Hub Manfac.'

// ---------------------------------------------------------------------------
// Funções puras (testadas em scripts/__tests__/enviar-comunicado.test.ts)
// ---------------------------------------------------------------------------

export function montarDestinatarios(linhas) {
  const emails = linhas.map((l) => (l.user_email ?? '').trim().toLowerCase()).filter(Boolean)
  return [...new Set(emails)]
}

function linhasDoCorpo(corpo) {
  return corpo
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
}

function escapar(texto) {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function renderizarHtml({ titulo, corpo }) {
  const itens = linhasDoCorpo(corpo)
    .map((l) => `<li>${escapar(l)}</li>`)
    .join('')
  return `<!doctype html>
<html lang="pt-BR"><body style="margin:0;padding:24px;background:#f4f6fa;font-family:Arial,Helvetica,sans-serif;color:#1e293b">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #dde3ec;border-radius:8px;padding:20px">
<p style="margin:0 0 12px;font-size:16px;font-weight:bold;color:#0d2050">${escapar(titulo)}</p>
<ul style="margin:0 0 18px;padding-left:20px;font-size:14px;line-height:1.5">${itens}</ul>
<a href="${LINK}" style="display:inline-block;background:#f05a28;color:#ffffff;font-weight:bold;padding:11px 20px;border-radius:6px;font-size:14px;text-decoration:none">Abrir o Controle de Obras</a>
<p style="margin:20px 0 0;padding-top:12px;border-top:1px solid #e2e8f0;font-size:11px;color:#64748b">${RODAPE}</p>
</div>
</body></html>`
}

export function renderizarTexto({ titulo, corpo }) {
  const itens = linhasDoCorpo(corpo).map((l) => `- ${l}`)
  return [titulo, '', ...itens, '', `Abrir o Controle de Obras: ${LINK}`, '', RODAPE].join('\n')
}

/** O e-mail nunca sai antes da faixa: só comunicado publicado e já no passado. */
export function erroDePublicacao(comunicado, agora = new Date()) {
  if (!comunicado.publicado_em || new Date(comunicado.publicado_em) > agora) {
    return 'comunicado não publicado; a faixa ainda não aparece'
  }
  return null
}

export function montarEmail(comunicado, para) {
  return {
    from: REMETENTE,
    to: [para],
    subject: comunicado.titulo,
    html: renderizarHtml(comunicado),
    text: renderizarTexto(comunicado),
  }
}

// ---------------------------------------------------------------------------
// Execução
// ---------------------------------------------------------------------------

async function consultar(pat, query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJETO}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${pat}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  if (!res.ok) throw new Error(`Management API respondeu ${res.status}: ${await res.text()}`)
  return res.json()
}

async function main() {
  const id = process.argv[2]
  const enviar = process.argv.includes('--enviar')
  // O id entra no SQL: só aceita UUID.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id ?? '')) {
    console.error('Uso: node scripts/enviar-comunicado.mjs <comunicado_id (uuid)> [--enviar]')
    process.exit(1)
  }

  const pat = readFileSync(CAMINHO_PAT, 'utf8').trim()
  const [comunicado] = await consultar(
    pat,
    `select titulo, corpo, publicado_em from public.hub_comunicados where id = '${id}'`,
  )
  if (!comunicado) {
    console.error(`Comunicado ${id} não encontrado.`)
    process.exit(1)
  }
  const erro = erroDePublicacao(comunicado)
  if (erro) {
    console.error(`Comunicado ${id}: ${erro}.`)
    process.exit(1)
  }

  const destinatarios = montarDestinatarios(
    await consultar(
      pat,
      `select a.user_email from public.hub_system_access a
         join public.hub_comunicados c on c.sistema = a.system_slug
        where c.id = '${id}' and a.has_access = true
       union all
       select user_email from public.hub_user_roles where nivel = 'administrador'`,
    ),
  )

  console.log(`Destinatários (${destinatarios.length}):`)
  for (const e of destinatarios) console.log(`  ${e}`)

  if (!enviar) {
    const exemplo = montarEmail(comunicado, destinatarios[0] ?? '(ninguém)')
    console.log(`\nDe: ${exemplo.from}\nAssunto: ${exemplo.subject}\n\n--- texto ---\n${exemplo.text}`)
    console.log(`\n--- html ---\n${exemplo.html}`)
    console.log('\nSIMULAÇÃO — nada foi enviado. Rode de novo com --enviar para enviar.')
    return
  }

  const chave = readFileSync(CAMINHO_RESEND, 'utf8').trim()
  let falhas = 0
  for (const para of destinatarios) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(montarEmail(comunicado, para)),
    })
    if (res.ok) {
      console.log(`enviado   ${para}`)
    } else {
      falhas++
      console.error(`FALHOU    ${para} — ${res.status}: ${await res.text()}`)
    }
  }
  console.log(`\n${destinatarios.length - falhas} enviados, ${falhas} falhas.`)
  if (falhas > 0) process.exit(1)
}

if (process.argv[1]?.endsWith('enviar-comunicado.mjs')) {
  main().catch((e) => {
    console.error(e.message)
    process.exit(1)
  })
}
