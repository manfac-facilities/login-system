import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const veiculo_id = searchParams.get('veiculo_id')
  const equipe_id = searchParams.get('equipe_id')
  const motorista_id = searchParams.get('motorista_id')

  const supabase = await createClient()

  if (veiculo_id) {
    const { data } = await supabase
      .from('veiculo_responsabilidade_historico')
      .select('motorista_id, equipe_id, motoristas(id, nome), equipes(id, codigo)')
      .eq('veiculo_id', veiculo_id)
      .is('fim', null)
      .maybeSingle()
    return NextResponse.json(data ?? null)
  }

  if (equipe_id) {
    const [{ data: veiculo }, { data: motorista }] = await Promise.all([
      supabase
        .from('veiculos')
        .select('id, placa, modelo')
        .eq('equipe_id', equipe_id)
        .eq('status', 'ativo')
        .maybeSingle(),
      supabase
        .from('motoristas')
        .select('id, nome')
        .eq('equipe_id', equipe_id)
        .eq('ativo', true)
        .maybeSingle(),
    ])
    return NextResponse.json({ veiculo: veiculo ?? null, motorista: motorista ?? null })
  }

  if (motorista_id) {
    const { data: mot } = await supabase
      .from('motoristas')
      .select('equipe_id, equipes(id, codigo)')
      .eq('id', motorista_id)
      .maybeSingle()

    if (!mot?.equipe_id) return NextResponse.json({ equipe: null, veiculo: null })

    const { data: veiculo } = await supabase
      .from('veiculos')
      .select('id, placa, modelo')
      .eq('equipe_id', mot.equipe_id)
      .eq('status', 'ativo')
      .maybeSingle()

    return NextResponse.json({
      equipe: (mot as unknown as { equipe_id: string; equipes: { id: string; codigo: string } | null }).equipes ?? null,
      veiculo: veiculo ?? null,
    })
  }

  return NextResponse.json(null, { status: 400 })
}
