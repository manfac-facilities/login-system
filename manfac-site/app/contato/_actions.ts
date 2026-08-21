'use server'

import { randomUUID } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { TEXTO_CONSENTIMENTO, validarEtapa1, validarEtapa2, type LeadEtapa1, type LeadEtapa2 } from '@/lib/leads'

// 'infra': o banco/serviço falhou — antes desta frente 100% de quem
// preenchia o formulário chegava ao WhatsApp; aqui a pessoa não fez nada de
// errado, então o retorno tem que abrir um caminho alternativo pro wa.me.
// 'validacao': o dado enviado é que está incorreto — a pessoa deve corrigir
// o campo, não ganhar um atalho que pula a correção.
type ResultadoEtapa1 = { ok: true; id: string } | { ok: false; erro: string; falha: 'infra' | 'validacao' }

const ERRO_INFRA = 'Não conseguimos registrar agora. Fale com a gente no WhatsApp.'

export async function registrarLeadAction(
  dados: LeadEtapa1 & { armadilha?: string }
): Promise<ResultadoEtapa1> {
  // Campo-armadilha: invisível para gente, irresistível para robô. Responder
  // sucesso sem gravar é de propósito — robô que recebe erro tenta de novo.
  // O `id` precisa parecer um UUID de verdade: `id: ''` distinguiria a
  // armadilha do caminho real na hora para quem estiver testando a defesa.
  if (dados.armadilha) {
    console.warn('[site_leads] armadilha preenchida, lead descartado')
    return { ok: true, id: randomUUID() }
  }

  const v = validarEtapa1(dados)
  if (v.ok === false) return { ok: false, erro: v.erro, falha: 'validacao' }

  // Tudo dentro do try — inclusive createAdminClient(). Ele lança de propósito
  // quando a service role key não chega no processo (ver lib/supabase/admin.ts),
  // e essa é justamente a falha que já aconteceu aqui: chave configurada no
  // painel mas ausente no container. Deixar esse throw escapar significa a
  // Promise rejeitar sem setEnviando(false) rodar no cliente — botão preso em
  // "Enviando…" para sempre, pior que a etapa 1 nem existir.
  try {
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
        consentimento_texto: TEXTO_CONSENTIMENTO,
      })
      .select('id')
      .single()

    if (error || !data) {
      console.error('[site_leads] falha ao gravar etapa 1:', error?.message)
      return { ok: false, erro: ERRO_INFRA, falha: 'infra' }
    }

    return { ok: true, id: data.id as string }
  } catch (e) {
    console.error('[site_leads] falha ao gravar etapa 1:', e instanceof Error ? e.message : e)
    return { ok: false, erro: ERRO_INFRA, falha: 'infra' }
  }
}

export async function completarLeadAction(
  id: string,
  dados: LeadEtapa2
): Promise<{ ok: boolean }> {
  // Sem id não há o que atualizar — e inserir aqui criaria lead duplicado,
  // que é exatamente o que a indexação por id existe para evitar.
  if (!id) return { ok: false }

  const v = validarEtapa2(dados)
  if (v.ok === false) return { ok: false }

  // Mesmo motivo do try da etapa 1: createAdminClient() pode lançar, e isso
  // não pode virar Promise rejeitada aqui dentro.
  try {
    const agora = new Date().toISOString()
    const supabase = createAdminClient()
    const { data, error } = await supabase
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
      // `site_leads` é registro de captura, imutável: a etapa 2 acontece uma
      // vez só. Sem este `.is`, qualquer chamador com o UUID sobrescreve o
      // lead quantas vezes quiser — inclusive zerando tudo, já que campo
      // ausente vira `null` no update acima.
      .is('etapa2_em', null)
      .eq('id', id)
      .select('id')

    if (error || !data?.length) {
      console.error('[site_leads] falha ao completar etapa 2:', error?.message)
      return { ok: false }
    }
    return { ok: true }
  } catch (e) {
    console.error('[site_leads] falha ao completar etapa 2:', e instanceof Error ? e.message : e)
    return { ok: false }
  }
}
