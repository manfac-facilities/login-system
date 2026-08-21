'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { validarEtapa1, type LeadEtapa1, type LeadEtapa2 } from '@/lib/leads'

type ResultadoEtapa1 = { ok: true; id: string } | { ok: false; erro: string }

export async function registrarLeadAction(
  dados: LeadEtapa1 & { armadilha?: string }
): Promise<ResultadoEtapa1> {
  // Campo-armadilha: invisível para gente, irresistível para robô. Responder
  // sucesso sem gravar é de propósito — robô que recebe erro tenta de novo.
  if (dados.armadilha) return { ok: true, id: '' }

  const v = validarEtapa1(dados)
  if (v.ok === false) return { ok: false, erro: v.erro }

  const agora = new Date().toISOString()
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('site_leads')
    .insert({
      path: dados.path,
      nome: dados.nome.trim(),
      email: dados.email.trim().toLowerCase(),
      telefone: dados.telefone.trim(),
      consentimento: true,
      consentido_em: agora,
    })
    .select('id')
    .single()

  if (error || !data) {
    console.error('[site_leads] falha ao gravar etapa 1:', error?.message)
    return { ok: false, erro: 'Não conseguimos registrar agora. Fale com a gente no WhatsApp.' }
  }

  return { ok: true, id: data.id as string }
}

export async function completarLeadAction(
  id: string,
  dados: LeadEtapa2
): Promise<{ ok: boolean }> {
  // Sem id não há o que atualizar — e inserir aqui criaria lead duplicado,
  // que é exatamente o que a indexação por id existe para evitar.
  if (!id) return { ok: false }

  const agora = new Date().toISOString()
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('site_leads')
    .update({
      empresa: dados.empresa?.trim() || null,
      cargo: dados.cargo?.trim() || null,
      localidade: dados.localidade?.trim() || null,
      unidades: dados.unidades?.trim() || null,
      resumo: dados.resumo?.trim() || null,
      etapa2_em: agora,
      atualizado_em: agora,
    })
    .eq('id', id)

  if (error) {
    console.error('[site_leads] falha ao completar etapa 2:', error.message)
    return { ok: false }
  }
  return { ok: true }
}
